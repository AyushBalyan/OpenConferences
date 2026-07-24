import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
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

describe('Dashboard, pagination & analytics integration', () => {
  let app: INestApplication;

  const orgId = generateId();
  const confAId = generateId();
  const confBId = generateId();
  const trackId = generateId();

  const organizerEmail = `dash-org-${Date.now()}@example.com`;
  const authorEmail = `dash-author-${Date.now()}@example.com`;
  const outsiderEmail = `dash-outsider-${Date.now()}@example.com`;

  let organizerCookie = '';
  let authorCookie = '';
  let outsiderCookie = '';

  const paperIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();

    const organizer = await createUserWithSession(app, organizerEmail, 'Organizer');
    const author = await createUserWithSession(app, authorEmail, 'Author');
    const outsider = await createUserWithSession(app, outsiderEmail, 'Outsider');

    organizerCookie = organizer.cookie;
    authorCookie = author.cookie;
    outsiderCookie = outsider.cookie;

    await withTenantContext({}, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `dash-org-${Date.now()}`, name: 'Dash Org' },
      });

      await tx.conference.createMany({
        data: [
          {
            id: confAId,
            organizationId: orgId,
            slug: 'dash-conf-a',
            name: 'Dashboard Conf A',
            authorJoinToken: generateId(),
            status: 'REVIEWING',
          },
          {
            id: confBId,
            organizationId: orgId,
            slug: 'dash-conf-b',
            name: 'Dashboard Conf B',
            authorJoinToken: generateId(),
            status: 'DRAFT',
          },
        ],
      });

      await tx.track.create({
        data: {
          id: trackId,
          conferenceId: confAId,
          organizationId: orgId,
          slug: 'main',
          name: 'Main',
        },
      });

      const orgMembershipId = generateId();
      const authorMembershipId = generateId();
      const organizerMembershipId = generateId();

      await tx.membership.createMany({
        data: [
          {
            id: orgMembershipId,
            userId: organizer.userId,
            organizationId: orgId,
            scope: 'ORGANIZATION',
          },
          {
            id: organizerMembershipId,
            userId: organizer.userId,
            organizationId: orgId,
            conferenceId: confAId,
            scope: 'CONFERENCE',
          },
          {
            id: authorMembershipId,
            userId: author.userId,
            organizationId: orgId,
            conferenceId: confAId,
            scope: 'CONFERENCE',
          },
        ],
      });

      await tx.roleGrant.createMany({
        data: [
          { id: generateId(), membershipId: orgMembershipId, role: 'ORG_ADMIN' },
          { id: generateId(), membershipId: organizerMembershipId, role: 'ORGANIZER' },
          { id: generateId(), membershipId: organizerMembershipId, role: 'CHAIR' },
          { id: generateId(), membershipId: authorMembershipId, role: 'AUTHOR' },
        ],
      });

      for (let i = 0; i < 5; i++) {
        const paperId = generateId();
        paperIds.push(paperId);
        await tx.paper.create({
          data: {
            id: paperId,
            organizationId: orgId,
            conferenceId: confAId,
            trackId,
            submittedById: author.userId,
            title: `Paper ${i + 1}`,
            abstract: `Abstract ${i + 1}`,
            keywords: ['test'],
            status: i % 2 === 0 ? 'SUBMITTED' : 'UNDER_REVIEW',
            authorships: {
              create: {
                id: generateId(),
                userId: author.userId,
                order: 1,
                isCorresponding: true,
                fullName: 'Author',
                email: authorEmail,
              },
            },
          },
        });
      }

      const roundId = generateId();
      await tx.reviewRound.create({
        data: {
          id: roundId,
          organizationId: orgId,
          conferenceId: confAId,
          roundNumber: 1,
          status: 'REVIEWING',
        },
      });

      const assignmentId = generateId();
      await tx.reviewerAssignment.create({
        data: {
          id: assignmentId,
          organizationId: orgId,
          conferenceId: confAId,
          roundId,
          paperId: paperIds[0]!,
          reviewerUserId: organizer.userId,
          status: 'COMPLETED',
        },
      });

      await tx.review.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          conferenceId: confAId,
          assignmentId,
          roundId,
          paperId: paperIds[0]!,
          reviewerUserId: organizer.userId,
          scores: { originality: 4 },
          recommendation: 'ACCEPT',
          visibility: 'HIDDEN',
          submittedAt: new Date(),
        },
      });

      await tx.decision.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          conferenceId: confAId,
          paperId: paperIds[0]!,
          roundId,
          decidedById: organizer.userId,
          outcome: 'ACCEPT',
        },
      });

      const registrationId = generateId();
      await tx.registration.create({
        data: {
          id: registrationId,
          organizationId: orgId,
          conferenceId: confAId,
          paperId: paperIds[0]!,
          userId: author.userId,
          audience: 'REGULAR',
          amountDueMinor: 500000,
          currency: 'INR',
          status: 'PAID',
          windowOpensAt: new Date(),
          deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.payment.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          registrationId,
          provider: 'razorpay',
          status: 'CAPTURED',
          amountMinor: 500000,
          currency: 'INR',
          kind: 'INITIAL',
        },
      });
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('paginates papers without duplicates across pages', async () => {
    const page1 = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/papers`)
      .query({ limit: 2 })
      .set('Cookie', organizerCookie);

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/papers`)
      .query({ limit: 2, cursor: page1.body.nextCursor })
      .set('Cookie', organizerCookie);

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(2);

    const ids = [...page1.body.data, ...page2.body.data].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filters papers by status and scopes results to conference', async () => {
    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/papers`)
      .query({ status: 'SUBMITTED' })
      .set('Cookie', organizerCookie);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data.every((p: { status: string }) => p.status === 'SUBMITTED')).toBe(
      true,
    );

    const otherConference = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/papers`)
      .query({ status: 'SUBMITTED' })
      .set('Cookie', organizerCookie);

    expect(otherConference.status).toBe(200);
    expect(otherConference.body.data).toHaveLength(0);
  });

  it('rejects outsider paper list with 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/papers`)
      .set('Cookie', outsiderCookie);

    expect(res.status).toBe(404);
  });

  it('returns cross-conference /me/dashboard aggregation', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/dashboard')
      .set('Cookie', authorCookie);

    expect(res.status).toBe(200);
    expect(res.body.authoredPapers.length).toBeGreaterThan(0);
    expect(res.body.authoredPapers[0].conferenceName).toBe('Dashboard Conf A');
  });

  it('reconciles analytics overview with source data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/analytics/overview`)
      .set('Cookie', organizerCookie);

    expect(res.status).toBe(200);
    expect(res.body.submissions.total).toBe(5);
    expect(res.body.reviews.assigned).toBe(1);
    expect(res.body.reviews.completed).toBe(1);
    expect(res.body.decisions.total).toBe(1);
    expect(res.body.decisions.byOutcome).toEqual(
      expect.arrayContaining([expect.objectContaining({ outcome: 'ACCEPT', count: 1 })]),
    );
    expect(res.body.registrations.paid).toBe(1);
    expect(res.body.revenueMinor).toBe(500000);
  });

  it('denies analytics to non-organizer roles', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/analytics/overview`)
      .set('Cookie', authorCookie);

    expect(res.status).toBe(403);
  });
});
