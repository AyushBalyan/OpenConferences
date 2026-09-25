import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';
import { ensureOutreachTemplates } from '../helpers/outreach.ts';

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
    .map((item) => item?.split(';')[0])
    .filter(Boolean)
    .join('; ');

  return { userId, cookie };
}

describe('Academic outreach', () => {
  let app: INestApplication;
  const orgId = generateId();
  const confId = generateId();
  const confBId = generateId();
  const stamp = Date.now();
  const organizerEmail = `org-outreach-${stamp}@example.com`;
  const authorEmail = `author-outreach-${stamp}@example.com`;
  const outsiderEmail = `out-outreach-${stamp}@example.com`;

  let organizerCookie = '';
  let authorCookie = '';
  let outsiderCookie = '';
  let organizerUserId = '';
  let campaignId = '';
  let templateId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();
    await ensureOutreachTemplates();

    const organizer = await createUserWithSession(app, organizerEmail, 'Organizer');
    const author = await createUserWithSession(app, authorEmail, 'Author');
    const outsider = await createUserWithSession(app, outsiderEmail, 'Outsider');
    organizerUserId = organizer.userId;
    organizerCookie = organizer.cookie;
    authorCookie = author.cookie;
    outsiderCookie = outsider.cookie;

    await prisma.user.update({
      where: { id: organizerUserId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({}, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `outreach-org-${stamp}`, name: 'Outreach Org' },
      });
      await tx.conference.createMany({
        data: [
          {
            id: confId,
            organizationId: orgId,
            slug: 'outreach-conf',
            name: 'Outreach Conf',
            authorJoinToken: generateId(),
          },
          {
            id: confBId,
            organizationId: orgId,
            slug: 'outreach-conf-b',
            name: 'Outreach Conf B',
            authorJoinToken: generateId(),
          },
        ],
      });
      await tx.membership.create({
        data: {
          id: generateId(),
          userId: organizerUserId,
          organizationId: orgId,
          conferenceId: confId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'ORGANIZER' } },
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
    });
  }, 60000);

  afterAll(async () => {
    await withTenantContext({}, async (tx) => {
      await tx.outreachRecipient.deleteMany({ where: { conferenceId: { in: [confId, confBId] } } });
      await tx.outreachCampaign.deleteMany({ where: { conferenceId: { in: [confId, confBId] } } });
      await tx.membership.deleteMany({ where: { organizationId: orgId } });
      await tx.conference.deleteMany({ where: { id: { in: [confId, confBId] } } });
      await tx.user.deleteMany({
        where: { email: { in: [organizerEmail, authorEmail, outsiderEmail] } },
      });
      await tx.organization.deleteMany({ where: { id: orgId } });
    });
    await app.close();
  });

  it('rejects authors and outsiders', async () => {
    const authorRes = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/outreach/campaigns`)
      .set('Cookie', authorCookie);
    expect(authorRes.status).toBe(403);

    const outsiderRes = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/outreach/campaigns`)
      .set('Cookie', outsiderCookie);
    expect([403, 404]).toContain(outsiderRes.status);
  });

  it('creates a campaign, imports rows, previews, and confirms send', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/outreach/campaigns`)
      .set('Cookie', organizerCookie)
      .send({ name: 'TPC 2026', type: 'TPC_INVITATION' });

    expect(created.status).toBe(201);
    campaignId = created.body.id as string;

    const imported = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/outreach/campaigns/${campaignId}/recipients`)
      .set('Cookie', organizerCookie)
      .send({
        rows: [
          {
            rowNumber: 2,
            name: 'Dr. John Smith',
            email: 'John@Example.com',
            topic: 'Artificial Intelligence',
            paper: 'Advances in Machine learning technologies',
          },
          {
            rowNumber: 3,
            name: 'Dup',
            email: 'john@example.com',
            topic: 'AI',
            paper: 'Other',
          },
          {
            rowNumber: 4,
            name: 'Bad',
            email: 'not-an-email',
            topic: 'AI',
            paper: 'Paper',
          },
        ],
      });

    expect(imported.status).toBe(200);
    expect(imported.body.importedCount).toBe(1);
    expect(imported.body.duplicateCount).toBe(1);
    expect(imported.body.invalidRows.length).toBeGreaterThanOrEqual(2);
    expect(imported.body.campaign.recipientCount).toBe(1);

    const templates = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/outreach/templates`)
      .set('Cookie', organizerCookie);
    expect(templates.status).toBe(200);
    const tpc = (templates.body.data as Array<{ id: string; key: string }>).find(
      (item) => item.key === 'tpc_invitation',
    );
    expect(tpc).toBeTruthy();
    templateId = tpc!.id;

    const selected = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/outreach/campaigns/${campaignId}/template`)
      .set('Cookie', organizerCookie)
      .send({ templateId });
    expect(selected.status).toBe(200);
    expect(selected.body.status).toBe('READY');

    const preview = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/outreach/campaigns/${campaignId}/preview`)
      .set('Cookie', organizerCookie);
    expect(preview.status).toBe(200);
    expect(preview.body.subject).toContain('Technical Program Committee');
    expect(preview.body.bodyHtml).toContain('Dr. John Smith');
    expect(preview.body.bodyHtml).toContain('Artificial Intelligence');
    expect(preview.body.fromEmail).toBeTruthy();
    expect(preview.body.replyToEmail).toBeTruthy();

    const sender = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/outreach/sender`)
      .set('Cookie', organizerCookie);
    expect(sender.status).toBe(200);
    expect(sender.body).not.toHaveProperty('sesAccessKeyId');
    expect(sender.body).toHaveProperty('provider');
    expect(['log', 'ses', 'resend']).toContain(sender.body.provider);
    expect(JSON.stringify(sender.body)).not.toMatch(/SECRET|ACCESS_KEY|apiKey|webhookSecret/i);

    const sent = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/outreach/campaigns/${campaignId}/send`)
      .set('Cookie', organizerCookie)
      .send({ confirm: true, version: selected.body.version });
    expect(sent.status).toBe(200);
    expect(['SENDING', 'SENT', 'PARTIAL']).toContain(sent.body.campaign.status);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/outreach/campaigns/${campaignId}/send`)
      .set('Cookie', organizerCookie)
      .send({ confirm: true, version: sent.body.campaign.version });
    expect(again.status).toBe(200);
  });

  it('returns 404 for a campaign on another conference', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/outreach/campaigns/${campaignId}`)
      .set('Cookie', organizerCookie);
    expect([403, 404]).toContain(res.status);
  });

  it('rejects unsigned Resend outreach webhooks and does not write notification logs', async () => {
    const before = await prisma.notificationLog.count();
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/resend/outreach')
      .set('Content-Type', 'application/json')
      .send({
        type: 'email.bounced',
        data: { email_id: 're_isolation', tags: { channel: 'outreach' } },
      });
    expect(res.status).toBe(401);
    const after = await prisma.notificationLog.count();
    expect(after).toBe(before);
  });
});
