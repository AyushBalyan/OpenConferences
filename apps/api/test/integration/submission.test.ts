import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext, applyScanResult } from '@openconferences/db';
import {
  lastTestNotifications,
  resetLastTestNotification,
} from '../../src/messaging/notification.service.ts';
import { ensureNotificationTemplates } from '../helpers/notifications.ts';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';

const config = getConfig();

async function createUserWithSession(
  app: INestApplication,
  email: string,
  name: string,
): Promise<{ userId: string; cookie: string }> {
  const password = 'TestPassword123!';
  const { hashPassword } = await import('better-auth/crypto');
  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          id: generateId(),
          accountId: email,
          providerId: 'credential',
          password: passwordHash,
        },
      },
    },
  });

  const signIn = await request(app.getHttpServer())
    .post('/api/v1/auth/sign-in/email')
    .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
    .send({ email, password });

  if (signIn.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${signIn.status}`);
  }

  const setCookie = signIn.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies
    .map((c) => c?.split(';')[0])
    .filter(Boolean)
    .join('; ');

  return { userId, cookie };
}

// Serialized via vitest singleFork to avoid pg-boss deadlocks across suites.
describe('Paper submission integration', () => {
  let app: INestApplication;

  const orgId = generateId();
  const confId = generateId();
  const confBId = generateId();
  const trackId = generateId();

  const authorEmail = `author-sub-${Date.now()}@example.com`;
  const outsiderEmail = `outsider-sub-${Date.now()}@example.com`;
  const organizerEmail = `org-sub-${Date.now()}@example.com`;

  let authorUserId = '';
  let authorCookie = '';
  let outsiderCookie = '';
  let organizerCookie = '';

  beforeAll(async () => {
    resetLastTestNotification();

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();
    await ensureNotificationTemplates();

    const author = await createUserWithSession(app, authorEmail, 'Author');
    const outsider = await createUserWithSession(app, outsiderEmail, 'Outsider');
    const organizer = await createUserWithSession(app, organizerEmail, 'Organizer');

    authorUserId = author.userId;
    authorCookie = author.cookie;
    outsiderCookie = outsider.cookie;
    organizerCookie = organizer.cookie;

    await withTenantContext({}, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `sub-org-${Date.now()}`, name: 'Submission Org' },
      });

      await tx.conference.createMany({
        data: [
          {
            id: confId,
            organizationId: orgId,
            slug: 'sub-conf',
            name: 'Submission Conf',
            authorJoinToken: generateId(),
            status: 'CFP_OPEN',
          },
          {
            id: confBId,
            organizationId: orgId,
            slug: 'sub-conf-b',
            name: 'Submission Conf B',
            authorJoinToken: generateId(),
            status: 'CFP_OPEN',
          },
        ],
      });

      await tx.track.create({
        data: {
          id: trackId,
          conferenceId: confId,
          organizationId: orgId,
          slug: 'main',
          name: 'Main',
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: author.userId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'AUTHOR' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizer.userId,
          organizationId: orgId,
          scope: 'ORGANIZATION',
          roles: { create: { id: generateId(), role: 'ORG_ADMIN' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizer.userId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'ORGANIZER' } },
        },
      });
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a draft paper for an author', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Test Paper',
        abstract: 'An abstract that is long enough.',
        keywords: ['testing'],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.authorships?.length).toBeGreaterThan(0);
  });

  it('creates a draft paper without trackId by using the conference default track', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        title: 'Default Track Paper',
        abstract: 'An abstract that is long enough.',
        keywords: ['testing'],
      });

    expect(res.status).toBe(201);
    expect(res.body.trackId).toBe(trackId);
  });

  it('creates a default Main track when submitting to a legacy conference without tracks', async () => {
    const legacyConfId = generateId();

    await withTenantContext({}, async (tx) => {
      await tx.conference.create({
        data: {
          id: legacyConfId,
          organizationId: orgId,
          slug: `legacy-${legacyConfId.slice(0, 8)}`,
          name: 'Legacy Conference',
          status: 'CFP_OPEN',
          authorJoinToken: generateId(),
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: authorUserId,
          organizationId: orgId,
          conferenceId: legacyConfId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'AUTHOR' } },
        },
      });
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${legacyConfId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        title: 'Legacy Track Paper',
        abstract: 'An abstract that is long enough.',
        keywords: ['legacy'],
      });

    expect(res.status).toBe(201);
    expect(res.body.trackId).toBeTruthy();

    const track = await withTenantContext({}, async (tx) =>
      tx.track.findFirst({
        where: { conferenceId: legacyConfId, deletedAt: null },
      }),
    );
    expect(track?.slug).toBe('main');
    expect(track?.name).toBe('Main Track');
  });

  it('rejects oversize upload initiation', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Oversize Paper',
        abstract: 'Testing oversize rejection.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'big.pdf',
        contentType: 'application/pdf',
        sizeBytes: 60_000_000,
      });

    expect(res.status).toBe(400);
  });

  it('rejects non-PDF content type on initiate', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Bad MIME Paper',
        abstract: 'Testing MIME rejection.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'evil.exe',
        contentType: 'application/octet-stream',
        sizeBytes: 1024,
      });

    expect(res.status).toBe(400);
  });

  it('uploads, scans clean, and submits a paper', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Happy Path Paper',
        abstract: 'Complete submission workflow test.',
        keywords: ['happy'],
      });

    expect(create.status).toBe(201);
    const paperId = create.body.id as string;

    const initiate = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'paper.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
      });

    expect(initiate.status).toBe(200);
    const objectKey = initiate.body.objectKey as string;

    const complete = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
      .set('Cookie', authorCookie)
      .send({ objectKey, kind: 'SUBMISSION' });

    expect(complete.status).toBe(201);

    const afterScan = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
      .set('Cookie', authorCookie);

    expect(afterScan.body.currentVersionId).toBeTruthy();
    expect(afterScan.body.currentVersion?.fileAsset?.scanStatus).toBe('CLEAN');

    resetLastTestNotification();
    const submit = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/submit`)
      .set('Cookie', authorCookie);

    expect(submit.status).toBe(200);
    expect(submit.body.paper.status).toBe('SUBMITTED');
    expect(lastTestNotifications[0]?.templateKey).toBe('submission.confirmed');
    expect(lastTestNotifications[0]?.to).toBe(authorEmail.toLowerCase());
    if (config.mail.submissionAlertEmail) {
      expect(
        lastTestNotifications.some((item) => item.templateKey === 'submission.ops_alert'),
      ).toBe(true);
    } else {
      expect(lastTestNotifications.map((item) => item.templateKey)).toEqual([
        'submission.confirmed',
      ]);
    }
  });

  it('blocks currentVersion when infected file is detected', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Infected Paper',
        abstract: 'Should not become current version.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const initiate = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'eicar-test.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      });

    const complete = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
      .set('Cookie', authorCookie)
      .send({ objectKey: initiate.body.objectKey, kind: 'SUBMISSION' });

    expect(complete.status).toBe(201);

    const paper = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
      .set('Cookie', authorCookie);

    expect(paper.body.currentVersionId).toBeNull();
    expect(paper.body.currentVersion?.fileAsset?.scanStatus ?? 'INFECTED').toBe('INFECTED');

    const submit = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/submit`)
      .set('Cookie', authorCookie);

    expect(submit.status).toBe(409);
    expect(submit.body.detail).toMatch(/failed security scanning/i);
  });

  it('allows a second draft PDF upload after the first version is finalized', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Retry Upload Paper',
        abstract: 'Second complete must allocate the next version number.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const firstInitiate = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'first.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
      });

    expect(firstInitiate.status).toBe(200);

    const firstComplete = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
      .set('Cookie', authorCookie)
      .send({ objectKey: firstInitiate.body.objectKey, kind: 'SUBMISSION' });

    expect(firstComplete.status).toBe(201);
    expect(firstComplete.body.versionNumber).toBe(1);

    const secondInitiate = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
      .set('Cookie', authorCookie)
      .send({
        originalFilename: 'second.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
      });

    expect(secondInitiate.status).toBe(200);

    const secondComplete = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
      .set('Cookie', authorCookie)
      .send({ objectKey: secondInitiate.body.objectKey, kind: 'SUBMISSION' });

    expect(secondComplete.status).toBe(201);
    expect(secondComplete.body.versionNumber).toBe(2);
  });

  it('rejects submit while the latest PDF is still pending scan', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Pending Scan Paper',
        abstract: 'Submit should wait for AV scan.',
        keywords: [],
      });

    const paperId = create.body.id as string;
    const fileAssetId = generateId();
    const versionId = generateId();

    await withTenantContext(
      { userId: authorUserId, conferenceId: confId, organizationId: orgId },
      async (tx) => {
        await tx.fileAsset.create({
          data: {
            id: fileAssetId,
            organizationId: orgId,
            uploadedById: authorUserId,
            bucket: 'test-bucket',
            objectKey: `test/${fileAssetId}.pdf`,
            sizeBytes: 1024n,
            checksumSha256: 'c'.repeat(64),
            mimeType: 'application/pdf',
            originalFilename: 'pending.pdf',
            scanStatus: 'PENDING_SCAN',
          },
        });
        await tx.paperVersion.create({
          data: {
            id: versionId,
            paperId,
            fileAssetId,
            uploadedById: authorUserId,
            kind: 'SUBMISSION',
            versionNumber: 1,
          },
        });
      },
    );

    const submit = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/submit`)
      .set('Cookie', authorCookie);

    const pendingPaper = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
      .set('Cookie', authorCookie);

    expect(pendingPaper.status).toBe(200);
    expect(pendingPaper.body.currentVersionId).toBeNull();
    expect(pendingPaper.body.latestVersion?.fileAsset?.scanStatus).toBe('PENDING_SCAN');

    expect(submit.status).toBe(409);
    expect(submit.body.detail).toMatch(/still being scanned/i);
  });

  it('reorders authorships', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Authorship Paper',
        abstract: 'Testing authorship reorder.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const coAuthor = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/authorships`)
      .set('Cookie', authorCookie)
      .send({
        fullName: 'Co Author',
        email: 'coauthor@example.com',
      });

    expect(coAuthor.status).toBe(201);

    const paper = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
      .set('Cookie', authorCookie);

    const ids = (paper.body.authorships as { id: string; order: number }[]).map((a) => a.id);
    const reversed = [...ids].reverse();

    const reorder = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confId}/papers/${paperId}/authorships/reorder`)
      .set('Cookie', authorCookie)
      .send({ authorshipIds: reversed });

    expect(reorder.status).toBe(200);
    expect(reorder.body.data[0].id).toBe(reversed[0]);
  });

  it('returns 404 for cross-conference paper access (IDOR)', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'IDOR Paper',
        abstract: 'Cross conference access test.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/papers/${paperId}`)
      .set('Cookie', authorCookie);

    expect(res.status).toBe(404);
  });

  it('prevents outsider from editing author paper', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', authorCookie)
      .send({
        trackId,
        title: 'Protected Paper',
        abstract: 'Only authors may edit.',
        keywords: [],
      });

    const paperId = create.body.id as string;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confId}/papers/${paperId}`)
      .set('Cookie', outsiderCookie)
      .send({ title: 'Hacked', version: 0 });

    expect([403, 404]).toContain(res.status);
  });

  it('allows organizer to list all conference papers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers`)
      .set('Cookie', organizerCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('treats mine=false as all papers for privileged readers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers?mine=false`)
      .set('Cookie', organizerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('allows organisation admin to download a CLEAN paper version', async () => {
    const paperId = generateId();
    const fileAssetId = generateId();
    const versionId = generateId();

    await withTenantContext({}, async (tx) => {
      await tx.paper.create({
        data: {
          id: paperId,
          organizationId: orgId,
          conferenceId: confId,
          trackId,
          submittedById: authorUserId,
          title: 'Downloadable Paper',
          abstract: 'Organisation admins can download this manuscript.',
          keywords: [],
          status: 'SUBMITTED',
        },
      });
      await tx.fileAsset.create({
        data: {
          id: fileAssetId,
          organizationId: orgId,
          uploadedById: authorUserId,
          bucket: 'test-bucket',
          objectKey: `test/${fileAssetId}.pdf`,
          sizeBytes: 1024n,
          checksumSha256: 'c'.repeat(64),
          mimeType: 'application/pdf',
          originalFilename: 'downloadable.pdf',
          scanStatus: 'CLEAN',
        },
      });
      await tx.paperVersion.create({
        data: {
          id: versionId,
          paperId,
          fileAssetId,
          uploadedById: authorUserId,
          kind: 'SUBMISSION',
          versionNumber: 1,
        },
      });
      await tx.paper.update({
        where: { id: paperId },
        data: { currentVersionId: versionId },
      });
    });

    const ok = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}/versions/${versionId}/download`)
      .set('Cookie', organizerCookie);

    expect(ok.status).toBe(200);
    expect(ok.body.downloadUrl).toBeTruthy();
    expect(ok.body.expiresInSeconds).toBeGreaterThan(0);

    const denied = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}/versions/${versionId}/download`)
      .set('Cookie', outsiderCookie);
    expect([403, 404]).toContain(denied.status);
  });

  describe('Phase 7 — camera-ready', () => {
    let acceptedPaperId = '';
    let unnotifiedPaperId = '';
    let rejectedPaperId = '';
    let lateDeadlinePaperId = '';

    beforeAll(async () => {
      const cameraReadyDue = new Date(Date.now() + 86_400_000 * 14);

      await withTenantContext({}, async (tx) => {
        await tx.conference.update({
          where: { id: confId },
          data: { cameraReadyDueAt: cameraReadyDue },
        });

        acceptedPaperId = generateId();
        unnotifiedPaperId = generateId();
        rejectedPaperId = generateId();
        lateDeadlinePaperId = generateId();

        const basePaper = {
          organizationId: orgId,
          conferenceId: confId,
          trackId,
          submittedById: authorUserId,
          title: 'Camera-ready test',
          abstract: 'Accepted paper for camera-ready tests.',
          keywords: [] as string[],
        };

        await tx.paper.createMany({
          data: [
            { ...basePaper, id: acceptedPaperId, status: 'DECISION_MADE' },
            { ...basePaper, id: unnotifiedPaperId, status: 'DECISION_MADE', title: 'Unnotified' },
            { ...basePaper, id: rejectedPaperId, status: 'DECISION_MADE', title: 'Rejected' },
            {
              ...basePaper,
              id: lateDeadlinePaperId,
              status: 'DECISION_MADE',
              title: 'Late deadline',
            },
          ],
        });

        for (const item of [
          { paperId: acceptedPaperId, outcome: 'ACCEPT' as const, notifiedAt: new Date() },
          { paperId: unnotifiedPaperId, outcome: 'ACCEPT' as const, notifiedAt: null },
          { paperId: rejectedPaperId, outcome: 'REJECT' as const, notifiedAt: new Date() },
          { paperId: lateDeadlinePaperId, outcome: 'ACCEPT' as const, notifiedAt: new Date() },
        ]) {
          const cycleId = generateId();
          await tx.reviewRound.create({
            data: {
              id: cycleId,
              organizationId: orgId,
              conferenceId: confId,
              paperId: item.paperId,
              roundNumber: 1,
            },
          });
          await tx.decision.create({
            data: {
              id: generateId(),
              organizationId: orgId,
              conferenceId: confId,
              paperId: item.paperId,
              roundId: cycleId,
              decidedById: authorUserId,
              outcome: item.outcome,
              notifiedAt: item.notifiedAt,
              version: 1,
            },
          });
        }
      });
    });

    async function uploadCameraReady(
      paperId: string,
      cookie: string,
      filename = 'camera-ready.pdf',
    ) {
      const initiate = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
        .set('Cookie', cookie)
        .send({
          originalFilename: filename,
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      if (initiate.status !== 200) {
        return initiate;
      }

      return request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
        .set('Cookie', cookie)
        .send({ objectKey: initiate.body.objectKey, kind: 'CAMERA_READY' });
    }

    it('allows accepted notified author to upload camera-ready before deadline', async () => {
      const initiate = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${acceptedPaperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(initiate.status).toBe(200);

      const complete = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${acceptedPaperId}/versions/complete`)
        .set('Cookie', authorCookie)
        .send({ objectKey: initiate.body.objectKey, kind: 'CAMERA_READY' });

      expect(complete.status).toBe(201);
      expect(complete.body.kind).toBe('CAMERA_READY');

      const paper = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${acceptedPaperId}`)
        .set('Cookie', authorCookie);

      expect(paper.body.cameraReadyVersion?.fileAsset?.scanStatus).toBe('CLEAN');
      expect(paper.body.status).toBe('CAMERA_READY');
      expect(paper.body.currentVersion?.kind).toBe('CAMERA_READY');
    });

    it('rejects camera-ready upload for unnotified acceptance', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${unnotifiedPaperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(404);
    });

    it('rejects camera-ready upload for rejected papers', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${rejectedPaperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(409);
    });

    it('rejects camera-ready upload after deadline', async () => {
      await withTenantContext({}, async (tx) => {
        await tx.conference.update({
          where: { id: confId },
          data: { cameraReadyDueAt: new Date(Date.now() - 86_400_000) },
        });
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${lateDeadlinePaperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(422);

      await withTenantContext({}, async (tx) => {
        await tx.conference.update({
          where: { id: confId },
          data: { cameraReadyDueAt: new Date(Date.now() + 86_400_000 * 14) },
        });
      });
    });

    it('rejects camera-ready upload for draft papers', async () => {
      const create = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers`)
        .set('Cookie', authorCookie)
        .send({
          trackId,
          title: 'Still Draft',
          abstract: 'Should not allow camera-ready.',
          keywords: [],
        });

      const paperId = create.body.id as string;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(409);
    });

    it('rejects outsider from uploading camera-ready', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${lateDeadlinePaperId}/versions/initiate`)
        .set('Cookie', outsiderCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect([403, 404]).toContain(res.status);
    });

    it('rejects organizer from uploading camera-ready without authorship', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${lateDeadlinePaperId}/versions/initiate`)
        .set('Cookie', organizerCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(403);
    });

    it('returns 404 for cross-conference camera-ready upload (IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/papers/${acceptedPaperId}/versions/initiate`)
        .set('Cookie', authorCookie)
        .send({
          originalFilename: 'camera-ready.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'CAMERA_READY',
        });

      expect(res.status).toBe(404);
    });

    it('quarantines infected camera-ready uploads without advancing paper status', async () => {
      const paperId = generateId();
      const roundId = generateId();

      await withTenantContext({}, async (tx) => {
        await tx.paper.create({
          data: {
            id: paperId,
            organizationId: orgId,
            conferenceId: confId,
            trackId,
            submittedById: authorUserId,
            title: 'Infected camera-ready',
            abstract: 'Should not become camera-ready.',
            keywords: [],
            status: 'DECISION_MADE',
          },
        });

        await tx.reviewRound.create({
          data: {
            id: roundId,
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundNumber: 1,
          },
        });

        await tx.decision.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundId,
            decidedById: authorUserId,
            outcome: 'ACCEPT',
            notifiedAt: new Date(),
            version: 1,
          },
        });
      });

      const complete = await uploadCameraReady(paperId, authorCookie, 'eicar-test.pdf');
      expect(complete.status).toBe(201);

      const paper = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
        .set('Cookie', authorCookie);

      expect(paper.body.status).toBe('DECISION_MADE');
      expect(paper.body.cameraReadyVersion?.fileAsset?.scanStatus).toBe('INFECTED');
      expect(paper.body.currentVersionId).toBeNull();
    });
  });

  describe('POST revision version', () => {
    const futureDue = new Date(Date.now() + 86_400_000 * 14);

    async function seedRevisionPaper(options: {
      status?: 'UNDER_REVIEW' | 'DECISION_MADE' | 'WITHDRAWN';
      outcome?: 'MINOR_REVISION' | 'MAJOR_REVISION' | 'ACCEPT' | 'REJECT';
      notifiedAt?: Date | null;
      revisionDueAt?: Date | null;
    }) {
      const paperId = generateId();
      const roundId = generateId();
      await withTenantContext({}, async (tx) => {
        await tx.paper.create({
          data: {
            id: paperId,
            organizationId: orgId,
            conferenceId: confId,
            trackId,
            submittedById: authorUserId,
            title: 'Revision upload paper',
            abstract: 'Needs a revised PDF.',
            keywords: [],
            status: options.status ?? 'UNDER_REVIEW',
          },
        });
        await tx.reviewRound.create({
          data: {
            id: roundId,
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundNumber: 1,
            revisionDueAt: options.revisionDueAt === undefined ? futureDue : options.revisionDueAt,
          },
        });
        await tx.decision.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundId,
            decidedById: authorUserId,
            outcome: options.outcome ?? 'MINOR_REVISION',
            notifiedAt: options.notifiedAt === undefined ? new Date() : options.notifiedAt,
            version: 1,
          },
        });
      });
      return { paperId, roundId };
    }

    async function uploadRevision(paperId: string, cookie: string, filename = 'revision.pdf') {
      const initiate = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/initiate`)
        .set('Cookie', cookie)
        .send({
          originalFilename: filename,
          contentType: 'application/pdf',
          sizeBytes: 4096,
          kind: 'REVISION',
        });
      if (initiate.status !== 200) return initiate;
      return request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/versions/complete`)
        .set('Cookie', cookie)
        .send({ objectKey: initiate.body.objectKey, kind: 'REVISION' });
    }

    it('opens the next cycle once a clean revision is current', async () => {
      const { paperId } = await seedRevisionPaper({});
      const complete = await uploadRevision(paperId, authorCookie);
      expect(complete.status).toBe(201);

      const paper = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}`)
        .set('Cookie', authorCookie);
      expect(paper.body.revisionVersion?.fileAsset?.scanStatus).toBe('CLEAN');
      expect(paper.body.currentVersion?.kind).toBe('REVISION');
      expect(paper.body.status).toBe('UNDER_REVIEW');
      expect(paper.body.revisionDueAt).toBeTruthy();

      const cycles = await prisma.reviewRound.findMany({
        where: { paperId },
        orderBy: { roundNumber: 'asc' },
      });
      expect(cycles).toHaveLength(2);
      expect(cycles[1]?.roundNumber).toBe(2);
    });

    it('does not open a cycle for an infected revision and allows a later clean upload', async () => {
      const { paperId } = await seedRevisionPaper({});
      const infected = await uploadRevision(paperId, authorCookie, 'eicar-revision.pdf');
      expect(infected.status).toBe(201);
      expect(await prisma.reviewRound.count({ where: { paperId } })).toBe(1);

      const clean = await uploadRevision(paperId, authorCookie, 'revision.pdf');
      expect(clean.status).toBe(201);
      expect(await prisma.reviewRound.count({ where: { paperId } })).toBe(2);

      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(paper?.currentVersionId).toBeTruthy();
    });

    it('replaces the revised PDF without opening a third cycle before assignment', async () => {
      const { paperId } = await seedRevisionPaper({});
      expect((await uploadRevision(paperId, authorCookie, 'revision-v1.pdf')).status).toBe(201);
      expect((await uploadRevision(paperId, authorCookie, 'revision-v2.pdf')).status).toBe(201);
      expect(await prisma.reviewRound.count({ where: { paperId } })).toBe(2);

      const current = await prisma.paper.findUnique({
        where: { id: paperId },
        include: { currentVersion: true },
      });
      expect(current?.currentVersion?.versionNumber).toBe(2);
    });

    it('rejects another revision after the next cycle has an assignment', async () => {
      const { paperId } = await seedRevisionPaper({});
      expect((await uploadRevision(paperId, authorCookie)).status).toBe(201);
      const nextCycle = await prisma.reviewRound.findFirst({
        where: { paperId, roundNumber: 2 },
      });
      await withTenantContext({}, async (tx) => {
        await tx.reviewerAssignment.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            roundId: nextCycle!.id,
            paperId,
            reviewerUserId: authorUserId,
            status: 'ASSIGNED',
          },
        });
      });

      const res = await uploadRevision(paperId, authorCookie, 'revision-v3.pdf');
      expect(res.status).toBe(409);
      expect(await prisma.reviewRound.count({ where: { paperId } })).toBe(2);
    });

    it('rejects an unnotified revision decision', async () => {
      const { paperId } = await seedRevisionPaper({ notifiedAt: null });
      const res = await uploadRevision(paperId, authorCookie);
      expect(res.status).toBe(404);
    });

    it('rejects a missing or passed revision deadline', async () => {
      const missing = await seedRevisionPaper({ revisionDueAt: null });
      expect((await uploadRevision(missing.paperId, authorCookie)).status).toBe(422);

      const passed = await seedRevisionPaper({
        revisionDueAt: new Date(Date.now() - 86_400_000),
      });
      expect((await uploadRevision(passed.paperId, authorCookie)).status).toBe(422);
    });

    it('rejects accept, reject, withdrawn papers, and non-authors', async () => {
      const accepted = await seedRevisionPaper({ status: 'DECISION_MADE', outcome: 'ACCEPT' });
      expect((await uploadRevision(accepted.paperId, authorCookie)).status).toBe(409);

      const rejected = await seedRevisionPaper({ status: 'UNDER_REVIEW', outcome: 'REJECT' });
      expect((await uploadRevision(rejected.paperId, authorCookie)).status).toBe(409);

      const withdrawn = await seedRevisionPaper({ status: 'WITHDRAWN' });
      expect((await uploadRevision(withdrawn.paperId, authorCookie)).status).toBe(409);

      const allowed = await seedRevisionPaper({});
      expect((await uploadRevision(allowed.paperId, organizerCookie)).status).toBe(403);
    });

    it('keeps an older clean revision from replacing a newer one', async () => {
      const { paperId } = await seedRevisionPaper({});
      const file = async (name: string) => {
        const assetId = generateId();
        const versionId = generateId();
        await withTenantContext({}, async (tx) => {
          const latest = await tx.paperVersion.findFirst({
            where: { paperId, kind: 'REVISION' },
            orderBy: { versionNumber: 'desc' },
          });
          await tx.fileAsset.create({
            data: {
              id: assetId,
              organizationId: orgId,
              uploadedById: authorUserId,
              bucket: 'test',
              objectKey: `${paperId}/${name}`,
              sizeBytes: 10,
              checksumSha256: 'a'.repeat(64),
              mimeType: 'application/pdf',
              originalFilename: name,
              scanStatus: 'PENDING_SCAN',
            },
          });
          await tx.paperVersion.create({
            data: {
              id: versionId,
              paperId,
              fileAssetId: assetId,
              uploadedById: authorUserId,
              kind: 'REVISION',
              versionNumber: (latest?.versionNumber ?? 0) + 1,
            },
          });
        });
        return { assetId, versionId };
      };

      const older = await file('older.pdf');
      const newer = await file('newer.pdf');
      await applyScanResult({
        fileAssetId: newer.assetId,
        paperVersionId: newer.versionId,
        paperId,
        scanStatus: 'CLEAN',
      });
      await applyScanResult({
        fileAssetId: older.assetId,
        paperVersionId: older.versionId,
        paperId,
        scanStatus: 'CLEAN',
      });

      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(paper?.currentVersionId).toBe(newer.versionId);
      expect(await prisma.reviewRound.count({ where: { paperId } })).toBe(2);
    });
  });
});
