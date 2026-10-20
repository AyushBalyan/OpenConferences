import 'reflect-metadata';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import Redis from 'ioredis';
import { randomUUID, createHash } from 'node:crypto';
import {
  PrismaClient,
  prisma,
  withTenantContext,
  assertSafeDatabaseRole,
  pruneIntegrationAccessLogs,
} from '@openconferences/db';
import { INTEGRATION_SCOPES, effectiveReviewDeadline } from '@openconferences/schemas';
import { AuthService } from '../auth/auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { ConferenceService } from '../tenancy/conference.service';
import { ProblemExceptionFilter } from '../common/filters/problem-exception.filter';
import { REDIS_CLIENT } from '../redis/redis.module';
import { IntegrationStore } from './integration.store';
import { BotReadService } from './bot-read.service';
import { BotWriteService } from './bot-write.service';
import { BotInvitationsService } from './bot-invitations.service';
import { InvitationsService } from '../review/invitations.service';
import { CoiCheckService } from '../review/coi-check.service';
import { RoundsService } from '../review/rounds.service';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { IntegrationLimiter } from './integration.limiter';
import { BotReadController, IntegrationManagementController } from './integration.controllers';
import { parseCredential } from './integration.security';
const owner = new PrismaClient({ datasourceUrl: process.env.BOT_API_TEST_OWNER_URL });
const redis = new Redis(process.env.BOT_API_TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
const id = () => randomUUID();
const org = id(),
  conf = id(),
  otherConf = id(),
  otherOrg = id(),
  foreignConf = id(),
  chair = id(),
  organizer = id(),
  reviewer = id(),
  emptyReviewer = id(),
  author = id(),
  track = id(),
  otherTrack = id(),
  paper = id(),
  draft = id(),
  withdrawn = id(),
  foreignPaper = id(),
  cycle = id(),
  oldCycle = id(),
  assignment = id(),
  oldAssignment = id();
let app: INestApplication;
let store: IntegrationStore;
let limiter: IntegrationLimiter;
let grant: { id: string; version: number };
let token: string;
let restricted: string;
let inviteToken: string;
let inviteGrant: { id: string; version: number };
const baseScopes = INTEGRATION_SCOPES.filter((s) => !s.startsWith('invitations:'));
const invitationScopes = [
  'reviewers:read',
  'reviewers:identity:read',
  'reviewers:contacts:read',
  'invitations:read',
  'invitations:write',
] as const;
const inviteContext = { userId: organizer, organizationId: org, conferenceId: conf };
const base = `/api/v1/conferences/${conf}/integrations`,
  bot = `/api/v1/integrations/v1/conferences/${conf}`;
const context = { userId: chair, organizationId: org, conferenceId: conf };
const human = () => ({ Cookie: 'test-chair' });
const api = (url: string, key = token) =>
  request(app.getHttpServer())
    .get(url)
    .set('Authorization', 'Bearer ' + key);
const assignmentEmail = vi.fn().mockResolvedValue(true);
const sendInvitationMail = vi.fn().mockRejectedValue(new Error('No invitation email is permitted'));
const invite = (body: unknown, key = inviteToken, prefix = bot) =>
  request(app.getHttpServer())
    .post(prefix + '/reviewer-invitations')
    .set('Authorization', 'Bearer ' + key)
    .send(body);
const removeInvite = (invitationId: string, requestId: string, key = inviteToken) =>
  request(app.getHttpServer())
    .delete(bot + '/reviewer-invitations/' + invitationId)
    .set('Authorization', 'Bearer ' + key)
    .send({ requestId });
const write = (body: unknown, key = token, prefix = bot) =>
  request(app.getHttpServer())
    .post(prefix + '/assignments')
    .set('Authorization', 'Bearer ' + key)
    .send(body);
async function writePaper() {
  const p = id();
  await owner.paper.create({
    data: {
      id: p,
      organizationId: org,
      conferenceId: conf,
      trackId: track,
      submittedById: author,
      title: 'Assignment test',
      abstract: 'Synthetic',
      keywords: [],
      status: 'SUBMITTED',
    },
  });
  return p;
}
async function reviewerRef(userId = emptyReviewer) {
  const p = await store.authenticate(parseCredential('Bearer ' + token)!);
  return (await store.references(p, [userId]))[0]!.id;
}
async function assignmentInput() {
  return {
    requestId: id(),
    paperId: await writePaper(),
    reviewerId: await reviewerRef(),
    dueAt: '2030-01-02T17:30:00+05:30',
  };
}
async function newReadKey() {
  const g = await store.create(context, {
    name: 'Read regression',
    scopes: ['papers:read', 'reviewers:read'],
  });
  return (
    await store.issue(context, g.id, {
      label: 'Read only',
      scopes: ['papers:read', 'reviewers:read'],
      expiresInDays: 30,
      requestId: id(),
    })
  ).token;
}
describe('Bot API HTTP + actual PostgreSQL RLS + Redis', () => {
  beforeAll(async () => {
    const urls = [process.env.BOT_API_TEST_OWNER_URL!, process.env.BOT_API_TEST_DATABASE_URL!].map(
      (v) => new URL(v),
    );
    if (urls[0].host !== urls[1].host || urls[0].pathname !== urls[1].pathname)
      throw new Error('Owner/runtime must target same isolated database');
    const marker = await owner.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM bot_test.bot_api_test_marker`;
    if (!marker.some((m) => m.id === process.env.BOT_API_TEST_MARKER))
      throw new Error('Task-owned test marker mismatch');
    await assertSafeDatabaseRole();
    await owner.organization.createMany({
      data: [
        { id: org, slug: org, name: 'Test conference owner' },
        { id: otherOrg, slug: otherOrg, name: 'Other owner' },
      ],
    });
    await owner.user.createMany({
      data: [
        {
          id: organizer,
          name: 'Test organizer',
          email: organizer + '@example.com',
          twoFactorEnabled: true,
        },
        { id: chair, name: 'Test chair', email: chair + '@example.com', twoFactorEnabled: true },
        { id: reviewer, name: 'Private Reviewer Name', email: reviewer + '@example.com' },
        { id: emptyReviewer, name: 'Zero Reviewer', email: emptyReviewer + '@example.com' },
        { id: author, name: 'Author', email: author + '@example.com' },
      ],
    });
    await owner.conference.createMany({
      data: [
        {
          id: conf,
          organizationId: org,
          name: 'Bot API test',
          slug: conf,
          authorJoinToken: id(),
          status: 'REVIEWING',
          reviewDueAt: new Date('2030-01-01'),
          reviewConfig: { minimumReviews: 2 },
        },
        {
          id: otherConf,
          organizationId: org,
          name: 'Same org secret',
          slug: otherConf,
          authorJoinToken: id(),
        },
        {
          id: foreignConf,
          organizationId: otherOrg,
          name: 'Other secret',
          slug: foreignConf,
          authorJoinToken: id(),
        },
      ],
    });
    for (const [user, role] of [
      [chair, 'CHAIR'],
      [organizer, 'ORGANIZER'],
      [reviewer, 'REVIEWER'],
      [emptyReviewer, 'REVIEWER'],
    ] as const)
      await owner.membership.create({
        data: {
          id: id(),
          organizationId: org,
          conferenceId: conf,
          userId: user,
          scope: 'CONFERENCE',
          roles: { create: { id: id(), role } },
        },
      });
    await owner.track.createMany({
      data: [
        { id: track, organizationId: org, conferenceId: conf, slug: track, name: 'Track' },
        {
          id: otherTrack,
          organizationId: org,
          conferenceId: otherConf,
          slug: otherTrack,
          name: 'Other track',
        },
      ],
    });
    await owner.paper.createMany({
      data: [
        {
          id: paper,
          organizationId: org,
          conferenceId: conf,
          trackId: track,
          submittedById: author,
          title: 'Submitted paper',
          abstract: 'Public metadata',
          keywords: ['test'],
          status: 'UNDER_REVIEW',
          submissionNumber: 'BOT-001',
        },
        {
          id: draft,
          organizationId: org,
          conferenceId: conf,
          trackId: track,
          submittedById: author,
          title: 'Secret draft',
          abstract: 'Do not disclose',
          keywords: [],
          status: 'DRAFT',
        },
        {
          id: withdrawn,
          organizationId: org,
          conferenceId: conf,
          trackId: track,
          submittedById: author,
          title: 'Withdrawn paper',
          abstract: 'Withdrawn',
          keywords: [],
          status: 'WITHDRAWN_NONPAYMENT',
        },
        {
          id: foreignPaper,
          organizationId: org,
          conferenceId: otherConf,
          trackId: otherTrack,
          submittedById: author,
          title: 'Secret other conference',
          abstract: 'Hidden',
          keywords: [],
          status: 'SUBMITTED',
        },
      ],
    });
    await owner.authorship.create({
      data: {
        id: id(),
        paperId: paper,
        fullName: 'Private Author Name',
        email: 'author-private@example.com',
        affiliation: 'University',
        order: 1,
        isCorresponding: true,
      },
    });
    await owner.reviewRound.createMany({
      data: [
        {
          id: oldCycle,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundNumber: 1,
          reviewDueAt: new Date('2020-01-01'),
        },
        {
          id: cycle,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundNumber: 2,
          reviewDueAt: new Date('2030-01-01'),
        },
      ],
    });
    await owner.reviewerAssignment.createMany({
      data: [
        {
          id: assignment,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundId: cycle,
          reviewerUserId: reviewer,
          dueAt: new Date('2020-02-01'),
        },
        {
          id: oldAssignment,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundId: oldCycle,
          reviewerUserId: reviewer,
          dueAt: new Date('2020-01-01'),
        },
      ],
    });
    await owner.review.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: paper,
        roundId: oldCycle,
        assignmentId: oldAssignment,
        reviewerUserId: reviewer,
        submittedAt: new Date('2020-01-02'),
        commentsToChairs: 'CONFIDENTIAL NEVER RETURN',
        commentsToAuthors: 'REVIEW TEXT NEVER RETURN',
      },
    });
    const module = await Test.createTestingModule({
      controllers: [BotReadController, IntegrationManagementController],
      providers: [
        IntegrationStore,
        BotReadService,
        BotWriteService,
        BotInvitationsService,
        InvitationsService,
        CoiCheckService,
        RoundsService,
        { provide: AuditService, useValue: { log: vi.fn() } },
        { provide: NotificationPublisher, useValue: { publishReviewerAssigned: assignmentEmail } },
        IntegrationLimiter,
        AuthGuard,
        MembershipGuard,
        {
          provide: ConferenceService,
          useValue: {
            loadConference: async (userId: string, conferenceId: string) =>
              withTenantContext({ userId, conferenceId }, (tx) =>
                tx.conference.findFirstOrThrow({ where: { id: conferenceId } }),
              ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            signInMagicLink: sendInvitationMail,
            getSession: async (headers: { cookie?: string }) =>
              headers.cookie === 'test-chair' ? { user: { id: chair } } : null,
          },
        },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemExceptionFilter());
    await app.init();
    store = module.get(IntegrationStore);
    limiter = module.get(IntegrationLimiter);
    const created = await request(app.getHttpServer())
      .post(base)
      .set(human())
      .send({ name: 'Test bot', scopes: [...baseScopes] });
    expect(created.status).toBe(201);
    grant = created.body;
    const issued = await request(app.getHttpServer())
      .post(base + '/' + grant.id + '/keys')
      .set(human())
      .send({ label: 'Full key', scopes: [...baseScopes], requestId: id() });
    expect(issued.status).toBe(201);
    token = issued.body.token;
    const limited = await store.issue(context, grant.id, {
      label: 'Limited',
      scopes: ['papers:read', 'reviewers:read', 'analytics:read'],
      expiresInDays: 30,
      requestId: id(),
    });
    restricted = limited.token;
    inviteGrant = await store.create(inviteContext, {
      name: 'Invitation bot',
      scopes: [...invitationScopes],
    });
    inviteToken = (
      await store.issue(inviteContext, inviteGrant.id, {
        label: 'Invite key',
        scopes: [...invitationScopes],
        expiresInDays: 30,
        requestId: id(),
      })
    ).token;
  });
  beforeEach(async () => {
    assignmentEmail.mockReset().mockResolvedValue(true);
    sendInvitationMail.mockClear();
    for (const ip of ['::ffff:127.0.0.1', '127.0.0.1'])
      await redis.del('bot:auth:' + createHash('sha256').update(ip).digest('hex'));
    await redis.del(`bot:{${conf}}:rate:${parseCredential('Bearer ' + inviteToken)!.id}`);
    await redis.del(
      `bot:{${conf}}:rate`,
      `bot:{${conf}}:rate:${parseCredential('Bearer ' + token)!.id}`,
    );
  });
  afterAll(async () => {
    await app?.close();
    await owner.$disconnect();
    await prisma.$disconnect();
    await redis.quit();
  });
  it('bootstraps a valid key under real RLS and reports capabilities', async () => {
    const r = await api(bot + '/capabilities');
    expect(r.status).toBe(200);
    expect(r.body.scopes).toContain('papers:read');
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('rejects absent, malformed, wrong and unknown secrets', async () => {
    for (const key of ['', token.slice(0, -1) + 'x', 'ocbot_v1.' + id() + '.' + 'a'.repeat(43)])
      expect((await api(bot + '/papers', key)).status).toBe(401);
  });
  it('exposes no keys without lookup context and never stores raw secrets', async () => {
    expect(await withTenantContext({}, (tx) => tx.apiIntegrationKey.count())).toBe(0);
    const rows = await owner.apiIntegrationKey.findMany({ where: { integrationId: grant.id } });
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].secretHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('lists eligible papers without author/user/file data and hides drafts', async () => {
    const r = await api(bot + '/papers');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].id).toBe(paper);
    expect(r.body.data[0].submittedAt).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(
      /Private Author|submittedById|objectKey|reviewerUserId/,
    );
    expect((await api(bot + '/papers/' + draft)).status).toBe(404);
    expect((await api(bot + '/papers?status=DRAFT')).status).toBe(400);
  });
  it('handles explicit withdrawn browsing without altering active summary counts', async () => {
    const r = await api(bot + '/papers?includeWithdrawn=true');
    expect(r.body.data).toHaveLength(2);
    expect((await api(bot + '/papers/' + withdrawn)).status).toBe(404);
    expect((await api(bot + '/papers/' + withdrawn + '?includeWithdrawn=true')).status).toBe(200);
    const summary = await api(bot + '/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.submissions.active).toBe(1);
    expect(summary.body.data.submissions.withdrawn).toBe(1);
    expect(summary.body.data.reviews.remaining).toBe(1);
    expect(summary.body.data.reviews.overdue).toBe(1);
  });
  it('blocks foreign conference paths and all foreign reference IDs', async () => {
    expect((await api(`/api/v1/integrations/v1/conferences/${otherConf}/papers`)).status).toBe(404);
    expect((await api(`/api/v1/integrations/v1/conferences/${foreignConf}/papers`)).status).toBe(
      404,
    );
    for (const url of [
      '/papers/' + foreignPaper,
      '/assignments?paperId=' + foreignPaper,
      '/reviewers?trackId=' + otherTrack,
      '/authors?paperId=' + draft,
    ])
      expect((await api(bot + url)).status).toBe(404);
  });
  it('enforces scopes and omits reviewer identities from limited responses', async () => {
    expect((await api(bot + '/authors', restricted)).status).toBe(403);
    expect((await api(bot + '/assignments', restricted)).status).toBe(403);
    const r = await api(bot + '/reviewers', restricted);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toMatch(
      /Private Reviewer|@example.com|userId|reviewerUserId/,
    );
    expect((await api(bot + '/reviewers?q=Private', restricted)).status).toBe(403);
  });
  it('returns author records and exposes contacts only with the additional scope', async () => {
    const r = await api(bot + '/papers/' + paper + '/authors');
    expect(r.status).toBe(200);
    expect(r.body.data[0].name).toBe('Private Author Name');
    expect(r.body.data[0].email).toBe('author-private@example.com');
    expect(r.body.data[0].userId).toBeUndefined();
  });
  it('preserves cycle history and effective individual deadlines without review text', async () => {
    const current = await api(bot + '/assignments');
    expect(current.status).toBe(200);
    expect(current.body.data).toHaveLength(1);
    expect(current.body.data[0].dueAt).toBe('2020-02-01T00:00:00.000Z');
    expect(current.body.data[0].deadlineSource).toBe('INDIVIDUAL');
    const all = await api(bot + '/assignments?history=ALL');
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data.find((r: { id: string }) => r.id === oldAssignment).progress).toBe(
      'SUBMITTED',
    );
    expect(JSON.stringify(all.body)).not.toMatch(
      /CONFIDENTIAL|REVIEW TEXT|commentsTo|reviewerUserId/,
    );
    const row = await owner.reviewerAssignment.findUniqueOrThrow({ where: { id: assignment } });
    expect(effectiveReviewDeadline(row, new Date('2030-01-01'), null).toISOString()).toBe(
      current.body.data[0].dueAt,
    );
  });
  it('paginates full reviewer workloads with encrypted context-bound cursors', async () => {
    const r = await api(bot + '/reviewers?limit=1');
    expect(r.body.data).toHaveLength(1);
    expect(r.body.nextCursor).toBeTruthy();
    const second = await api(
      bot + '/reviewers?limit=1&cursor=' + encodeURIComponent(r.body.nextCursor),
    );
    expect(second.status).toBe(200);
    expect(second.body.data[0].id).not.toBe(r.body.data[0].id);
    expect(
      (await api(bot + '/reviewers?history=ALL&cursor=' + encodeURIComponent(r.body.nextCursor)))
        .status,
    ).toBe(400);
    const detail = await api(bot + '/reviewers/' + r.body.data[0].id);
    expect(detail.status).toBe(200);
  });
  it('cannot use bot credentials to manage integrations or access human sessions', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post(base)
          .set('Authorization', 'Bearer ' + token)
          .send({ name: 'Forbidden' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .patch(base + '/' + grant.id)
          .set('Authorization', 'Bearer ' + token)
          .send({ version: 0, status: 'SUSPENDED' })
      ).status,
    ).toBe(401);
  });
  it('enforces READ ONLY at the DB while leaving normal transactions writable', async () => {
    await expect(
      withTenantContext(
        context,
        (tx) => tx.paper.update({ where: { id: paper }, data: { title: 'SHOULD FAIL' } }),
        { readOnly: true },
      ),
    ).rejects.toThrow();
    expect((await owner.paper.findUniqueOrThrow({ where: { id: paper } })).title).toBe(
      'Submitted paper',
    );
    expect(await withTenantContext(context, (tx) => tx.paper.count())).toBe(3);
  });
  it('records successful and scoped denied reads without response contents', async () => {
    const rows = await owner.apiIntegrationAccessLog.findMany({
      where: { integrationId: grant.id },
    });
    expect(rows.some((r) => r.status === 200)).toBe(true);
    expect(rows.some((r) => r.status === 403)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/CONFIDENTIAL|Private Author|author-private|ocbot_v1/);
    const first = await store.access(context, grant.id, 2);
    expect(first.data).toHaveLength(2);
    expect(first.data[0].observedAt >= first.data[1].observedAt).toBe(true);
    const next = await store.access(context, grant.id, 2, first.nextCursor!);
    expect(next.data.every((r) => !first.data.some((f) => f.id === r.id))).toBe(true);
    expect(next.data.every((r) => r.observedAt <= first.data[1].observedAt)).toBe(true);
    await expect(store.access(context, grant.id, 2, id())).rejects.toMatchObject({ status: 400 });
  });
  it('fails closed if durable access recording fails', async () => {
    const spy = vi.spyOn(store, 'record').mockRejectedValue(new Error('Simulated audit outage'));
    expect((await api(bot + '/papers')).status).toBe(503);
    spy.mockRestore();
  });
  it('uses Redis limits and enforces concurrent admission', async () => {
    const p = await store.authenticate(parseCredential('Bearer ' + token)!);
    const a = await limiter.acquire(p),
      b = await limiter.acquire(p);
    await expect(limiter.acquire(p)).rejects.toMatchObject({ status: 429 });
    await a();
    await b();
    await redis.set(`bot:{${conf}}:rate:${p.keyId}`, 60, 'EX', 60);
    const r = await api(bot + '/papers');
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBe('60');
    await redis.del(`bot:{${conf}}:rate:${p.keyId}`);
  });
  it('suspends immediately and keeps old keys within their originally issued scopes', async () => {
    let g = await store.detail(context, grant.id);
    await store.change(context, grant.id, { version: g.version, status: 'SUSPENDED' });
    expect((await api(bot + '/papers')).status).toBe(401);
    g = await store.detail(context, grant.id);
    await store.change(context, grant.id, { version: g.version, status: 'ACTIVE' });
    expect((await api(bot + '/authors', restricted)).status).toBe(403);
  });
  it('denies keys when the authorizer loses MFA or eligible membership', async () => {
    await owner.user.update({ where: { id: chair }, data: { twoFactorEnabled: false } });
    expect((await api(bot + '/papers')).status).toBe(401);
    await owner.user.update({ where: { id: chair }, data: { twoFactorEnabled: true } });
    const membership = await owner.membership.findFirstOrThrow({
      where: { userId: chair, conferenceId: conf },
      include: { roles: true },
    });
    await owner.roleGrant.update({
      where: { id: membership.roles[0].id },
      data: { role: 'AUTHOR' },
    });
    expect((await api(bot + '/papers')).status).toBe(401);
    await owner.roleGrant.update({
      where: { id: membership.roles[0].id },
      data: { role: 'CHAIR' },
    });
  });
  it('does not redisplay issued secrets and enforces the two-active-key limit', async () => {
    await expect(
      store.issue(context, grant.id, {
        label: 'Third',
        scopes: ['papers:read'],
        expiresInDays: 30,
        requestId: id(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    const metadata = await request(app.getHttpServer())
      .get(base + '/' + grant.id)
      .set(human());
    expect(metadata.status).toBe(200);
    expect(JSON.stringify(metadata.body)).not.toMatch(/secretHash|ocbot_v1/);
  });
  it('revokes one key permanently without disabling another key', async () => {
    const candidate = parseCredential('Bearer ' + restricted)!;
    await store.revokeKey(context, grant.id, candidate.id);
    expect((await api(bot + '/papers', restricted)).status).toBe(401);
    expect((await api(bot + '/papers')).status).toBe(200);
  });
  it('keeps contact and reviewer identity scopes separate, with stable integration-specific aliases', async () => {
    const g = await store.create(context, {
      name: 'Privacy boundary',
      scopes: ['papers:read', 'authors:read', 'reviewers:read', 'reviewers:identity:read'],
    });
    const issued = await store.issue(context, g.id, {
      label: 'Scoped',
      scopes: g.scopes,
      expiresInDays: 30,
      requestId: id(),
    });
    const authors = await api(bot + '/authors', issued.token);
    expect(authors.status).toBe(200);
    expect(authors.body.data[0]).not.toHaveProperty('email');
    expect((await api(bot + '/authors?email=private', issued.token)).status).toBe(403);
    const r = await api(bot + '/reviewers', issued.token);
    expect(r.status).toBe(200);
    expect(
      r.body.data.find((v: { name: string }) => v.name === 'Private Reviewer Name'),
    ).not.toHaveProperty('email');
    const again = await api(bot + '/reviewers', issued.token);
    expect(again.body.data.map((v: { id: string }) => v.id)).toEqual(
      r.body.data.map((v: { id: string }) => v.id),
    );
    const main = await api(bot + '/reviewers');
    expect(main.body.data.map((v: { id: string }) => v.id)).not.toEqual(
      r.body.data.map((v: { id: string }) => v.id),
    );
    expect((await api(bot + '/reviewers/' + r.body.data[0].id)).status).toBe(404);
    await owner.apiIntegrationKey.update({
      where: { id: parseCredential('Bearer ' + issued.token)!.id },
      data: { createdAt: new Date('2019-01-01'), expiresAt: new Date('2020-01-01') },
    });
    expect((await api(bot + '/papers', issued.token)).status).toBe(401);
  });
  it('reduces live grant scopes and reauthorization invalidates old keys', async () => {
    const g = await store.create(context, {
      name: 'Lifecycle',
      scopes: ['papers:read', 'authors:read'],
    });
    const k = await store.issue(context, g.id, {
      label: 'Old key',
      scopes: g.scopes,
      expiresInDays: 30,
      requestId: id(),
    });
    let updated = await store.change(context, g.id, {
      version: g.version,
      scopes: ['papers:read'],
    });
    expect((await api(bot + '/authors', k.token)).status).toBe(403);
    updated = await store.change(context, g.id, { version: updated.version }, 'reauthorized');
    expect((await api(bot + '/papers', k.token)).status).toBe(401);
    await store.change(context, g.id, { version: updated.version }, 'revoked');
    await expect(
      store.issue(context, g.id, {
        label: 'No',
        scopes: ['papers:read'],
        expiresInDays: 30,
        requestId: id(),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('computes cycle, conference and legacy deadlines consistently and distinguishes completed-without-review', async () => {
    const original = await owner.reviewerAssignment.findUniqueOrThrow({
      where: { id: assignment },
    });
    try {
      await owner.reviewerAssignment.update({ where: { id: assignment }, data: { dueAt: null } });
      let r = await api(bot + '/assignments/' + assignment);
      expect(r.body.data.deadlineSource).toBe('CYCLE');
      expect(r.body.data.dueAt).toBe('2030-01-01T00:00:00.000Z');
      await owner.reviewRound.update({ where: { id: cycle }, data: { reviewDueAt: null } });
      r = await api(bot + '/assignments/' + assignment);
      expect(r.body.data.deadlineSource).toBe('CONFERENCE');
      await owner.conference.update({ where: { id: conf }, data: { reviewDueAt: null } });
      r = await api(bot + '/assignments/' + assignment);
      expect(r.body.data.deadlineSource).toBe('LEGACY');
      const row = await owner.reviewerAssignment.findUniqueOrThrow({ where: { id: assignment } });
      expect(r.body.data.dueAt).toBe(effectiveReviewDeadline(row, null, null).toISOString());
      await owner.reviewerAssignment.update({
        where: { id: assignment },
        data: { status: 'COMPLETED' },
      });
      r = await api(bot + '/assignments/' + assignment);
      expect(r.body.data.progress).toBe('INCONSISTENT');
      expect(r.body.data.overdue).toBe(false);
      for (const status of ['DECLINED', 'REPLACED'] as const) {
        await owner.reviewerAssignment.update({ where: { id: assignment }, data: { status } });
        r = await api(bot + '/assignments/' + assignment);
        expect(r.body.data.progress).toBe('RETIRED');
        expect(r.body.data.overdue).toBe(false);
      }
    } finally {
      await owner.reviewerAssignment.update({
        where: { id: assignment },
        data: { dueAt: original.dueAt, status: original.status },
      });
      await owner.reviewRound.update({
        where: { id: cycle },
        data: { reviewDueAt: new Date('2030-01-01') },
      });
      await owner.conference.update({
        where: { id: conf },
        data: { reviewDueAt: new Date('2030-01-01') },
      });
    }
  });
  it('fails closed when Redis is unavailable', async () => {
    const spy = vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Simulated Redis outage'));
    try {
      expect((await api(bot + '/papers')).status).toBe(503);
    } finally {
      spy.mockRestore();
    }
  });
  it('bounds retention and restricts the worker to expired access records', async () => {
    const workerUrl = new URL(process.env.BOT_API_TEST_DATABASE_URL!);
    workerUrl.username = 'openconferences_worker';
    const worker = new PrismaClient({ datasourceUrl: workerUrl.toString() });
    try {
      const old = id(),
        fresh = id(),
        keyId = parseCredential('Bearer ' + token)!.id;
      const data = {
        integrationId: grant.id,
        keyId,
        organizationId: org,
        conferenceId: conf,
        requestId: id(),
        route: '/papers',
        method: 'GET',
        status: 200,
        resultCount: 0,
        durationMs: 1,
      };
      await owner.apiIntegrationAccessLog.createMany({
        data: [
          { ...data, id: old, observedAt: new Date('2020-01-01') },
          { ...data, id: fresh },
        ],
      });
      expect(await pruneIntegrationAccessLogs(worker)).toBeGreaterThan(0);
      expect(await owner.apiIntegrationAccessLog.findUnique({ where: { id: old } })).toBeNull();
      expect(
        await owner.apiIntegrationAccessLog.findUnique({ where: { id: fresh } }),
      ).not.toBeNull();
      await expect(worker.apiIntegrationKey.count()).rejects.toThrow();
      expect(await worker.apiIntegrationAccessLog.deleteMany({ where: { id: fresh } })).toEqual({
        count: 0,
      });
    } finally {
      await worker.$disconnect();
    }
  });

  it('supports organization-admin inheritance without widening a key to other conferences', async () => {
    const user = id();
    await owner.user.create({
      data: { id: user, email: user + '@example.test', name: 'Org admin', twoFactorEnabled: true },
    });
    const member = await owner.membership.create({
      data: {
        id: id(),
        organizationId: org,
        userId: user,
        scope: 'ORGANIZATION',
        roles: { create: { id: id(), role: 'ORG_ADMIN' } },
      },
      include: { roles: true },
    });
    const ctx = await store.context(user, conf, ['ORG_ADMIN']);
    const g = await store.create(ctx, { name: 'Org-admin authorized', scopes: ['papers:read'] });
    const k = await store.issue(ctx, g.id, {
      label: 'Inherited',
      scopes: ['papers:read'],
      expiresInDays: 30,
      requestId: id(),
    });
    expect((await api(bot + '/papers', k.token)).status).toBe(200);
    expect(
      (await api(`/api/v1/integrations/v1/conferences/${otherConf}/papers`, k.token)).status,
    ).toBe(404);
    await owner.roleGrant.update({ where: { id: member.roles[0].id }, data: { role: 'AUTHOR' } });
    expect((await api(bot + '/papers', k.token)).status).toBe(401);
  });
  it('enforces statement timeouts for bot business reads', async () => {
    const p = await store.authenticate(parseCredential('Bearer ' + token)!);
    const reads = new BotReadService(store);
    await expect(reads.read(p, (tx) => tx.$queryRaw`SELECT pg_sleep(4)`)).rejects.toThrow();
  });
  it('keeps pages bounded and reviewer totals complete across a 1,000-paper conference workload', async () => {
    const papers = Array.from({ length: 1000 }, (_, i) => ({
      id: id(),
      organizationId: org,
      conferenceId: conf,
      trackId: track,
      submittedById: author,
      title: `Synthetic load ${i}`,
      abstract: 'Synthetic metadata',
      keywords: [],
      status: 'UNDER_REVIEW' as const,
    }));
    const rounds = papers.map((p) => ({
      id: id(),
      organizationId: org,
      conferenceId: conf,
      paperId: p.id,
      roundNumber: 1,
    }));
    await owner.paper.createMany({ data: papers });
    await owner.reviewRound.createMany({ data: rounds });
    await owner.reviewerAssignment.createMany({
      data: rounds.map((r) => ({
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: r.paperId,
        roundId: r.id,
        reviewerUserId: reviewer,
        dueAt: new Date('2020-01-01'),
      })),
    });
    const timings: number[] = [];
    let firstIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const page = await api(bot + '/assignments?limit=25');
      timings.push(performance.now() - start);
      expect(page.status).toBe(200);
      expect(page.body.data).toHaveLength(25);
      expect(page.body.nextCursor).toBeTruthy();
      firstIds = page.body.data.map((r: { id: string }) => r.id);
      const next = await api(
        bot + '/assignments?limit=25&cursor=' + encodeURIComponent(page.body.nextCursor),
      );
      expect(next.status).toBe(200);
      expect(next.body.data.every((r: { id: string }) => !firstIds.includes(r.id))).toBe(true);
    }
    const r = await api(bot + '/reviewers?attention=OVERDUE&limit=1');
    expect(r.status).toBe(200);
    expect(r.body.data[0].workload.assigned).toBe(1001);
    expect(r.body.data[0].workload.remaining).toBe(1001);
    expect(r.body.data[0].workload.overdue).toBe(1001);
    console.info(
      `Synthetic 1000-paper assignment page: max ${Math.round(Math.max(...timings))}ms (5 local samples; not a production benchmark)`,
    );
  }, 60000);
  it('reads invitation acceptance, expiry and assignability without exposing tokens or unscoped contacts', async () => {
    const invites = [
      {
        id: id(),
        status: 'PENDING' as const,
        invitedUserId: null,
        expiresAt: new Date('2030-01-01'),
      },
      {
        id: id(),
        status: 'ACCEPTED' as const,
        invitedUserId: emptyReviewer,
        expiresAt: new Date('2020-01-01'),
      },
      {
        id: id(),
        status: 'PENDING' as const,
        invitedUserId: null,
        expiresAt: new Date('2020-01-01'),
      },
      {
        id: id(),
        status: 'DECLINED' as const,
        invitedUserId: null,
        expiresAt: new Date('2030-01-01'),
      },
    ];
    await owner.reviewerInvitation.createMany({
      data: invites.map((i) => ({
        ...i,
        organizationId: org,
        conferenceId: conf,
        email: i.invitedUserId ? emptyReviewer + '@example.com' : i.id + '@example.com',
        token: 'secret-' + i.id,
      })),
    });
    const r = await api(bot + '/reviewer-invitations');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(4);
    const accepted = r.body.data.find((i: { id: string }) => i.id === invites[1].id);
    expect(accepted).toMatchObject({
      status: 'ACCEPTED',
      canAssign: true,
      reviewerId: await reviewerRef(),
    });
    expect(r.body.data.find((i: { id: string }) => i.id === invites[0].id)).toMatchObject({
      status: 'PENDING',
      reviewerId: null,
      canAssign: false,
    });
    expect(r.body.data.find((i: { id: string }) => i.id === invites[2].id).status).toBe('EXPIRED');
    expect(JSON.stringify(r.body)).not.toMatch(/secret-|invitedUserId|roleNote|"token"/);
    const readKey = await newReadKey();
    const limited = await api(bot + '/reviewer-invitations', readKey);
    expect(limited.status).toBe(200);
    expect(JSON.stringify(limited.body)).not.toMatch(/@example.com|"name"|secret-/);
    expect((await api(bot + '/reviewer-invitations?email=example', readKey)).status).toBe(403);
    expect(
      (await api(bot + '/reviewer-invitations?invitationStatus=PENDING')).body.data,
    ).toHaveLength(1);
    expect(
      (await api(bot + '/reviewer-invitations?invitationStatus=EXPIRED')).body.data,
    ).toHaveLength(1);
    const first = await api(bot + '/reviewer-invitations?limit=1');
    const next = await api(
      bot + '/reviewer-invitations?limit=1&cursor=' + encodeURIComponent(first.body.nextCursor),
    );
    expect(next.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(
      (
        await api(
          bot +
            '/reviewer-invitations?invitationStatus=PENDING&cursor=' +
            encodeURIComponent(first.body.nextCursor),
        )
      ).status,
    ).toBe(400);
    expect(
      (await api(bot + '/reviewers')).body.data.every(
        (r: { status: string }) => r.status === 'ACCEPTED',
      ),
    ).toBe(true);
  });
  it('requires explicit write permission, a valid future deadline, and same-integration reviewer references', async () => {
    const body = await assignmentInput();
    expect((await write(body, await newReadKey())).status).toBe(403);
    const { dueAt: _dueAt, ...missing } = body;
    expect((await write(missing)).status).toBe(400);
    expect((await write({ ...body, dueAt: 'not-a-date' })).status).toBe(400);
    expect((await write({ ...body, dueAt: '2020-01-01T00:00:00Z' })).status).toBe(400);
    expect((await write({ ...body, reviewerId: emptyReviewer })).status).toBe(404);
    expect((await write({ ...body, paperId: foreignPaper })).status).toBe(404);
    expect(
      (await write(body, token, `/api/v1/integrations/v1/conferences/${otherConf}`)).status,
    ).toBe(404);
    const g = await store.create(context, {
      name: 'Foreign references',
      scopes: ['reviewers:read'],
    });
    const p = await store.authenticate(parseCredential('Bearer ' + token)!);
    const ref = (await store.references({ ...p, integrationId: g.id }, [emptyReviewer]))[0]!;
    expect((await write({ ...body, reviewerId: ref.id })).status).toBe(404);
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(0);
  });
  it('creates a deadline assignment, audits atomically, and replays without duplicate work or email', async () => {
    const body = await assignmentInput();
    const r = await write(body);
    expect(r.status).toBe(201);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({
      replayed: false,
      data: {
        paperId: body.paperId,
        reviewerId: body.reviewerId,
        dueAt: '2030-01-02T12:00:00.000Z',
        deadlineSource: 'INDIVIDUAL',
        status: 'ASSIGNED',
      },
    });
    expect(JSON.stringify(r.body)).not.toMatch(/reviewerUserId|@example.com|secretHash/);
    expect(assignmentEmail).toHaveBeenCalledOnce();
    expect(assignmentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: r.body.data.id,
        dueAt: '2030-01-02T12:00:00.000Z',
        to: emptyReviewer + '@example.com',
      }),
    );
    const row = await owner.reviewerAssignment.findUniqueOrThrow({ where: { id: r.body.data.id } });
    expect(row.dueAt?.toISOString()).toBe(r.body.data.dueAt);
    expect((await owner.paper.findUniqueOrThrow({ where: { id: body.paperId } })).status).toBe(
      'UNDER_REVIEW',
    );
    expect(
      await owner.auditLog.count({
        where: { entityId: row.id, action: 'integration.assignment.created' },
      }),
    ).toBe(1);
    const replay = await write(body);
    expect(replay.status).toBe(201);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.data).toEqual(r.body.data);
    expect(assignmentEmail).toHaveBeenCalledOnce();
    expect((await write({ ...body, dueAt: '2030-02-01T00:00:00Z' })).status).toBe(409);
    expect((await write({ ...body, requestId: id() })).status).toBe(409);
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(1);
    const logs = await owner.apiIntegrationAccessLog.findMany({
      where: { integrationId: grant.id, method: 'POST', status: 201 },
    });
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });
  it('serializes concurrent identical writes into one assignment and one notification', async () => {
    const body = await assignmentInput();
    const results = await Promise.all([write(body), write(body)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results.map((r) => r.body.replayed).sort()).toEqual([false, true]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(1);
    expect(assignmentEmail).toHaveBeenCalledOnce();
  });
  it('blocks assignments to pending or removed reviewers and exposes inactive roster status', async () => {
    const body = await assignmentInput();
    const role = await owner.roleGrant.findFirstOrThrow({
      where: { membership: { userId: emptyReviewer, conferenceId: conf }, role: 'REVIEWER' },
    });
    await owner.roleGrant.delete({ where: { id: role.id } });
    try {
      expect((await write(body)).status).toBe(409);
      const invites = await api(bot + '/reviewer-invitations?invitationStatus=ACCEPTED');
      expect(invites.body.data[0]).toMatchObject({ canAssign: false, reviewerId: null });
    } finally {
      await owner.roleGrant.create({ data: role });
    }
    const pending = await owner.user.create({
      data: { id: id(), name: 'Pending', email: id() + '@example.com' },
    });
    const pendingRef = await reviewerRef(pending.id);
    await owner.reviewerInvitation.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        email: pending.email,
        invitedUserId: pending.id,
        status: 'PENDING',
        expiresAt: new Date('2030-01-01'),
        token: id(),
      },
    });
    expect((await write({ ...body, reviewerId: pendingRef })).status).toBe(409);
  });
  it.each(['authorship', 'declared', 'bid'] as const)('blocks %s conflicts', async (kind) => {
    const body = await assignmentInput();
    if (kind === 'authorship')
      await owner.authorship.create({
        data: {
          id: id(),
          paperId: body.paperId,
          userId: emptyReviewer,
          order: 1,
          fullName: 'Reviewer author',
          email: emptyReviewer + '@example.com',
          isCorresponding: true,
        },
      });
    if (kind === 'declared')
      await owner.conflictOfInterest.create({
        data: {
          id: id(),
          organizationId: org,
          conferenceId: conf,
          userId: emptyReviewer,
          paperId: body.paperId,
          type: 'PERSONAL',
          source: 'SELF',
        },
      });
    if (kind === 'bid')
      await owner.bid.create({
        data: {
          id: id(),
          organizationId: org,
          conferenceId: conf,
          paperId: body.paperId,
          reviewerUserId: emptyReviewer,
          value: 'CONFLICT',
        },
      });
    expect((await write(body)).status).toBe(409);
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(0);
    expect(assignmentEmail).not.toHaveBeenCalled();
  });
  it('rejects drafts, withdrawals, decided cycles and historical cycles', async () => {
    const body = await assignmentInput();
    expect((await write({ ...body, paperId: draft })).status).toBe(404);
    expect((await write({ ...body, paperId: withdrawn })).status).toBe(409);
    const old = await owner.reviewRound.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: body.paperId,
        roundNumber: 1,
      },
    });
    const current = await owner.reviewRound.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: body.paperId,
        roundNumber: 2,
      },
    });
    expect((await write({ ...body, cycleId: old.id })).status).toBe(409);
    expect((await write({ ...body, cycleId: cycle })).status).toBe(404);
    await owner.decision.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: body.paperId,
        roundId: current.id,
        decidedById: chair,
        outcome: 'REJECT',
      },
    });
    expect((await write(body)).status).toBe(409);
  });
  it('rolls back the assignment, cycle and idempotency record when access logging fails', async () => {
    const body = await assignmentInput();
    const spy = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValueOnce(new Error('Audit unavailable'));
    try {
      expect((await write(body)).status).toBe(503);
    } finally {
      spy.mockRestore();
    }
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(0);
    expect(await owner.reviewRound.count({ where: { paperId: body.paperId } })).toBe(0);
    expect(
      await owner.apiIntegrationMutation.count({
        where: { integrationId: grant.id, requestId: body.requestId },
      }),
    ).toBe(0);
    expect(assignmentEmail).not.toHaveBeenCalled();
    expect((await write(body)).status).toBe(201);
  });
  it('returns an actionable email warning without creating duplicate assignments on retry', async () => {
    const body = await assignmentInput();
    assignmentEmail.mockRejectedValueOnce(new Error('Queue unavailable'));
    const r = await write(body);
    expect(r.status).toBe(201);
    expect(r.body.notificationWarning).toContain('Assignment saved');
    expect((await write(body)).body.replayed).toBe(true);
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(1);
    expect(assignmentEmail).toHaveBeenCalledOnce();
  });
  it('requires a newly scoped key after granting write access to an existing read integration', async () => {
    const scopes = ['papers:read', 'reviewers:read', 'assignments:read'] as const;
    const g = await store.create(context, { name: 'Upgrade test', scopes: [...scopes] });
    const old = await store.issue(context, g.id, {
      label: 'Read-only',
      scopes: [...scopes],
      expiresInDays: 30,
      requestId: id(),
    });
    await store.change(context, g.id, {
      version: g.version,
      scopes: [...scopes, 'assignments:write'],
    });
    const body = await assignmentInput();
    expect((await write(body, old.token)).status).toBe(403);
    const fresh = await store.issue(context, g.id, {
      label: 'Write',
      scopes: [...scopes, 'assignments:write'],
      expiresInDays: 30,
      requestId: id(),
    });
    const principal = await store.authenticate(parseCredential('Bearer ' + fresh.token)!);
    const ref = (await store.references(principal, [emptyReviewer]))[0]!;
    expect((await write({ ...body, reviewerId: ref.id }, fresh.token)).status).toBe(201);
    await store.revokeKey(context, g.id, parseCredential('Bearer ' + fresh.token)!.id);
    expect((await write({ ...body, reviewerId: ref.id }, fresh.token)).status).toBe(401);
  });
  it('protects the idempotency ledger with real tenant RLS and insert-only privileges', async () => {
    expect(
      await withTenantContext(
        { userId: chair, organizationId: otherOrg, conferenceId: foreignConf },
        (tx) => tx.apiIntegrationMutation.count(),
      ),
    ).toBe(0);
    await expect(
      withTenantContext(context, (tx) =>
        tx.apiIntegrationMutation.deleteMany({ where: { integrationId: grant.id } }),
      ),
    ).rejects.toThrow();
  });
  it('rechecks key revocation, MFA and write grants inside an already-authenticated mutation', async () => {
    const p = await store.authenticate(parseCredential('Bearer ' + token)!);
    const writer = app.get(BotWriteService);
    const body = await assignmentInput();
    await owner.apiIntegrationKey.update({
      where: { id: p.keyId },
      data: { revokedAt: new Date() },
    });
    try {
      await expect(writer.assign(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      await owner.apiIntegrationKey.update({ where: { id: p.keyId }, data: { revokedAt: null } });
    }
    await owner.user.update({ where: { id: chair }, data: { twoFactorEnabled: false } });
    try {
      await expect(writer.assign(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      await owner.user.update({ where: { id: chair }, data: { twoFactorEnabled: true } });
    }
    await owner.apiIntegration.update({
      where: { id: grant.id },
      data: { scopes: baseScopes.filter((s) => s !== 'assignments:write') },
    });
    try {
      await expect(writer.assign(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await owner.apiIntegration.update({
        where: { id: grant.id },
        data: { scopes: [...baseScopes] },
      });
    }
    expect(await owner.reviewerAssignment.count({ where: { paperId: body.paperId } })).toBe(0);
  });
  it('generates normalized, deduplicated pending invitation links without sending mail', async () => {
    const email = author + '@example.com';
    const body = { requestId: id(), emails: ['  ' + email.toUpperCase() + '  ', email] };
    const r = await invite(body);
    expect(r.status).toBe(201);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.replayed).toBe(false);
    const invitation = r.body.data[0];
    expect(invitation).toMatchObject({ email, status: 'PENDING' });
    const link = new URL(invitation.invitationUrl);
    expect(link.pathname).toBe('/sign-in');
    expect(link.searchParams.get('reviewerInvite')).toMatch(/^[a-f0-9]{64}$/);
    const saved = await owner.reviewerInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(saved.invitedUserId).toBe(author);
    expect(saved.token).toBe(link.searchParams.get('reviewerInvite'));
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBeGreaterThan(6.99 * 86400000);
    expect(
      await owner.membership.count({
        where: { userId: author, conferenceId: conf, roles: { some: { role: 'REVIEWER' } } },
      }),
    ).toBe(0);
    expect((await api(bot + `/reviewer-invitations/${saved.id}/link`, inviteToken)).body).toEqual(
      invitation,
    );
    const retry = await invite({ ...body, emails: [email] });
    expect(retry.status).toBe(201);
    expect(retry.body).toMatchObject({ replayed: true, data: r.body.data });
    expect((await invite({ requestId: id(), emails: [email] })).body.data).toEqual(r.body.data);
    expect((await invite({ ...body, emails: ['other@example.com'] })).status).toBe(409);
    expect(assignmentEmail).not.toHaveBeenCalled();
    expect(sendInvitationMail).not.toHaveBeenCalled();
    const ledger = await owner.apiIntegrationMutation.findUniqueOrThrow({
      where: {
        integrationId_requestId: { integrationId: inviteGrant.id, requestId: body.requestId },
      },
    });
    expect(ledger.response).toEqual({ operation: 'invitations.generate', ids: [saved.id] });
    const audits = await owner.auditLog.findMany({ where: { entityId: saved.id } });
    const logs = await owner.apiIntegrationAccessLog.findMany({
      where: { integrationId: inviteGrant.id },
    });
    for (const text of [JSON.stringify(ledger), JSON.stringify(audits), JSON.stringify(logs)]) {
      expect(text).not.toContain(saved.token);
      expect(text).not.toContain(email);
      expect(text).not.toContain('reviewerInvite=');
    }
  });
  it.each([
    { emails: [] },
    { emails: ['invalid'] },
    { emails: Array.from({ length: 26 }, (_, i) => `batch-${i}@example.com`) },
    { emails: ['valid@example.com'], delivery: 'EMAIL' },
    { emails: ['valid@example.com'], requestId: 'bad' },
  ])('validates invitation batches before making changes: %j', async (input) => {
    const count = await owner.reviewerInvitation.count({ where: { conferenceId: conf } });
    expect((await invite({ requestId: id(), ...input })).status).toBe(400);
    expect(await owner.reviewerInvitation.count({ where: { conferenceId: conf } })).toBe(count);
    expect(sendInvitationMail).not.toHaveBeenCalled();
  });
  it('supports the maximum batch and overlapping concurrent integrations without duplicate pending invitations', async () => {
    const g = await store.create(inviteContext, {
      name: 'Second invitation bot',
      scopes: [...invitationScopes],
    });
    const k = await store.issue(inviteContext, g.id, {
      label: 'Second invite key',
      scopes: [...invitationScopes],
      expiresInDays: 1,
      requestId: id(),
    });
    const emails = Array.from({ length: 25 }, (_, i) => `${id()}-${i}@example.com`);
    const [first, second] = await Promise.all([
      invite({ requestId: id(), emails }),
      invite({ requestId: id(), emails: emails.slice().reverse() }, k.token),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data).toHaveLength(25);
    expect(second.body.data).toEqual(first.body.data);
    expect(
      await owner.reviewerInvitation.count({
        where: { conferenceId: conf, email: { in: emails }, status: 'PENDING' },
      }),
    ).toBe(25);
  });
  it('removes pending invitations, invalidates links and never recreates them on replay', async () => {
    const body = { requestId: id(), emails: [`${id()}@example.com`] };
    const created = await invite(body);
    const row = created.body.data[0];
    const requestId = id();
    expect((await removeInvite(row.id, requestId)).body).toMatchObject({
      removed: true,
      replayed: false,
    });
    expect((await api(bot + `/reviewer-invitations/${row.id}/link`, inviteToken)).status).toBe(404);
    expect((await removeInvite(row.id, requestId)).body).toMatchObject({
      removed: true,
      replayed: true,
    });
    expect((await removeInvite(row.id, id())).status).toBe(404);
    const replay = await invite(body);
    expect(replay.body).toMatchObject({
      replayed: true,
      data: [{ id: row.id, status: 'REMOVED', invitationUrl: null }],
    });
    expect(await owner.reviewerInvitation.count({ where: { id: row.id } })).toBe(0);
    expect((await invite({ requestId, emails: body.emails })).status).toBe(409);
    const replacement = (await invite({ ...body, requestId: id() })).body.data[0];
    expect(replacement.id).not.toBe(row.id);
    expect((await removeInvite(replacement.id, requestId)).status).toBe(409);
  });
  it.each(['ACCEPTED', 'DECLINED', 'EXPIRED'] as const)(
    'protects %s invitations and omits consumed links from replays',
    async (status) => {
      const body = { requestId: id(), emails: [`${id()}@example.com`] };
      const row = (await invite(body)).body.data[0];
      await owner.reviewerInvitation.update({ where: { id: row.id }, data: { status } });
      expect((await api(bot + `/reviewer-invitations/${row.id}/link`, inviteToken)).status).toBe(
        409,
      );
      expect((await removeInvite(row.id, id())).status).toBe(409);
      const replay = await invite(body);
      expect(replay.body.data[0]).toMatchObject({ id: row.id, status, invitationUrl: null });
      expect(await owner.reviewerInvitation.count({ where: { id: row.id } })).toBe(1);
    },
  );
  it('treats elapsed pending links as expired and allows their removal', async () => {
    const body = { requestId: id(), emails: [`${id()}@example.com`] };
    const row = (await invite(body)).body.data[0];
    await owner.reviewerInvitation.update({
      where: { id: row.id },
      data: { expiresAt: new Date('2020-01-01') },
    });
    expect((await api(bot + `/reviewer-invitations/${row.id}/link`, inviteToken)).status).toBe(409);
    expect((await invite(body)).body.data[0]).toMatchObject({
      status: 'EXPIRED',
      invitationUrl: null,
    });
    expect((await removeInvite(row.id, id())).status).toBe(200);
  });
  it('requires explicit invitation scopes and conceals foreign invitations', async () => {
    const row = (await invite({ requestId: id(), emails: [`${id()}@example.com`] })).body.data[0];
    expect((await invite({ requestId: id(), emails: ['blocked@example.com'] }, token)).status).toBe(
      403,
    );
    expect((await api(bot + `/reviewer-invitations/${row.id}/link`)).status).toBe(403);
    expect((await removeInvite(row.id, id(), token)).status).toBe(403);
    const list = await api(bot + '/reviewer-invitations?limit=100', inviteToken);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('reviewerInvite=');
    const foreign = await owner.reviewerInvitation.create({
      data: {
        id: id(),
        organizationId: otherOrg,
        conferenceId: foreignConf,
        email: 'foreign@example.com',
        token: id(),
        expiresAt: new Date('2030-01-01'),
      },
    });
    expect((await api(bot + `/reviewer-invitations/${foreign.id}/link`, inviteToken)).status).toBe(
      404,
    );
    expect((await removeInvite(foreign.id, id())).status).toBe(404);
    expect(
      (
        await invite(
          { requestId: id(), emails: ['blocked@example.com'] },
          inviteToken,
          `/api/v1/integrations/v1/conferences/${otherConf}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await api(bot + `/reviewer-invitations/${row.id}/link?email=x`, inviteToken)).status,
    ).toBe(400);
  });
  it('uses the normal email-bound acceptance and keeps accepted invitations intact', async () => {
    const user = await owner.user.create({
      data: { id: id(), name: 'Invited test reviewer', email: `${id()}@example.com` },
    });
    const body = { requestId: id(), emails: [user.email] };
    const row = (await invite(body)).body.data[0];
    const token = new URL(row.invitationUrl).searchParams.get('reviewerInvite')!;
    const humanInvitations = app.get(InvitationsService);
    await expect(humanInvitations.accept(author, token)).rejects.toMatchObject({ status: 403 });
    await humanInvitations.accept(user.id, token);
    expect(
      await owner.membership.count({
        where: { userId: user.id, conferenceId: conf, roles: { some: { role: 'REVIEWER' } } },
      }),
    ).toBe(1);
    expect((await removeInvite(row.id, id())).status).toBe(409);
    expect((await invite(body)).body.data[0]).toMatchObject({
      status: 'ACCEPTED',
      invitationUrl: null,
    });
    expect(sendInvitationMail).not.toHaveBeenCalled();
  });
  it('rolls back whole batches and removal if atomic access auditing is unavailable', async () => {
    const body = { requestId: id(), emails: [`${id()}@example.com`, `${id()}@example.com`] };
    const spy = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValueOnce(new Error('Audit unavailable'));
    try {
      expect((await invite(body)).status).toBe(503);
    } finally {
      spy.mockRestore();
    }
    expect(await owner.reviewerInvitation.count({ where: { email: { in: body.emails } } })).toBe(0);
    expect(
      await owner.apiIntegrationMutation.count({
        where: { integrationId: inviteGrant.id, requestId: body.requestId },
      }),
    ).toBe(0);
    const created = await invite(body);
    const requestId = id();
    const spy2 = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValueOnce(new Error('Audit unavailable'));
    try {
      expect((await removeInvite(created.body.data[0].id, requestId)).status).toBe(503);
    } finally {
      spy2.mockRestore();
    }
    expect(await owner.reviewerInvitation.count({ where: { id: created.body.data[0].id } })).toBe(
      1,
    );
    expect(
      await owner.apiIntegrationMutation.count({
        where: { integrationId: inviteGrant.id, requestId },
      }),
    ).toBe(0);
  });
  it('restricts invitation grants, keys and reauthorization to organizers and org admins', async () => {
    await expect(
      store.create(context, { name: 'Chair blocked', scopes: [...invitationScopes] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      store.issue(context, inviteGrant.id, {
        label: 'Chair blocked',
        scopes: [...invitationScopes],
        expiresInDays: 1,
        requestId: id(),
      }),
    ).rejects.toMatchObject({ status: 403 });
    const g = await store.detail(inviteContext, inviteGrant.id);
    await expect(
      store.change(context, g.id, { version: g.version }, 'reauthorized'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      store.change(inviteContext, grant.id, {
        version: (await store.detail(context, grant.id)).version,
        scopes: [...INTEGRATION_SCOPES],
      }),
    ).rejects.toMatchObject({ status: 403 });
    const upgraded = await store.create(inviteContext, {
      name: 'Explicit upgrade',
      scopes: ['reviewers:read', 'reviewers:identity:read', 'reviewers:contacts:read'],
    });
    const oldKey = await store.issue(inviteContext, upgraded.id, {
      label: 'Old read key',
      scopes: ['reviewers:read', 'reviewers:identity:read', 'reviewers:contacts:read'],
      expiresInDays: 1,
      requestId: id(),
    });
    await store.change(inviteContext, upgraded.id, {
      version: upgraded.version,
      scopes: [...invitationScopes],
    });
    expect(
      (await invite({ requestId: id(), emails: ['blocked@example.com'] }, oldKey.token)).status,
    ).toBe(403);
  });
  it('rechecks invitation authority, revocation and scopes for already-authenticated operations', async () => {
    const p = await store.authenticate(parseCredential('Bearer ' + inviteToken)!);
    const service = app.get(BotInvitationsService);
    const body = { requestId: id(), emails: [`${id()}@example.com`] };
    const membership = await owner.membership.findFirstOrThrow({
      where: { userId: organizer, conferenceId: conf },
      include: { roles: true },
    });
    await owner.roleGrant.update({
      where: { id: membership.roles[0]!.id },
      data: { role: 'CHAIR' },
    });
    try {
      await expect(service.generate(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await owner.roleGrant.update({
        where: { id: membership.roles[0]!.id },
        data: { role: 'ORGANIZER' },
      });
    }
    await owner.apiIntegrationKey.update({
      where: { id: p.keyId },
      data: { revokedAt: new Date() },
    });
    try {
      await expect(service.generate(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      await owner.apiIntegrationKey.update({ where: { id: p.keyId }, data: { revokedAt: null } });
    }
    await owner.apiIntegration.update({
      where: { id: inviteGrant.id },
      data: { scopes: invitationScopes.filter((s) => s !== 'invitations:write') },
    });
    try {
      await expect(service.generate(p, body, id(), performance.now())).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await owner.apiIntegration.update({
        where: { id: inviteGrant.id },
        data: { scopes: [...invitationScopes] },
      });
    }
    expect(await owner.reviewerInvitation.count({ where: { email: body.emails[0] } })).toBe(0);
  });
  it('allows link-only keys to read but not generate or remove invitations', async () => {
    const k = await store.issue(inviteContext, inviteGrant.id, {
      label: 'Link reads only',
      scopes: invitationScopes.filter((s) => s !== 'invitations:write'),
      expiresInDays: 1,
      requestId: id(),
    });
    const row = (await invite({ requestId: id(), emails: [`${id()}@example.com`] })).body.data[0];
    expect((await api(bot + `/reviewer-invitations/${row.id}/link`, k.token)).status).toBe(200);
    expect(
      (await invite({ requestId: id(), emails: [`${id()}@example.com`] }, k.token)).status,
    ).toBe(403);
    expect((await removeInvite(row.id, id(), k.token)).status).toBe(403);
    await store.revokeKey(inviteContext, inviteGrant.id, k.key.id);
  });
  it('serializes acceptance and removal without leaving membership from a removed invitation', async () => {
    const user = await owner.user.create({
      data: { id: id(), name: 'Concurrent invitee', email: `${id()}@example.com` },
    });
    const row = (await invite({ requestId: id(), emails: [user.email] })).body.data[0];
    const invitationToken = new URL(row.invitationUrl).searchParams.get('reviewerInvite')!;
    const [accepted, removed] = await Promise.allSettled([
      app.get(InvitationsService).accept(user.id, invitationToken),
      removeInvite(row.id, id()).then((r) => r.status),
    ]);
    const saved = await owner.reviewerInvitation.findUnique({ where: { id: row.id } });
    const memberships = await owner.membership.count({
      where: { userId: user.id, conferenceId: conf, roles: { some: { role: 'REVIEWER' } } },
    });
    if (saved) {
      expect(saved.status).toBe('ACCEPTED');
      expect(memberships).toBe(1);
      expect(accepted.status).toBe('fulfilled');
      expect(removed).toMatchObject({ status: 'fulfilled', value: 409 });
    } else {
      expect(memberships).toBe(0);
      expect(accepted.status).toBe('rejected');
      expect(removed).toMatchObject({ status: 'fulfilled', value: 200 });
    }
  });
  it('keeps simultaneous invitation acceptance retries idempotent for the invited account', async () => {
    const user = await owner.user.create({
      data: { id: id(), name: 'Acceptance retry', email: `${id()}@example.com` },
    });
    const row = (await invite({ requestId: id(), emails: [user.email] })).body.data[0];
    const token = new URL(row.invitationUrl).searchParams.get('reviewerInvite')!;
    const service = app.get(InvitationsService);
    const results = await Promise.all([
      service.accept(user.id, token),
      service.accept(user.id, token),
    ]);
    expect(results.every((r) => r.invitation.status === 'ACCEPTED')).toBe(true);
    expect(
      await owner.membership.count({
        where: { userId: user.id, conferenceId: conf, roles: { some: { role: 'REVIEWER' } } },
      }),
    ).toBe(1);
  });
});
