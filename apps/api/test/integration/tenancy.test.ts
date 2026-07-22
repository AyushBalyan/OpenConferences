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
    throw new Error(`Sign-in failed for ${email}: ${signIn.status} ${JSON.stringify(signIn.body)}`);
  }

  const setCookie = signIn.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies
    .map((c) => c?.split(';')[0])
    .filter(Boolean)
    .join('; ');

  return { userId, cookie };
}

describe('Tenancy & RBAC integration', () => {
  let app: INestApplication;

  const orgAId = generateId();
  const orgBId = generateId();
  const confAId = generateId();
  const confBId = generateId();
  const trackAId = generateId();

  const organizerEmail = `org-${Date.now()}@example.com`;
  const outsiderEmail = `outsider-${Date.now()}@example.com`;
  const authorEmail = `author-${Date.now()}@example.com`;

  let organizerUserId: string;
  let authorUserId: string;
  let organizerCookie = '';
  let outsiderCookie = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();

    const organizer = await createUserWithSession(app, organizerEmail, 'Organizer User');
    const outsider = await createUserWithSession(app, outsiderEmail, 'Outsider User');
    const author = await createUserWithSession(app, authorEmail, 'Author User');

    organizerUserId = organizer.userId;
    authorUserId = author.userId;
    organizerCookie = organizer.cookie;
    outsiderCookie = outsider.cookie;

    await prisma.user.update({
      where: { id: organizerUserId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.organization.createMany({
        data: [
          { id: orgAId, slug: `org-a-${Date.now()}`, name: 'Org A' },
          { id: orgBId, slug: `org-b-${Date.now()}`, name: 'Org B' },
        ],
      });

      await tx.conference.createMany({
        data: [
          {
            id: confAId,
            organizationId: orgAId,
            slug: 'conf-a',
            name: 'Conference A',
            authorJoinToken: generateId(),
            status: 'DRAFT',
          },
          {
            id: confBId,
            organizationId: orgBId,
            slug: 'conf-b',
            name: 'Conference B',
            authorJoinToken: generateId(),
            status: 'DRAFT',
          },
        ],
      });

      await tx.track.create({
        data: {
          id: trackAId,
          conferenceId: confAId,
          organizationId: orgAId,
          slug: 'main',
          name: 'Main Track',
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizerUserId,
          organizationId: orgAId,
          scope: 'ORGANIZATION',
          roles: { create: { id: generateId(), role: 'ORG_ADMIN' } },
        },
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizerUserId,
          organizationId: orgAId,
          conferenceId: confAId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'ORGANIZER' } },
        },
      });
    });
  }, 120000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { conferenceId: { in: [confAId, confBId] } } });
    await prisma.roleGrant.deleteMany({
      where: { membership: { conferenceId: { in: [confAId, confBId] } } },
    });
    if (organizerUserId || authorUserId) {
      await prisma.membership.deleteMany({
        where: {
          userId: {
            in: [organizerUserId, authorUserId].filter(Boolean),
          },
        },
      });
    }
    await prisma.track.deleteMany({ where: { id: trackAId } });
    await prisma.conference.deleteMany({ where: { id: { in: [confAId, confBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({
      where: { email: { in: [organizerEmail, outsiderEmail, authorEmail] } },
    });
    await app.close();
  });

  it('organizer can get their conference', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}`)
      .set('Cookie', organizerCookie)
      .expect(200);

    expect(response.body.id).toBe(confAId);
    expect(response.body.name).toBe('Conference A');
  });

  it('outsider gets 404 for cross-tenant conference (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}`)
      .set('Cookie', outsiderCookie)
      .expect(404);
  });

  it('outsider gets 404 for conference B in another org', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}`)
      .set('Cookie', outsiderCookie)
      .expect(404);
  });

  it('organizer can list tracks', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confAId}/tracks`)
      .set('Cookie', organizerCookie)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data[0].slug).toBe('main');
  });

  it('organizer can update settings with MFA', async () => {
    const opens = new Date(Date.now() + 86400000).toISOString();
    const closes = new Date(Date.now() + 86400000 * 30).toISOString();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confAId}/settings`)
      .set('Cookie', organizerCookie)
      .send({
        blindingMode: 'SINGLE',
        cfpOpensAt: opens,
        cfpClosesAt: closes,
        feeSchedule: {
          currency: 'INR',
          matrix: {
            REGULAR: { EARLY: 100000, REGULAR: 150000 },
            STUDENT: { EARLY: 50000, REGULAR: 80000 },
          },
        },
      })
      .expect(200);

    expect(response.body.blindingMode).toBe('SINGLE');
    expect(response.body.feeSchedule.currency).toBe('INR');
  });

  it('organizer can grant AUTHOR role (privilege ceiling)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confAId}/members/grant`)
      .set('Cookie', organizerCookie)
      .send({
        userId: authorUserId,
        role: 'AUTHOR',
        scope: 'CONFERENCE',
      })
      .expect(201);

    const authorMember = response.body.data.find(
      (m: { userId: string }) => m.userId === authorUserId,
    );
    expect(authorMember?.roles).toContain('AUTHOR');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'role.granted', conferenceId: confAId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('organizer cannot grant ORG_ADMIN (privilege ceiling)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confAId}/members/grant`)
      .set('Cookie', organizerCookie)
      .send({
        userId: authorUserId,
        role: 'ORG_ADMIN',
        scope: 'CONFERENCE',
      })
      .expect(403);
  });

  it('organizer can transition to CFP_OPEN after windows configured', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confAId}/status`)
      .set('Cookie', organizerCookie)
      .send({ status: 'CFP_OPEN' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CFP_OPEN');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'conference.status_transition', conferenceId: confAId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('reverts to DRAFT when CFP opens is moved to a future date', async () => {
    const futureOpen = new Date(Date.now() + 86400000 * 15).toISOString();
    const futureClose = new Date(Date.now() + 86400000 * 45).toISOString();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/conferences/${confAId}/settings`)
      .set('Cookie', organizerCookie)
      .send({
        cfpOpensAt: futureOpen,
        cfpClosesAt: futureClose,
      })
      .expect(200);

    expect(response.body.status).toBe('DRAFT');
  });

  it('RLS policies are enabled on tenant tables', async () => {
    const result = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('conferences', 'tracks', 'memberships', 'organizations')
    `;

    for (const row of result) {
      expect(row.relrowsecurity).toBe(true);
    }
  });

  it('RLS allows organizer to read tracks with membership context', async () => {
    const tracks = await withTenantContext(
      {
        userId: organizerUserId,
        organizationId: orgAId,
        conferenceId: confAId,
      },
      async (tx) =>
        tx.track.findMany({
          where: { conferenceId: confAId },
        }),
    );

    expect(tracks.length).toBeGreaterThanOrEqual(1);
  });
});
