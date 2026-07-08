import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
import { resetLastTestNotification } from '../../src/messaging/notification.service.ts';
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

    await withTenantContext({ bypass: true }, async (tx) => {
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
            status: 'CFP_OPEN',
          },
          {
            id: confBId,
            organizationId: orgId,
            slug: 'sub-conf-b',
            name: 'Submission Conf B',
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

    const submit = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/submit`)
      .set('Cookie', authorCookie);

    expect(submit.status).toBe(200);
    expect(submit.body.paper.status).toBe('SUBMITTED');
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

  describe('Phase 7 — camera-ready', () => {
    let acceptedPaperId = '';
    let unnotifiedPaperId = '';
    let rejectedPaperId = '';
    let lateDeadlinePaperId = '';

    beforeAll(async () => {
      const cameraReadyDue = new Date(Date.now() + 86_400_000 * 14);

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.conference.update({
          where: { id: confId },
          data: { cameraReadyDueAt: cameraReadyDue },
        });

        const roundId = generateId();

        await tx.reviewRound.create({
          data: {
            id: roundId,
            organizationId: orgId,
            conferenceId: confId,
            roundNumber: 99,
            status: 'CLOSED',
          },
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

        await tx.decision.createMany({
          data: [
            {
              id: generateId(),
              organizationId: orgId,
              conferenceId: confId,
              paperId: acceptedPaperId,
              roundId,
              decidedById: authorUserId,
              outcome: 'ACCEPT',
              notifiedAt: new Date(),
              version: 1,
            },
            {
              id: generateId(),
              organizationId: orgId,
              conferenceId: confId,
              paperId: unnotifiedPaperId,
              roundId,
              decidedById: authorUserId,
              outcome: 'ACCEPT',
              notifiedAt: null,
              version: 1,
            },
            {
              id: generateId(),
              organizationId: orgId,
              conferenceId: confId,
              paperId: rejectedPaperId,
              roundId,
              decidedById: authorUserId,
              outcome: 'REJECT',
              notifiedAt: new Date(),
              version: 1,
            },
            {
              id: generateId(),
              organizationId: orgId,
              conferenceId: confId,
              paperId: lateDeadlinePaperId,
              roundId,
              decidedById: authorUserId,
              outcome: 'ACCEPT',
              notifiedAt: new Date(),
              version: 1,
            },
          ],
        });
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
      await withTenantContext({ bypass: true }, async (tx) => {
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

      await withTenantContext({ bypass: true }, async (tx) => {
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

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.reviewRound.create({
          data: {
            id: roundId,
            organizationId: orgId,
            conferenceId: confId,
            roundNumber: 100,
            status: 'CLOSED',
          },
        });

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
});
