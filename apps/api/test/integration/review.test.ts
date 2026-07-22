import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
import {
  resetLastTestNotification,
  lastTestNotification,
} from '../../src/messaging/notification.service.ts';
import { ensureNotificationTemplates } from '../helpers/notifications.ts';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';

const config = getConfig();

function extractCookies(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

function extractReviewerJoinUrlFromEmail(html: string): string | null {
  const match = html.match(/href="([^"]*\/join\/reviewer[^"]*)"/);
  return match?.[1]?.replace(/&amp;/g, '&') ?? null;
}

function buildMagicLinkVerifyPath(joinUrl: string): string {
  const parsed = new URL(joinUrl);
  const magicToken = parsed.searchParams.get('token');
  const invitationToken = parsed.searchParams.get('invitationToken');

  if (!magicToken || !invitationToken) {
    throw new Error('Reviewer join URL is missing token parameters');
  }

  const callbackURL = new URL('/join/reviewer/complete', config.webUrl);
  callbackURL.searchParams.set('invitationToken', invitationToken);

  const errorCallbackURL = new URL('/join/reviewer/error', config.webUrl);

  const verifyUrl = new URL('/api/v1/auth/magic-link/verify', config.auth.url);
  verifyUrl.searchParams.set('token', magicToken);
  verifyUrl.searchParams.set('callbackURL', callbackURL.toString());
  verifyUrl.searchParams.set('errorCallbackURL', errorCallbackURL.toString());

  return verifyUrl.pathname + verifyUrl.search;
}

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

describe('Reviewer management & assignment integration', () => {
  let app: INestApplication;

  const orgId = generateId();
  const confId = generateId();
  const confSingleId = generateId();
  const confBId = generateId();
  const trackId = generateId();
  const trackSingleId = generateId();
  const trackBId = generateId();
  const paperId = generateId();
  const authorPaperId = generateId();

  const chairEmail = `chair-rev-${Date.now()}@example.com`;
  const reviewerEmail = `reviewer-rev-${Date.now()}@example.com`;
  const inviteeEmail = `invitee-rev-${Date.now()}@example.com`;
  const authorReviewerEmail = `author-reviewer-${Date.now()}@example.com`;
  const outsiderEmail = `outsider-rev-${Date.now()}@example.com`;

  let chairUserId = '';
  let reviewerUserId = '';
  let authorReviewerUserId = '';
  let chairCookie = '';
  let reviewerCookie = '';
  let authorReviewerCookie = '';
  let inviteeCookie = '';
  let outsiderCookie = '';
  let roundId = '';
  let assignmentId = '';
  let inviteeUserId = '';
  let invitationToken = '';

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

    const chair = await createUserWithSession(app, chairEmail, 'Chair');
    const reviewer = await createUserWithSession(app, reviewerEmail, 'Reviewer');
    const authorReviewer = await createUserWithSession(app, authorReviewerEmail, 'Author Reviewer');
    const invitee = await createUserWithSession(app, inviteeEmail, 'Invitee');
    const outsider = await createUserWithSession(app, outsiderEmail, 'Outsider');

    chairUserId = chair.userId;
    reviewerUserId = reviewer.userId;
    authorReviewerUserId = authorReviewer.userId;
    chairCookie = chair.cookie;
    reviewerCookie = reviewer.cookie;
    authorReviewerCookie = authorReviewer.cookie;
    inviteeUserId = invitee.userId;
    inviteeCookie = invitee.cookie;
    outsiderCookie = outsider.cookie;

    await prisma.user.update({
      where: { id: chairUserId },
      data: { twoFactorEnabled: true },
    });

    const biddingOpen = new Date(Date.now() - 86_400_000);
    const biddingClose = new Date(Date.now() + 86_400_000 * 30);

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `rev-org-${Date.now()}`, name: 'Review Org' },
      });

      await tx.conference.createMany({
        data: [
          {
            id: confId,
            organizationId: orgId,
            slug: 'rev-conf-double',
            name: 'Review Conf Double',
            authorJoinToken: generateId(),
            status: 'REVIEWING',
            blindingMode: 'DOUBLE',
            biddingOpensAt: biddingOpen,
            biddingClosesAt: biddingClose,
          },
          {
            id: confSingleId,
            organizationId: orgId,
            slug: 'rev-conf-single',
            name: 'Review Conf Single',
            authorJoinToken: generateId(),
            status: 'REVIEWING',
            blindingMode: 'SINGLE',
            biddingOpensAt: biddingOpen,
            biddingClosesAt: biddingClose,
          },
          {
            id: confBId,
            organizationId: orgId,
            slug: 'rev-conf-b',
            name: 'Review Conf B',
            authorJoinToken: generateId(),
            status: 'REVIEWING',
            blindingMode: 'DOUBLE',
            biddingOpensAt: biddingOpen,
            biddingClosesAt: biddingClose,
          },
        ],
      });

      await tx.track.createMany({
        data: [
          {
            id: trackId,
            conferenceId: confId,
            organizationId: orgId,
            slug: 'main',
            name: 'Main',
          },
          {
            id: trackSingleId,
            conferenceId: confSingleId,
            organizationId: orgId,
            slug: 'main-single',
            name: 'Main Single',
          },
        ],
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: chairUserId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: {
            create: [
              { id: generateId(), role: 'CHAIR' },
              { id: generateId(), role: 'ORGANIZER' },
            ],
          },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: chairUserId,
          organizationId: orgId,
          conferenceId: confSingleId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'CHAIR' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: reviewerUserId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'REVIEWER' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: reviewerUserId,
          organizationId: orgId,
          conferenceId: confSingleId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'REVIEWER' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: authorReviewerUserId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: {
            create: [
              { id: generateId(), role: 'AUTHOR' },
              { id: generateId(), role: 'REVIEWER' },
            ],
          },
        },
      });

      await tx.paper.create({
        data: {
          id: paperId,
          organizationId: orgId,
          conferenceId: confId,
          trackId,
          submittedById: authorReviewerUserId,
          title: 'Submitted Paper for Review',
          abstract: 'A paper ready for bidding and assignment.',
          keywords: ['review'],
          status: 'SUBMITTED',
          authorships: {
            create: {
              id: generateId(),
              userId: null,
              order: 1,
              isCorresponding: true,
              fullName: 'Hidden Author',
              email: 'hidden-author@example.com',
              affiliation: 'Test U',
            },
          },
        },
      });

      await tx.paper.create({
        data: {
          id: authorPaperId,
          organizationId: orgId,
          conferenceId: confId,
          trackId,
          submittedById: authorReviewerUserId,
          title: 'Author Reviewer Own Paper',
          abstract: 'Paper authored by dual-role user.',
          keywords: ['coi'],
          status: 'SUBMITTED',
          authorships: {
            create: {
              id: generateId(),
              userId: authorReviewerUserId,
              order: 1,
              isCorresponding: true,
              fullName: 'Author Reviewer',
              email: authorReviewerEmail,
            },
          },
        },
      });

      await tx.paper.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          conferenceId: confSingleId,
          trackId: trackSingleId,
          submittedById: authorReviewerUserId,
          title: 'Single Blinding Paper',
          abstract: 'For single blinding test.',
          keywords: ['single'],
          status: 'SUBMITTED',
          authorships: {
            create: {
              id: generateId(),
              userId: null,
              order: 1,
              isCorresponding: true,
              fullName: 'Visible Author',
              email: 'visible@example.com',
            },
          },
        },
      });
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('opens review round 1 (chair, MFA-gated)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/rounds`)
      .set('Cookie', chairCookie)
      .send({ roundNumber: 1 });

    expect(res.status).toBe(201);
    expect(res.body.roundNumber).toBe(1);
    expect(res.body.status).toBe('OPEN');
    roundId = res.body.id as string;
  });

  it('opens review round as organizer without CHAIR role', async () => {
    const organizerEmail = `organizer-only-${Date.now()}@example.com`;
    const user = await createUserWithSession(app, organizerEmail, 'Organizer Only');

    await prisma.user.update({
      where: { id: user.userId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.membership.create({
        data: {
          id: generateId(),
          userId: user.userId,
          organizationId: orgId,
          conferenceId: confBId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'ORGANIZER' } },
        },
      });
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/rounds`)
      .set('Cookie', user.cookie)
      .send({ roundNumber: 1 });

    expect(res.status).toBe(201);
    expect(res.body.roundNumber).toBe(1);
  });

  it('opens review round as org admin inherited from organization membership', async () => {
    const orgAdminEmail = `org-admin-only-${Date.now()}@example.com`;
    const user = await createUserWithSession(app, orgAdminEmail, 'Org Admin Only');

    await prisma.user.update({
      where: { id: user.userId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.membership.create({
        data: {
          id: generateId(),
          userId: user.userId,
          organizationId: orgId,
          scope: 'ORGANIZATION',
          roles: { create: { id: generateId(), role: 'ORG_ADMIN' } },
        },
      });
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/rounds`)
      .set('Cookie', user.cookie)
      .send({ roundNumber: 2 });

    expect(res.status).toBe(201);
    expect(res.body.roundNumber).toBe(2);
  });

  it('rejects round creation without MFA for chair role', async () => {
    const noMfaEmail = `no-mfa-chair-${Date.now()}@example.com`;
    const user = await createUserWithSession(app, noMfaEmail, 'No MFA Chair');

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.membership.create({
        data: {
          id: generateId(),
          userId: user.userId,
          organizationId: orgId,
          conferenceId: confBId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'CHAIR' } },
        },
      });
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/rounds`)
      .set('Cookie', user.cookie)
      .send({ roundNumber: 3 });

    expect(res.status).toBe(403);
  });

  it('issues reviewer invitation and sends email', async () => {
    resetLastTestNotification();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations`)
      .set('Cookie', chairCookie)
      .send({ email: inviteeEmail, roleNote: 'Please review ML papers' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(inviteeEmail.toLowerCase());
    expect(res.body.status).toBe('PENDING');
    expect(lastTestNotification?.to).toBe(inviteeEmail.toLowerCase());
    expect(lastTestNotification?.html).toContain('/join/reviewer');
    expect(lastTestNotification?.html).not.toContain('magic-link');
    expect(lastTestNotification?.html).not.toContain('/sign-up?');

    const invitation = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findFirst({ where: { email: inviteeEmail.toLowerCase() } }),
    );
    invitationToken = invitation?.token ?? '';
    expect(invitationToken.length).toBeGreaterThanOrEqual(32);
  });

  it('resends a pending reviewer invitation email', async () => {
    resetLastTestNotification();

    const invitation = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findFirst({ where: { email: inviteeEmail.toLowerCase() } }),
    );
    expect(invitation?.id).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations/${invitation!.id}/resend`)
      .set('Cookie', chairCookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('resent');
    expect(res.body.invitation.status).toBe('PENDING');
    expect(lastTestNotification?.to).toBe(inviteeEmail.toLowerCase());
    expect(lastTestNotification?.html).toContain('/join/reviewer');
    expect(lastTestNotification?.html).not.toContain('magic-link');
  });

  it('revokes a pending reviewer invitation', async () => {
    const revokeEmail = `revoke-${Date.now()}@example.com`;

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations`)
      .set('Cookie', chairCookie)
      .send({ email: revokeEmail });

    expect(createRes.status).toBe(201);
    const invitationId = createRes.body.id as string;

    const revokeRes = await request(app.getHttpServer())
      .delete(`/api/v1/conferences/${confId}/reviewer-invitations/${invitationId}`)
      .set('Cookie', chairCookie)
      .send();

    expect(revokeRes.status).toBe(204);

    const invitation = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findFirst({ where: { id: invitationId } }),
    );
    expect(invitation).toBeNull();
  });

  it('completes reviewer onboarding via magic link and accepts invitation', async () => {
    expect(lastTestNotification?.html).toBeTruthy();
    const joinUrl = extractReviewerJoinUrlFromEmail(lastTestNotification!.html);
    expect(joinUrl).toBeTruthy();

    const verifyPath = buildMagicLinkVerifyPath(joinUrl!);

    const verifyRes = await request(app.getHttpServer())
      .get(verifyPath)
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000');

    expect(verifyRes.status).toBeGreaterThanOrEqual(200);
    expect(verifyRes.status).toBeLessThan(400);

    const magicCookie = extractCookies(verifyRes.headers['set-cookie']);
    expect(magicCookie.length).toBeGreaterThan(0);
    inviteeCookie = magicCookie;

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/reviewer-invitations/accept')
      .set('Cookie', magicCookie)
      .send({ token: invitationToken });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.invitation.status).toBe('ACCEPTED');

    const membership = await withTenantContext({ bypass: true }, async (tx) =>
      tx.membership.findFirst({
        where: { userId: inviteeUserId, conferenceId: confId },
        include: { roles: true },
      }),
    );

    expect(membership?.roles.some((r) => r.role === 'REVIEWER')).toBe(true);
  });

  it('accepts pending invitations for signed-in user email when none remain', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviewer-invitations/accept-pending')
      .set('Cookie', inviteeCookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.message).toContain('No pending');
  });

  it('accepts pending invitations for signed-in user email (legacy path)', async () => {
    const legacyEmail = `legacy-invitee-${Date.now()}@example.com`;
    resetLastTestNotification();

    const legacyInvitee = await createUserWithSession(app, legacyEmail, 'Legacy Invitee');

    const issueRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations`)
      .set('Cookie', chairCookie)
      .send({ email: legacyEmail });

    expect(issueRes.status).toBe(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/reviewer-invitations/accept-pending')
      .set('Cookie', legacyInvitee.cookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('ACCEPTED');

    const membership = await withTenantContext({ bypass: true }, async (tx) =>
      tx.membership.findFirst({
        where: { userId: legacyInvitee.userId, conferenceId: confId },
        include: { roles: true },
      }),
    );

    expect(membership?.roles.some((r) => r.role === 'REVIEWER')).toBe(true);
  });

  it('accepts an already-accepted invitation idempotently for the same user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviewer-invitations/accept')
      .set('Cookie', inviteeCookie)
      .send({ token: invitationToken });

    expect(res.status).toBe(200);
    expect(res.body.invitation.status).toBe('ACCEPTED');
    expect(res.body.message).toContain('already accepted');
  });

  it('cannot resend an accepted reviewer invitation', async () => {
    const invitation = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findFirst({ where: { email: inviteeEmail.toLowerCase() } }),
    );
    expect(invitation?.id).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations/${invitation!.id}/resend`)
      .set('Cookie', chairCookie)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('no longer pending');
  });

  it('cannot revoke an accepted reviewer invitation', async () => {
    const acceptedEmail = `accepted-revoke-${Date.now()}@example.com`;

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/reviewer-invitations`)
      .set('Cookie', chairCookie)
      .send({ email: acceptedEmail });

    expect(createRes.status).toBe(201);
    const invitationId = createRes.body.id as string;

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.reviewerInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      });
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/conferences/${confId}/reviewer-invitations/${invitationId}`)
      .set('Cookie', chairCookie)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('pending');
  });

  it('hides author identities in DOUBLE blinding paper pool', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/review/paper-pool`)
      .set('Cookie', reviewerCookie);

    expect(res.status).toBe(200);
    expect(res.body.blindingMode).toBe('DOUBLE');
    expect(res.body.mode).toBe('reviewer');
    const item = res.body.data.find((p: { id: string }) => p.id === paperId);
    expect(item).toBeTruthy();
    expect(item.authorships).toBeUndefined();
  });

  it('allows chair to view paper pool in oversight mode', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/review/paper-pool`)
      .set('Cookie', chairCookie);

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('oversight');
    expect(res.body.data.length).toBeGreaterThan(0);
    const item = res.body.data.find((p: { id: string }) => p.id === paperId);
    expect(item?.authorships?.length).toBeGreaterThan(0);
  });

  it('shows author identities in SINGLE blinding paper pool', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confSingleId}/review/paper-pool`)
      .set('Cookie', reviewerCookie);

    expect(res.status).toBe(200);
    expect(res.body.blindingMode).toBe('SINGLE');
    expect(res.body.data[0]?.authorships?.length).toBeGreaterThan(0);
  });

  it('allows reviewer to bid on a paper', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/conferences/${confId}/papers/${paperId}/bids`)
      .set('Cookie', reviewerCookie)
      .send({ value: 'YES' });

    expect(res.status).toBe(200);
    expect(res.body.value).toBe('YES');
  });

  it('blocks assignment when reviewer is paper author (COI authorship)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${authorPaperId}/assignments`)
      .set('Cookie', chairCookie)
      .send({ roundId, reviewerUserId: authorReviewerUserId });

    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/author/i);
  });

  it('blocks assignment when declared COI exists', async () => {
    const declare = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/conflicts-of-interest`)
      .set('Cookie', reviewerCookie)
      .send({ paperId, type: 'PERSONAL', note: 'Collaborated last year' });

    expect(declare.status).toBe(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/assignments`)
      .set('Cookie', chairCookie)
      .send({ roundId, reviewerUserId: reviewerUserId });

    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/conflict/i);

    await request(app.getHttpServer())
      .delete(`/api/v1/conferences/${confId}/conflicts-of-interest/${declare.body.id}`)
      .set('Cookie', reviewerCookie);
  });

  it('assigns reviewer when COI checks pass and sends email', async () => {
    resetLastTestNotification();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperId}/assignments`)
      .set('Cookie', chairCookie)
      .send({ roundId, reviewerUserId: reviewerUserId });

    expect(res.status).toBe(201);
    expect(res.body.assignment.reviewerUserId).toBe(reviewerUserId);
    assignmentId = res.body.assignment.id;
    expect(lastTestNotification?.to).toBe(reviewerEmail);
    expect(lastTestNotification?.templateKey).toBe('assignment.notified');
  });

  it('allows assigned reviewer to download the current CLEAN paper version', async () => {
    const fileAssetId = generateId();
    const versionId = generateId();
    const otherVersionId = generateId();
    const otherFileAssetId = generateId();

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.fileAsset.create({
        data: {
          id: fileAssetId,
          organizationId: orgId,
          uploadedById: authorReviewerUserId,
          bucket: 'test-bucket',
          objectKey: `test/${fileAssetId}.pdf`,
          sizeBytes: 1024n,
          checksumSha256: 'a'.repeat(64),
          mimeType: 'application/pdf',
          originalFilename: 'assigned-paper.pdf',
          scanStatus: 'CLEAN',
        },
      });
      await tx.paperVersion.create({
        data: {
          id: versionId,
          paperId,
          fileAssetId,
          uploadedById: authorReviewerUserId,
          kind: 'SUBMISSION',
          versionNumber: 1,
        },
      });
      await tx.fileAsset.create({
        data: {
          id: otherFileAssetId,
          organizationId: orgId,
          uploadedById: authorReviewerUserId,
          bucket: 'test-bucket',
          objectKey: `test/${otherFileAssetId}.pdf`,
          sizeBytes: 2048n,
          checksumSha256: 'b'.repeat(64),
          mimeType: 'application/pdf',
          originalFilename: 'older.pdf',
          scanStatus: 'CLEAN',
        },
      });
      await tx.paperVersion.create({
        data: {
          id: otherVersionId,
          paperId,
          fileAssetId: otherFileAssetId,
          uploadedById: authorReviewerUserId,
          kind: 'SUBMISSION',
          versionNumber: 2,
          note: 'Not current',
        },
      });
      await tx.paper.update({
        where: { id: paperId },
        data: { currentVersionId: versionId },
      });
    });

    const ok = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}/versions/${versionId}/download`)
      .set('Cookie', reviewerCookie);

    expect(ok.status).toBe(200);
    expect(ok.body.downloadUrl).toBeTruthy();
    expect(ok.body.expiresInSeconds).toBeGreaterThan(0);

    const deniedOtherVersion = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}/versions/${otherVersionId}/download`)
      .set('Cookie', reviewerCookie);
    expect(deniedOtherVersion.status).toBe(404);

    const deniedOutsider = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperId}/versions/${versionId}/download`)
      .set('Cookie', outsiderCookie);
    expect([403, 404]).toContain(deniedOutsider.status);

    const reviewPayload = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review`)
      .set('Cookie', reviewerCookie);
    expect(reviewPayload.status).toBe(200);
    expect(reviewPayload.body.currentVersionId).toBe(versionId);
    expect(reviewPayload.body.paperTitle).toBeTruthy();
  });

  it('rejects assignment when reviewer bid CONFLICT', async () => {
    const secondPaperId = generateId();
    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.paper.create({
        data: {
          id: secondPaperId,
          organizationId: orgId,
          conferenceId: confId,
          trackId,
          submittedById: authorReviewerUserId,
          title: 'Second Paper',
          abstract: 'Another paper.',
          keywords: [],
          status: 'SUBMITTED',
          authorships: {
            create: {
              id: generateId(),
              userId: null,
              order: 1,
              isCorresponding: true,
              fullName: 'Other Author',
              email: 'other@example.com',
            },
          },
        },
      });
    });

    await request(app.getHttpServer())
      .put(`/api/v1/conferences/${confId}/papers/${secondPaperId}/bids`)
      .set('Cookie', reviewerCookie)
      .send({ value: 'CONFLICT' });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${secondPaperId}/assignments`)
      .set('Cookie', chairCookie)
      .send({ roundId, reviewerUserId: reviewerUserId });

    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/CONFLICT/i);
  });

  it('advances round lifecycle', async () => {
    const round = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/rounds`)
      .set('Cookie', chairCookie);

    const current = round.body.data[0];
    expect(current.status).toBe('OPEN');

    const update = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confId}/rounds/${current.id}`)
      .set('Cookie', chairCookie)
      .send({ status: 'REVIEWING', version: current.version });

    expect(update.status).toBe(200);
    expect(update.body.status).toBe('REVIEWING');
  });

  it('returns 404 for cross-conference assignment list (IDOR)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/rounds/${roundId}/assignments`)
      .set('Cookie', chairCookie);

    expect(res.status).toBe(404);
  });

  it('prevents outsider from bidding', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/conferences/${confId}/papers/${paperId}/bids`)
      .set('Cookie', outsiderCookie)
      .send({ value: 'YES' });

    expect([403, 404]).toContain(res.status);
  });

  describe('Phase 5 — reviews and rebuttals', () => {
    it('lists reviewer assignments with review status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/review/my-assignments`)
        .set('Cookie', reviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.some((a: { id: string }) => a.id === assignmentId)).toBe(true);
    });

    it('blocks non-assigned reviewer from saving a review', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review`)
        .set('Cookie', outsiderCookie)
        .send({
          scores: { originality: 4 },
          recommendation: 'ACCEPT',
          commentsToAuthors: 'Good paper',
          version: 0,
        });

      expect([403, 404]).toContain(res.status);
    });

    it('allows assigned reviewer to save and submit a review', async () => {
      const save = await request(app.getHttpServer())
        .put(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review`)
        .set('Cookie', reviewerCookie)
        .send({
          scores: { originality: 4, clarity: 3, significance: 4 },
          recommendation: 'WEAK_ACCEPT',
          confidence: 4,
          commentsToAuthors: 'Solid contribution with minor clarity issues.',
          commentsToChairs: 'Recommend accept if space allows.',
          version: 0,
        });

      expect(save.status).toBe(200);
      expect(save.body.recommendation).toBe('WEAK_ACCEPT');
      expect(save.body.version).toBe(1);
    });

    it('returns 409 on concurrent review save with stale version', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review`)
        .set('Cookie', reviewerCookie)
        .send({
          scores: { originality: 2 },
          recommendation: 'REJECT',
          commentsToAuthors: 'Stale edit',
          version: 0,
        });

      expect(res.status).toBe(409);
    });

    it('submits a completed review', async () => {
      const current = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review`)
        .set('Cookie', reviewerCookie);

      expect(current.status).toBe(200);

      const submit = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/assignments/${assignmentId}/review/submit`)
        .set('Cookie', reviewerCookie)
        .send({ version: current.body.version });

      expect(submit.status).toBe(200);
      expect(submit.body.review.submittedAt).toBeTruthy();
    });

    it('hides reviews from authors until released', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}/reviews`)
        .set('Cookie', authorReviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('releases reviews to authors and opens rebuttal phase', async () => {
      resetLastTestNotification();

      const rounds = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/rounds`)
        .set('Cookie', chairCookie);

      const round = rounds.body.data[0];

      const release = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/rounds/${round.id}/reviews/release`)
        .set('Cookie', chairCookie)
        .send({ version: round.version });

      expect(release.status).toBe(200);
      expect(release.body.releasedCount).toBeGreaterThan(0);
      expect(release.body.round.status).toBe('REBUTTAL');
      expect(lastTestNotification?.templateKey).toBe('review.released');

      const authorView = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}/reviews`)
        .set('Cookie', authorReviewerCookie);

      expect(authorView.status).toBe(200);
      expect(authorView.body.data).toHaveLength(1);
      expect(authorView.body.data[0].reviewerUserId).toBeUndefined();
      expect(authorView.body.data[0].commentsToChairs).toBeUndefined();
    });

    it('blocks rebuttal before reviews are visible to authors', async () => {
      const secondPaperId = generateId();
      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.paper.create({
          data: {
            id: secondPaperId,
            organizationId: orgId,
            conferenceId: confId,
            trackId,
            submittedById: authorReviewerUserId,
            title: 'No Release Paper',
            abstract: 'Paper without released reviews.',
            keywords: [],
            status: 'UNDER_REVIEW',
            authorships: {
              create: {
                id: generateId(),
                userId: authorReviewerUserId,
                order: 1,
                isCorresponding: true,
                fullName: 'Author Reviewer',
                email: authorReviewerEmail,
              },
            },
          },
        });
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${secondPaperId}/rebuttal`)
        .set('Cookie', authorReviewerCookie)
        .send({ body: 'Should not work yet.' });

      expect(res.status).toBe(409);
    });

    it('allows corresponding author to submit rebuttal during REBUTTAL phase', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/rebuttal`)
        .set('Cookie', authorReviewerCookie)
        .send({ body: 'We clarified the experimental setup in section 3.' });

      expect(res.status).toBe(200);
      expect(res.body.rebuttal.body).toContain('experimental setup');

      const reviewerView = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}/rebuttal`)
        .set('Cookie', reviewerCookie);

      expect(reviewerView.status).toBe(200);
      expect(reviewerView.body.body).toContain('experimental setup');
    });

    it('blocks review save when reviewer declares COI after assignment', async () => {
      const coiPaperId = generateId();
      const coiAssignmentId = generateId();

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.paper.create({
          data: {
            id: coiPaperId,
            organizationId: orgId,
            conferenceId: confId,
            trackId,
            submittedById: authorReviewerUserId,
            title: 'COI Review Paper',
            abstract: 'For COI write test.',
            keywords: [],
            status: 'UNDER_REVIEW',
            authorships: {
              create: {
                id: generateId(),
                userId: null,
                order: 1,
                isCorresponding: true,
                fullName: 'Someone',
                email: 'someone@example.com',
              },
            },
          },
        });

        await tx.reviewerAssignment.create({
          data: {
            id: coiAssignmentId,
            organizationId: orgId,
            conferenceId: confId,
            roundId,
            paperId: coiPaperId,
            reviewerUserId,
            status: 'ASSIGNED',
          },
        });

        await tx.conflictOfInterest.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            userId: reviewerUserId,
            paperId: coiPaperId,
            type: 'PERSONAL',
            source: 'SELF',
            note: 'Conflict discovered after assignment',
          },
        });
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/conferences/${confId}/assignments/${coiAssignmentId}/review`)
        .set('Cookie', reviewerCookie)
        .send({
          scores: { originality: 3 },
          recommendation: 'BORDERLINE',
          commentsToAuthors: 'Cannot review due to COI.',
          version: 0,
        });

      expect(res.status).toBe(409);
      expect(res.body.detail).toMatch(/conflict/i);
    });
  });

  describe('Phase 6 — decisions', () => {
    beforeAll(async () => {
      await withTenantContext({ bypass: true }, async (tx) => {
        const existingTrack = await tx.track.findFirst({ where: { conferenceId: confBId } });
        if (!existingTrack) {
          await tx.track.create({
            data: {
              id: trackBId,
              conferenceId: confBId,
              organizationId: orgId,
              slug: 'main-b',
              name: 'Main B',
            },
          });
        }

        const existing = await tx.membership.findFirst({
          where: { userId: chairUserId, conferenceId: confBId },
        });
        if (!existing) {
          await tx.membership.create({
            data: {
              id: generateId(),
              userId: chairUserId,
              organizationId: orgId,
              conferenceId: confBId,
              scope: 'CONFERENCE',
              roles: { create: { id: generateId(), role: 'CHAIR' } },
            },
          });
        }

        const reviewerMembership = await tx.membership.findFirst({
          where: { userId: reviewerUserId, conferenceId: confBId },
        });
        if (!reviewerMembership) {
          await tx.membership.create({
            data: {
              id: generateId(),
              userId: reviewerUserId,
              organizationId: orgId,
              conferenceId: confBId,
              scope: 'CONFERENCE',
              roles: { create: { id: generateId(), role: 'REVIEWER' } },
            },
          });
        }
      });
    });

    it('rejects decision without MFA for chair role', async () => {
      const noMfaEmail = `no-mfa-decide-${Date.now()}@example.com`;
      const user = await createUserWithSession(app, noMfaEmail, 'No MFA Decide Chair');

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.membership.create({
          data: {
            id: generateId(),
            userId: user.userId,
            organizationId: orgId,
            conferenceId: confBId,
            scope: 'CONFERENCE',
            roles: { create: { id: generateId(), role: 'CHAIR' } },
          },
        });
      });

      const paper = await prisma.paper.findFirst({ where: { conferenceId: confId } });
      expect(paper).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paper!.id}/decision`)
        .set('Cookie', user.cookie)
        .send({ roundId, outcome: 'ACCEPT', version: paper!.version });

      expect(res.status).toBe(403);
    });

    it('rejects author from making a decision', async () => {
      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(paper).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/decision`)
        .set('Cookie', authorReviewerCookie)
        .send({ roundId, outcome: 'ACCEPT', version: paper!.version });

      expect(res.status).toBe(403);
    });

    it('returns 409 on stale paper version when deciding', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/decision`)
        .set('Cookie', chairCookie)
        .send({ roundId, outcome: 'ACCEPT', version: 0 });

      expect(res.status).toBe(409);
    });

    it('records ACCEPT, notifies authors, and sets paper DECISION_MADE', async () => {
      resetLastTestNotification();

      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(paper).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/decision`)
        .set('Cookie', chairCookie)
        .send({
          roundId,
          outcome: 'ACCEPT',
          rationale: 'Strong contribution to the field.',
          version: paper!.version,
        });

      expect(res.status).toBe(201);
      expect(res.body.decision.outcome).toBe('ACCEPT');
      expect(lastTestNotification?.templateKey).toBe('decision.notified');

      const updated = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(updated?.status).toBe('DECISION_MADE');
    });

    it('enforces one decision per paper per round', async () => {
      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      expect(paper).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/decision`)
        .set('Cookie', chairCookie)
        .send({ roundId, outcome: 'REJECT', version: paper!.version });

      expect(res.status).toBe(409);
    });

    it('allows author to read decision after notification', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/conferences/${confId}/papers/${paperId}/decision`)
        .set('Cookie', authorReviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('ACCEPT');
      expect(res.body.rationale).toContain('Strong contribution');
    });

    it('opens next review round on MINOR_REVISION', async () => {
      const revisionPaperId = generateId();
      let revisionRoundId = '';

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.paper.create({
          data: {
            id: revisionPaperId,
            organizationId: orgId,
            conferenceId: confBId,
            trackId: trackBId,
            submittedById: authorReviewerUserId,
            title: 'Revision Decision Paper',
            abstract: 'Paper for revision outcome test.',
            keywords: ['revision'],
            status: 'UNDER_REVIEW',
            authorships: {
              create: {
                id: generateId(),
                userId: authorReviewerUserId,
                order: 1,
                isCorresponding: true,
                fullName: 'Revision Author',
                email: authorReviewerEmail,
              },
            },
          },
        });
      });

      const roundRes = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/rounds`)
        .set('Cookie', chairCookie)
        .send({ roundNumber: 10 });

      expect(roundRes.status).toBe(201);
      revisionRoundId = roundRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/conferences/${confBId}/rounds/${revisionRoundId}`)
        .set('Cookie', chairCookie)
        .send({ status: 'REVIEWING', version: roundRes.body.version });

      await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/papers/${revisionPaperId}/assignments`)
        .set('Cookie', chairCookie)
        .send({ roundId: revisionRoundId, reviewerUserId });

      await request(app.getHttpServer())
        .patch(`/api/v1/conferences/${confBId}/rounds/${revisionRoundId}`)
        .set('Cookie', chairCookie)
        .send({ status: 'REBUTTAL', version: 1 });

      const paper = await prisma.paper.findUnique({ where: { id: revisionPaperId } });
      expect(paper).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/papers/${revisionPaperId}/decision`)
        .set('Cookie', chairCookie)
        .send({
          roundId: revisionRoundId,
          outcome: 'MINOR_REVISION',
          rationale: 'Address reviewer comments and resubmit.',
          version: paper!.version,
          notify: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.decision.outcome).toBe('MINOR_REVISION');
      expect(res.body.nextRound).toBeTruthy();
      expect(res.body.nextRound.roundNumber).toBe(11);

      const closedRound = await prisma.reviewRound.findUnique({ where: { id: revisionRoundId } });
      expect(closedRound?.status).toBe('CLOSED');

      const updatedPaper = await prisma.paper.findUnique({ where: { id: revisionPaperId } });
      expect(updatedPaper?.status).toBe('UNDER_REVIEW');
    });

    it('rolls back bulk decisions when one item is invalid', async () => {
      const bulkPaper1Id = generateId();
      const bulkPaper2Id = generateId();
      let bulkRoundId = '';

      await withTenantContext({ bypass: true }, async (tx) => {
        await tx.paper.createMany({
          data: [
            {
              id: bulkPaper1Id,
              organizationId: orgId,
              conferenceId: confBId,
              trackId: trackBId,
              submittedById: authorReviewerUserId,
              title: 'Bulk Paper One',
              abstract: 'First bulk paper.',
              keywords: [],
              status: 'UNDER_REVIEW',
            },
            {
              id: bulkPaper2Id,
              organizationId: orgId,
              conferenceId: confBId,
              trackId: trackBId,
              submittedById: authorReviewerUserId,
              title: 'Bulk Paper Two',
              abstract: 'Second bulk paper.',
              keywords: [],
              status: 'UNDER_REVIEW',
            },
          ],
        });
      });

      const roundRes = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/rounds`)
        .set('Cookie', chairCookie)
        .send({ roundNumber: 20 });

      expect(roundRes.status).toBe(201);
      bulkRoundId = roundRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/conferences/${confBId}/rounds/${bulkRoundId}`)
        .set('Cookie', chairCookie)
        .send({ status: 'REVIEWING', version: roundRes.body.version });

      await request(app.getHttpServer())
        .patch(`/api/v1/conferences/${confBId}/rounds/${bulkRoundId}`)
        .set('Cookie', chairCookie)
        .send({ status: 'REBUTTAL', version: 1 });

      await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/papers/${bulkPaper1Id}/assignments`)
        .set('Cookie', chairCookie)
        .send({ roundId: bulkRoundId, reviewerUserId });

      const invalidPaperId = generateId();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confBId}/rounds/${bulkRoundId}/decisions/bulk`)
        .set('Cookie', chairCookie)
        .send({
          items: [
            { paperId: bulkPaper1Id, outcome: 'ACCEPT' },
            { paperId: invalidPaperId, outcome: 'REJECT' },
          ],
          notify: false,
        });

      expect(res.status).toBe(404);

      const decisions = await prisma.decision.findMany({
        where: { roundId: bulkRoundId },
      });
      expect(decisions).toHaveLength(0);
    });
  });

  it('copies reviewer assignments from the previous round', async () => {
    const copyPaperId = generateId();
    let priorRoundId = '';

    await withTenantContext({ bypass: true }, async (tx) => {
      const existingTrack = await tx.track.findFirst({ where: { conferenceId: confBId } });
      if (!existingTrack) {
        await tx.track.create({
          data: {
            id: trackBId,
            conferenceId: confBId,
            organizationId: orgId,
            slug: 'copy-test',
            name: 'Copy Test Track',
          },
        });
      }

      const chairOnB = await tx.membership.findFirst({
        where: { userId: chairUserId, conferenceId: confBId },
      });
      if (!chairOnB) {
        await tx.membership.create({
          data: {
            id: generateId(),
            userId: chairUserId,
            organizationId: orgId,
            conferenceId: confBId,
            scope: 'CONFERENCE',
            roles: { create: { id: generateId(), role: 'CHAIR' } },
          },
        });
      }

      const reviewerOnB = await tx.membership.findFirst({
        where: { userId: reviewerUserId, conferenceId: confBId },
      });
      if (!reviewerOnB) {
        await tx.membership.create({
          data: {
            id: generateId(),
            userId: reviewerUserId,
            organizationId: orgId,
            conferenceId: confBId,
            scope: 'CONFERENCE',
            roles: { create: { id: generateId(), role: 'REVIEWER' } },
          },
        });
      }

      await tx.paper.create({
        data: {
          id: copyPaperId,
          organizationId: orgId,
          conferenceId: confBId,
          trackId: trackBId,
          submittedById: authorReviewerUserId,
          title: 'Copy Assignments Paper',
          abstract: 'Paper for copy-assignments test.',
          keywords: ['copy'],
          status: 'SUBMITTED',
          authorships: {
            create: {
              id: generateId(),
              userId: null,
              order: 1,
              isCorresponding: true,
              fullName: 'Copy Author',
              email: 'copy-author@example.com',
            },
          },
        },
      });
    });

    const round1Res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/rounds`)
      .set('Cookie', chairCookie)
      .send({ roundNumber: 30 });

    expect(round1Res.status).toBe(201);
    priorRoundId = round1Res.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/papers/${copyPaperId}/assignments`)
      .set('Cookie', chairCookie)
      .send({ roundId: priorRoundId, reviewerUserId })
      .expect(201);

    const round2Res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confBId}/rounds`)
      .set('Cookie', chairCookie)
      .send({ roundNumber: 31 });

    expect(round2Res.status).toBe(201);
    const nextRoundId = round2Res.body.id as string;

    const copyRes = await request(app.getHttpServer())
      .post(
        `/api/v1/conferences/${confBId}/rounds/${nextRoundId}/assignments/copy-from-previous-round`,
      )
      .set('Cookie', chairCookie)
      .send({});

    expect(copyRes.status).toBe(200);
    expect(copyRes.body.createdCount).toBe(1);
    expect(copyRes.body.previousRoundNumber).toBe(30);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/rounds/${nextRoundId}/assignments`)
      .set('Cookie', chairCookie);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].reviewerUserId).toBe(reviewerUserId);
    expect(list.body.data[0].paperId).toBe(copyPaperId);

    const copyAgain = await request(app.getHttpServer())
      .post(
        `/api/v1/conferences/${confBId}/rounds/${nextRoundId}/assignments/copy-from-previous-round`,
      )
      .set('Cookie', chairCookie)
      .send({});

    expect(copyAgain.status).toBe(200);
    expect(copyAgain.body.createdCount).toBe(0);
    expect(copyAgain.body.skippedCount).toBe(1);
  });
});
