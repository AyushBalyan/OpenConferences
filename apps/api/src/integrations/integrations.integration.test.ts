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
const base = `/api/v1/conferences/${conf}/integrations`,
  bot = `/api/v1/integrations/v1/conferences/${conf}`;
const context = { userId: chair, organizationId: org, conferenceId: conf };
const human = () => ({ Cookie: 'test-chair' });
const api = (url: string, key = token) =>
  request(app.getHttpServer())
    .get(url)
    .set('Authorization', 'Bearer ' + key);
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
      .send({ name: 'Test bot', scopes: [...INTEGRATION_SCOPES] });
    expect(created.status).toBe(201);
    grant = created.body;
    const issued = await request(app.getHttpServer())
      .post(base + '/' + grant.id + '/keys')
      .set(human())
      .send({ label: 'Full key', scopes: [...INTEGRATION_SCOPES], requestId: id() });
    expect(issued.status).toBe(201);
    token = issued.body.token;
    const limited = await store.issue(context, grant.id, {
      label: 'Limited',
      scopes: ['papers:read', 'reviewers:read', 'analytics:read'],
      expiresInDays: 30,
      requestId: id(),
    });
    restricted = limited.token;
  });
  beforeEach(async () => {
    for (const ip of ['::ffff:127.0.0.1', '127.0.0.1'])
      await redis.del('bot:auth:' + createHash('sha256').update(ip).digest('hex'));
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
});
