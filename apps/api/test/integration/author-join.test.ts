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
  emailVerified = true,
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
      emailVerified,
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

describe('Author submit join link integration', () => {
  let app: INestApplication;

  const orgId = generateId();
  const conferenceId = generateId();
  const otherConferenceId = generateId();
  let authorJoinToken = generateId();

  const organizerEmail = `author-join-org-${Date.now()}@example.com`;
  const authorEmail = `author-join-user-${Date.now()}@example.com`;
  const otherAuthorEmail = `author-join-other-${Date.now()}@example.com`;

  let organizerUserId = '';
  let authorUserId = '';
  let organizerCookie = '';
  let authorCookie = '';
  let otherAuthorCookie = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();

    const organizer = await createUserWithSession(app, organizerEmail, 'Organizer User');
    const author = await createUserWithSession(app, authorEmail, 'Author User');
    const otherAuthor = await createUserWithSession(app, otherAuthorEmail, 'Other Author');

    organizerUserId = organizer.userId;
    authorUserId = author.userId;
    organizerCookie = organizer.cookie;
    authorCookie = author.cookie;
    otherAuthorCookie = otherAuthor.cookie;

    await prisma.user.update({
      where: { id: organizerUserId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `author-join-org-${Date.now()}`, name: 'Author Join Org' },
      });

      await tx.conference.createMany({
        data: [
          {
            id: conferenceId,
            organizationId: orgId,
            slug: 'author-join-conf',
            name: 'Author Join Conference',
            authorJoinToken,
            status: 'CFP_OPEN',
          },
          {
            id: otherConferenceId,
            organizationId: orgId,
            slug: 'author-join-other-conf',
            name: 'Other Conference',
            authorJoinToken: generateId(),
            status: 'CFP_OPEN',
          },
        ],
      });

      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizerUserId,
          organizationId: orgId,
          conferenceId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'ORGANIZER' } },
        },
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('organizer can fetch the public submit link', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${conferenceId}/author-join-link`)
      .set('Cookie', organizerCookie);

    expect(response.status).toBe(200);
    expect(response.body.token).toBe(authorJoinToken);
    expect(response.body.urlPath).toBe(`/join/author?token=${authorJoinToken}`);
  });

  it('join-as-author grants conference-scoped AUTHOR role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conferences/join-as-author')
      .set('Cookie', authorCookie)
      .send({ token: authorJoinToken });

    expect(response.status).toBe(200);
    expect(response.body.conferenceId).toBe(conferenceId);
    expect(response.body.alreadyMember).toBe(false);

    const membership = await withTenantContext({ bypass: true }, async (tx) =>
      tx.membership.findFirst({
        where: {
          userId: authorUserId,
          conferenceId,
          scope: 'CONFERENCE',
        },
        include: { roles: true },
      }),
    );

    expect(membership?.roles.map((grant) => grant.role)).toContain('AUTHOR');

    const otherMembership = await withTenantContext({ bypass: true }, async (tx) =>
      tx.membership.findFirst({
        where: {
          userId: authorUserId,
          conferenceId: otherConferenceId,
          scope: 'CONFERENCE',
        },
      }),
    );

    expect(otherMembership).toBeNull();
  });

  it('join-as-author is idempotent for existing authors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conferences/join-as-author')
      .set('Cookie', authorCookie)
      .send({ token: authorJoinToken });

    expect(response.status).toBe(200);
    expect(response.body.alreadyMember).toBe(true);
  });

  it('rejects join when CFP is not open', async () => {
    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.conference.update({
        where: { id: conferenceId },
        data: { status: 'DRAFT' },
      });
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/conferences/join-as-author')
      .set('Cookie', otherAuthorCookie)
      .send({ token: authorJoinToken });

    expect(response.status).toBe(409);

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.conference.update({
        where: { id: conferenceId },
        data: { status: 'CFP_OPEN' },
      });
    });
  });

  it('rotated token invalidates the previous submit link', async () => {
    const rotate = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${conferenceId}/author-join-link/rotate`)
      .set('Cookie', organizerCookie);

    expect(rotate.status).toBe(200);
    authorJoinToken = rotate.body.token;

    const stale = await request(app.getHttpServer())
      .post('/api/v1/conferences/join-as-author')
      .set('Cookie', otherAuthorCookie)
      .send({ token: generateId() });

    expect(stale.status).toBe(404);

    const fresh = await request(app.getHttpServer())
      .post('/api/v1/conferences/join-as-author')
      .set('Cookie', otherAuthorCookie)
      .send({ token: authorJoinToken });

    expect(fresh.status).toBe(200);
    expect(fresh.body.conferenceId).toBe(conferenceId);
  });
});
