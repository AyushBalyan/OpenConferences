import 'reflect-metadata';
import { reviewerOperationsContract } from '@openconferences/contracts';
import type { Request, Response, NextFunction } from 'express';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import Redis from 'ioredis';
import request from 'supertest';
import { REDIS_CLIENT } from '../redis/redis.module';
import { InvitationPublicController } from '../review/invitation-public.controller';
import { ReviewerOperationsController } from './reviewer-operations.controller';
import { IntegrationLimiter } from './integration.limiter';
import { ProblemExceptionFilter } from '../common/filters/problem-exception.filter';
import { PayloadComplexityMiddleware } from '../common/middleware/payload-complexity.middleware';
import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  prisma,
  withTenantContext,
  assertSafeDatabaseRole,
  processInvitationBatchChunk,
  newInvitationSecret,
  declineInvitationToken,
} from '@openconferences/db';
import { getConfig } from '@openconferences/config/env';
import { INTEGRATION_SCOPES } from '@openconferences/schemas';
import { IntegrationStore } from './integration.store';
import { parseCredential, type IntegrationPrincipal } from './integration.security';
import { InvitationOperationsService } from './invitation-operations.service';
import { InvitationBatchService } from './invitation-batch.service';
import { ReviewerCoverageService } from './reviewer-coverage.service';
import { InvitationsService } from '../review/invitations.service';
import { BotWriteService } from './bot-write.service';
import { RoundsService } from '../review/rounds.service';
import { ReviewsService } from '../review/reviews.service';
import { ReviewCoordinationService } from '../review/coordination.service';
import { ConferenceService } from '../tenancy/conference.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { QueueService } from '../queue/queue.service';
import { CoiCheckService } from '../review/coi-check.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
const id = () => randomUUID();
const owner = new PrismaClient({ datasourceUrl: process.env.BOT_API_TEST_OWNER_URL });
const workerUrl = new URL(process.env.BOT_API_TEST_DATABASE_URL!);
workerUrl.username = 'openconferences_worker';
const worker = new PrismaClient({ datasourceUrl: workerUrl.toString() });
const org = id(),
  conf = id(),
  foreign = id(),
  organizer = id(),
  reviewer = id(),
  track = id();
const secret = getConfig().auth.secret;
const ctx = { userId: organizer, organizationId: org, conferenceId: conf };
const conferenceService = {
  loadConference: (userId: string, conferenceId: string) =>
    withTenantContext({ userId, conferenceId }, (tx) =>
      tx.conference.findFirstOrThrow({ where: { id: conferenceId } }),
    ),
} as ConferenceService;
const invitations = new InvitationsService(
  conferenceService,
  { log: vi.fn() } as unknown as AuditService,
  { signInMagicLink: vi.fn() } as unknown as AuthService,
);
const store = new IntegrationStore(conferenceService);
const operations = new InvitationOperationsService(store);
const queue = { enqueueInvitationBatch: vi.fn().mockResolvedValue(true) };
const batches = new InvitationBatchService(store, queue as unknown as QueueService);
let app: NestExpressApplication;
const redis = new Redis(process.env.BOT_API_TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
let bearer: string;
let p: IntegrationPrincipal;
let keyId: string;
async function makeInvite(email = id() + '@example.com') {
  const token = newInvitationSecret(secret);
  const row = await owner.reviewerInvitation.create({
    data: {
      id: id(),
      organizationId: org,
      conferenceId: conf,
      conferenceName: 'Reviewer operations test',
      email,
      token: token.token,
      tokenCiphertext: token.tokenCiphertext,
      expiresAt: new Date(Date.now() + 86400000),
      sentAt: new Date(),
    },
  });
  return { row, raw: token.raw, decline: declineInvitationToken(row, secret) };
}
async function assignmentFixture() {
  const paper = await owner.paper.create({
    data: {
      id: id(),
      organizationId: org,
      conferenceId: conf,
      trackId: track,
      submittedById: organizer,
      title: 'Synthetic security paper',
      abstract: 'Synthetic',
      keywords: [],
      status: 'UNDER_REVIEW',
    },
  });
  const round = await owner.reviewRound.create({
    data: {
      id: id(),
      organizationId: org,
      conferenceId: conf,
      paperId: paper.id,
      roundNumber: 1,
      reviewDueAt: new Date('2030-01-01'),
    },
  });
  const assignment = await owner.reviewerAssignment.create({
    data: {
      id: id(),
      organizationId: org,
      conferenceId: conf,
      paperId: paper.id,
      roundId: round.id,
      reviewerUserId: reviewer,
      dueAt: new Date('2030-01-01'),
    },
  });
  const draft = await owner.review.create({
    data: {
      id: id(),
      organizationId: org,
      conferenceId: conf,
      paperId: paper.id,
      roundId: round.id,
      assignmentId: assignment.id,
      reviewerUserId: reviewer,
      scores: {},
      commentsToAuthors: 'Preserved security draft',
    },
  });
  return { paper, round, assignment, draft };
}
async function chunk(batchId: string) {
  return worker.$transaction((tx) => processInvitationBatchChunk(tx, batchId, secret), {
    timeout: 20000,
  });
}
describe('Reviewer operations against isolated PostgreSQL and real restricted roles', () => {
  beforeAll(async () => {
    const marker = await owner.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM bot_test.bot_api_test_marker`;
    if (!marker.some((m) => m.id === process.env.BOT_API_TEST_MARKER))
      throw new Error('Task-owned marker mismatch');
    await assertSafeDatabaseRole();
    await owner.organization.create({ data: { id: org, slug: org, name: 'Reviewer local test' } });
    await owner.user.createMany({
      data: [
        {
          id: organizer,
          email: organizer + '@example.com',
          name: 'Organizer',
          twoFactorEnabled: true,
        },
        { id: reviewer, email: reviewer + '@example.com', name: 'Reviewer' },
      ],
    });
    await owner.conference.createMany({
      data: [
        {
          id: conf,
          organizationId: org,
          name: 'Reviewer operations test',
          slug: conf,
          authorJoinToken: id(),
          status: 'REVIEWING',
          reviewDueAt: new Date('2030-01-01'),
        },
        {
          id: foreign,
          organizationId: org,
          name: 'Other private conference',
          slug: foreign,
          authorJoinToken: id(),
        },
      ],
    });
    await owner.membership.create({
      data: {
        id: id(),
        userId: organizer,
        organizationId: org,
        conferenceId: conf,
        scope: 'CONFERENCE',
        roles: { create: { id: id(), role: 'ORGANIZER' } },
      },
    });
    await owner.track.create({
      data: { id: track, organizationId: org, conferenceId: conf, name: 'Research', slug: track },
    });
    const grant = await store.create(ctx, {
      name: 'Reviewer operations',
      scopes: [...INTEGRATION_SCOPES],
    });
    const credential = await store.issue(ctx, grant.id, {
      label: 'Local synthetic',
      scopes: [...INTEGRATION_SCOPES],
      requestId: id(),
      expiresInDays: 30,
    });
    const parsed = parseCredential('Bearer ' + credential.token)!;
    keyId = parsed.id;
    p = await store.authenticate(parsed);
    bearer = credential.token;
    const module = await Test.createTestingModule({
      controllers: [InvitationPublicController, ReviewerOperationsController],
      providers: [
        { provide: InvitationsService, useValue: invitations },
        { provide: IntegrationStore, useValue: store },
        { provide: InvitationOperationsService, useValue: operations },
        { provide: InvitationBatchService, useValue: batches },
        {
          provide: BotWriteService,
          useValue: new BotWriteService(
            store,
            new RoundsService(conferenceService, { log: vi.fn() } as unknown as AuditService),
            new CoiCheckService(),
            {
              publishReviewerAssigned: vi.fn().mockResolvedValue(true),
            } as unknown as NotificationPublisher,
            new ReviewCoordinationService(conferenceService, new CoiCheckService(), {
              publishReviewerAssigned: vi.fn().mockResolvedValue(true),
            } as unknown as NotificationPublisher),
          ),
        },
        { provide: ReviewerCoverageService, useValue: new ReviewerCoverageService(store) },
        IntegrationLimiter,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useBodyParser('json', { limit: '2mb' });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemExceptionFilter());
    const complexity = new PayloadComplexityMiddleware();
    app.use((req: Request, res: Response, next: NextFunction) => complexity.use(req, res, next));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await redis.quit();
    await owner.$disconnect();
    await worker.$disconnect();
    await prisma.$disconnect();
  });
  it('serves public decline without authentication, rejects foreign origins and applies token rate limits', async () => {
    const invite = await makeInvite();
    const endpoint = '/api/v1/reviewer-invitations/public/';
    const lookup = await request(app.getHttpServer())
      .post(endpoint + 'status')
      .send({ token: invite.decline });
    expect(lookup.status).toBe(200);
    expect(lookup.body.state).toBe('SENT');
    expect(lookup.headers['cache-control']).toBe('no-store');
    expect(lookup.headers['referrer-policy']).toBe('no-referrer');
    expect(
      (
        await request(app.getHttpServer())
          .post(endpoint + 'decline')
          .set('Origin', 'https://foreign.example')
          .send({ token: invite.decline })
      ).status,
    ).toBe(403);
    const confirmed = await request(app.getHttpServer())
      .post(endpoint + 'decline')
      .set('Cookie', 'different-user')
      .send({ token: invite.decline });
    expect(confirmed.body).toMatchObject({ state: 'DECLINED', confirmed: true });
    for (let i = 0; i < 8; i++)
      await request(app.getHttpServer())
        .post(endpoint + 'status')
        .send({ token: invite.decline });
    expect(
      (
        await request(app.getHttpServer())
          .post(endpoint + 'status')
          .send({ token: invite.decline })
      ).status,
    ).toBe(429);
    const api = `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations`;
    expect((await request(app.getHttpServer()).get(api + '/invitations')).status).toBe(401);
    const scoped = await request(app.getHttpServer())
      .get(api + '/invitations')
      .set('Authorization', 'Bearer ' + bearer);
    expect(scoped.status).toBe(200);
    expect(
      reviewerOperationsContract.operationsInvitations.responses[200].safeParse(scoped.body)
        .success,
    ).toBe(true);
    expect(scoped.body.counts.DECLINED).toBeGreaterThan(0);
    expect(
      (
        await request(app.getHttpServer())
          .get(api.replace(conf, foreign) + '/invitations')
          .set('Authorization', 'Bearer ' + bearer)
      ).status,
    ).toBe(404);
  });
  it('accepts a structured 1,000-row HTTP body and rejects oversized row counts before enqueue', async () => {
    const endpoint = `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-batches`;
    const rows = Array.from({ length: 1000 }, (_, row) => ({
      rowId: `http-${row}`,
      name: 'Synthetic Researcher',
      email: `http-${row}@example.test`,
      affiliation: 'Synthetic Research Institute',
      researchFields: ['computing', 'systems'],
    }));
    const response = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', 'Bearer ' + bearer)
      .send({ requestId: id(), rows });
    expect(response.status).toBe(202);
    expect(
      reviewerOperationsContract.operationsInvitationBatch.responses[202].safeParse(response.body)
        .success,
    ).toBe(true);
    expect(response.body.total).toBe(1000);
    expect((await batches.status(p, response.body.id)).processed).toBe(0);
    expect(
      (
        await request(app.getHttpServer())
          .post(endpoint)
          .set('Authorization', 'Bearer ' + bearer)
          .send({ requestId: id(), rows: [...rows, rows[0]] })
      ).status,
    ).toBe(413);
    const failure = vi.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('private redis error'));
    const invite = await makeInvite();
    const unavailable = await request(app.getHttpServer())
      .post('/api/v1/reviewer-invitations/public/status')
      .send({ token: invite.decline });
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(unavailable.body)).not.toContain('private redis error');
    failure.mockRestore();
  });
  it('security regression: removed response permission is rechecked before decrypting private reasons', async () => {
    const invite = await makeInvite();
    await invitations.publicDecline(invite.decline, true, 'Synthetic private reason');
    try {
      await owner.apiIntegrationKey.update({
        where: { id: keyId },
        data: { scopes: p.scopes.filter((scope) => scope !== 'invitations:responses:read') },
      });
      await expect(
        operations.list(p, { limit: 25, email: invite.row.email }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await owner.apiIntegrationKey.update({ where: { id: keyId }, data: { scopes: p.scopes } });
    }
    try {
      await owner.apiIntegration.update({
        where: { id: p.integrationId },
        data: { scopes: p.scopes.filter((scope) => scope !== 'invitations:responses:read') },
      });
      await expect(
        operations.list(p, { limit: 25, email: invite.row.email }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await owner.apiIntegration.update({
        where: { id: p.integrationId },
        data: { scopes: p.scopes },
      });
    }
  });
  it('security regression: failed access auditing rolls back lifecycle changes and request ledgers', async () => {
    const invite = await makeInvite(),
      requestId = id();
    const fail = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValue(new Error('Synthetic audit failure'));
    let response;
    try {
      response = await request(app.getHttpServer())
        .post(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitations/${invite.row.id}/actions`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({ requestId, action: 'REISSUE', version: 0 });
    } finally {
      fail.mockRestore();
    }
    const saved = await owner.reviewerInvitation.findUniqueOrThrow({
      where: { id: invite.row.id },
    });
    expect(saved.version).toBe(0);
    expect(saved.token).toBe(invite.row.token);
    expect(
      await owner.apiIntegrationMutation.count({
        where: { integrationId: p.integrationId, requestId },
      }),
    ).toBe(0);
    expect(response!.status).toBe(503);
  });
  it('security regression: failed access auditing rolls back batch submission and default settings', async () => {
    const requestId = id();
    const before = await owner.conference.findUniqueOrThrow({ where: { id: conf } });
    const fail = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValue(new Error('Synthetic audit failure'));
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-batches`)
        .set('Authorization', 'Bearer ' + bearer)
        .send({
          requestId,
          rows: [
            {
              name: 'Audit researcher',
              email: id() + '@example.test',
              affiliation: '',
              researchFields: [],
            },
          ],
        });
      await request(app.getHttpServer())
        .patch(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-settings`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({ lifetimeDays: 17 });
    } finally {
      fail.mockRestore();
    }
    expect(
      await owner.reviewerInvitationBatch.count({
        where: { integrationId: p.integrationId, requestId },
      }),
    ).toBe(0);
    const after = await owner.conference.findUniqueOrThrow({ where: { id: conf } });
    expect(after.invitationLifetimeDays).toBe(before.invitationLifetimeDays);
    expect(after.version).toBe(before.version);
  });
  it('security regression: malformed or overflowing change cursors return a controlled 400', async () => {
    for (const cursor of ['9'.repeat(100), '9223372036854775808', '-1', 'not-a-cursor']) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-changes`)
        .query({ cursor })
        .set('Authorization', 'Bearer ' + bearer);
      expect(response.status).toBe(400);
    }
  });
  it('security regression: a worker waiting for the conference lock rechecks a revoked credential', async () => {
    const job = await batches.submit(p, {
      requestId: id(),
      rows: [
        {
          name: 'Lock researcher',
          email: id() + '@example.test',
          affiliation: '',
          researchFields: [],
        },
      ],
    });
    const applicationName = 'reviewer-security-' + id();
    let pending: ReturnType<typeof chunk> | undefined;
    try {
      await owner.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${conf}`},0))::text`;
          pending = worker.$transaction(
            async (workerTx) => {
              await workerTx.$executeRaw`SELECT set_config('application_name', ${applicationName}, true)`;
              return processInvitationBatchChunk(workerTx, job.id, secret);
            },
            { timeout: 20000 },
          );
          let waiting = false;
          for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
            const rows = await owner.$queryRaw<
              Array<{ waiting: boolean }>
            >`SELECT (wait_event_type='Lock' AND wait_event='advisory') AS waiting FROM pg_stat_activity WHERE application_name=${applicationName}`;
            waiting = rows.some((row) => row.waiting);
            if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
          }
          expect(waiting).toBe(true);
          await owner.apiIntegrationKey.update({
            where: { id: keyId },
            data: { revokedAt: new Date() },
          });
        },
        { timeout: 10000 },
      );
      expect(await pending!).toMatchObject({ done: true, processed: 0 });
      expect(
        (await owner.reviewerInvitationBatch.findUniqueOrThrow({ where: { id: job.id } })).status,
      ).toBe('CANCELLED');
    } finally {
      if (pending) await pending.catch(() => {});
      await owner.apiIntegrationKey.update({ where: { id: keyId }, data: { revokedAt: null } });
    }
  });
  it('security regression: batch retries ignore JSON object key order', async () => {
    const requestId = id(),
      email = id() + '@example.test';
    const first = await batches.submit(p, {
      requestId,
      rows: [
        {
          name: 'Ordered researcher',
          email,
          affiliation: 'Institute',
          researchFields: ['systems'],
        },
      ],
    });
    const replay = await batches.submit(p, {
      requestId,
      rows: [
        {
          researchFields: ['systems'],
          affiliation: 'Institute',
          email,
          name: 'Ordered researcher',
        },
      ],
    });
    expect(replay).toMatchObject({ id: first.id, replayed: true });
  });
  it('security regression: audited assignment actions roll back on access log failure', async () => {
    const fixture = await assignmentFixture();
    const fail = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValue(new Error('Synthetic audit failure'));
    try {
      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/assignments/${fixture.assignment.id}/actions`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({ requestId: id(), action: 'RELEASE', version: 0, reason: 'Synthetic audit test' });
      expect(response.status).toBe(503);
      expect(
        (await owner.reviewerAssignment.findUniqueOrThrow({ where: { id: fixture.assignment.id } }))
          .status,
      ).toBe('ASSIGNED');
      expect(
        (await owner.review.findUniqueOrThrow({ where: { id: fixture.draft.id } }))
          .commentsToAuthors,
      ).toBe('Preserved security draft');
    } finally {
      fail.mockRestore();
      await owner.paper.update({ where: { id: fixture.paper.id }, data: { status: 'WITHDRAWN' } });
    }
  });
  it('security regression: replacement rejects a reviewer account deleted after its reference was issued', async () => {
    const fixture = await assignmentFixture(),
      target = id();
    await owner.user.create({
      data: { id: target, name: 'Removed researcher', email: target + '@example.test' },
    });
    await owner.membership.create({
      data: {
        id: id(),
        userId: target,
        organizationId: org,
        conferenceId: conf,
        scope: 'CONFERENCE',
        roles: { create: { id: id(), role: 'REVIEWER' } },
      },
    });
    const reference = (await store.references(p, [target]))[0]!;
    await owner.user.update({ where: { id: target }, data: { deletedAt: new Date() } });
    try {
      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/assignments/${fixture.assignment.id}/actions`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({
          requestId: id(),
          action: 'REPLACE',
          version: 0,
          reason: 'Synthetic inactive account test',
          reviewerId: reference.id,
          dueAt: '2030-01-02T00:00:00Z',
        });
      expect(response.status).toBe(404);
      expect(
        (await owner.reviewerAssignment.findUniqueOrThrow({ where: { id: fixture.assignment.id } }))
          .status,
      ).toBe('ASSIGNED');
    } finally {
      await owner.paper.update({ where: { id: fixture.paper.id }, data: { status: 'WITHDRAWN' } });
    }
  });
  it('security regression: database pagination keeps lifecycle counts correct across terminal and elapsed states', async () => {
    const prefix = 'pagination-' + id(),
      now = new Date();
    const states = [
      {
        status: 'PENDING' as const,
        sentAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      },
      {
        status: 'PENDING' as const,
        sentAt: now,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      },
      { status: 'ACCEPTED' as const, sentAt: now, expiresAt: new Date(0), revokedAt: null },
      { status: 'DECLINED' as const, sentAt: now, expiresAt: new Date(0), revokedAt: null },
      { status: 'PENDING' as const, sentAt: now, expiresAt: new Date(0), revokedAt: null },
      {
        status: 'EXPIRED' as const,
        sentAt: now,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      },
      {
        status: 'EXPIRED' as const,
        sentAt: now,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: now,
      },
    ];
    await owner.reviewerInvitation.createMany({
      data: states.map((state, index) => ({
        id: id(),
        organizationId: org,
        conferenceId: conf,
        email: `${prefix}-${index}@example.test`,
        token: id(),
        ...state,
      })),
    });
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await operations.list(p, {
        limit: 1,
        email: prefix,
        ...(cursor ? { cursor: cursor.toUpperCase() } : {}),
      });
      expect(page.counts).toEqual({
        PENDING: 1,
        SENT: 1,
        ACCEPTED: 1,
        DECLINED: 1,
        EXPIRED: 2,
        REVOKED: 1,
      });
      expect(page.data).toHaveLength(1);
      expect(seen.has(page.data[0]!.id)).toBe(false);
      seen.add(page.data[0]!.id);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.size).toBe(7);
    expect(
      (await operations.list(p, { limit: 100, email: prefix, lifecycle: 'EXPIRED' })).data,
    ).toHaveLength(2);
    await expect(operations.list(p, { limit: 25, cursor: 'a'.repeat(36) })).rejects.toMatchObject({
      status: 400,
    });
  });
  it('security regression: bulk extension keeps each committed row coupled to its access audit', async () => {
    const invite = await makeInvite();
    const fail = vi
      .spyOn(store, 'recordInTransaction')
      .mockRejectedValue(new Error('Synthetic audit failure'));
    let response;
    try {
      response = await request(app.getHttpServer())
        .post(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-extensions`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({
          operations: [
            {
              invitationId: invite.row.id,
              requestId: id(),
              version: 0,
              action: 'EXTEND',
              lifetimeDays: 14,
            },
          ],
        });
    } finally {
      fail.mockRestore();
    }
    expect(response!.status).toBe(503);
    expect(
      (await owner.reviewerInvitation.findUniqueOrThrow({ where: { id: invite.row.id } })).version,
    ).toBe(0);
  });
  it('security regression: malformed database text in one upload row cannot poison valid peer rows', async () => {
    const duplicateEmail = id() + '@example.test';
    const row = (extra: Record<string, unknown> = {}) => ({
      name: 'Synthetic text researcher',
      email: id() + '@example.test',
      affiliation: 'Institute',
      researchFields: ['systems'],
      ...extra,
    });
    const job = await batches.submit(p, {
      requestId: id(),
      rows: [
        row(),
        row({ name: 'Unsupported\u0000name' }),
        row(),
        row({ rowId: 'bad\u0000row', email: duplicateEmail }),
        row({ email: duplicateEmail }),
        row({ affiliation: 'Unpaired\ud800' }),
        row(),
      ],
    });
    expect(await chunk(job.id)).toMatchObject({ done: true, processed: 7 });
    const saved = await owner.reviewerInvitationBatch.findUniqueOrThrow({ where: { id: job.id } });
    expect((saved.results as Array<{ outcome: string }>).map((result) => result.outcome)).toEqual([
      'CREATED',
      'INVALID',
      'CREATED',
      'INVALID',
      'CREATED',
      'INVALID',
      'CREATED',
    ]);
  });
  it('security regression: extension batches stop starting work before the admission lease expires', async () => {
    const first = await makeInvite(),
      second = await makeInvite();
    const original = operations.operate.bind(operations);
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const operate = vi.spyOn(operations, 'operate').mockImplementation(async (...args) => {
      const result = await original(...args);
      clock.mockReturnValue(31000);
      return result;
    });
    try {
      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/integrations/v1/conferences/${conf}/reviewer-operations/invitation-extensions`,
        )
        .set('Authorization', 'Bearer ' + bearer)
        .send({
          operations: [first, second].map((invite) => ({
            invitationId: invite.row.id,
            requestId: id(),
            version: 0,
            action: 'EXTEND',
            lifetimeDays: 14,
          })),
        });
      expect(response.status).toBe(200);
      expect(response.body.data[0].success).toBe(true);
      expect(response.body.data[1]).toMatchObject({ success: false, status: 503 });
      expect(operate).toHaveBeenCalledTimes(1);
      expect(
        (await owner.reviewerInvitation.findUniqueOrThrow({ where: { id: second.row.id } }))
          .version,
      ).toBe(0);
    } finally {
      operate.mockRestore();
      clock.mockRestore();
    }
  });
  it('marks generated links Sent and protects secrets while preserving identity-bound acceptance', async () => {
    const issued = await invitations.issue(
      organizer,
      conf,
      { email: id() + '@example.com', delivery: 'LINK_ONLY', lifetimeDays: 4 },
      ['ORGANIZER'],
    );
    expect(issued.status).toBe('PENDING');
    expect(issued.lifecycleStatus).toBe('SENT');
    expect(issued.sentAt).toBeTruthy();
    expect(issued.declineUrl).toContain('#token=');
    const saved = await owner.reviewerInvitation.findUniqueOrThrow({ where: { id: issued.id } });
    const raw = new URL(issued.invitationUrl).searchParams.get('reviewerInvite')!;
    await expect(invitations.accept(reviewer, saved.token)).rejects.toThrow('Invitation not found');
    expect(saved.token).toMatch(/^sha256:/);
    expect(saved.token).not.toBe(raw);
    expect(saved.tokenCiphertext).not.toContain(raw);
    await expect(invitations.accept(reviewer, raw)).rejects.toThrow('does not match');
    expect(await owner.membership.count({ where: { conferenceId: conf, userId: reviewer } })).toBe(
      0,
    );
  });
  it('supports public confirmation, encrypted reasons, terminal replay, and cross-conference denial', async () => {
    const invite = await makeInvite();
    expect((await invitations.publicDecline(invite.decline, false)).state).toBe('SENT');
    expect(
      (await owner.reviewerInvitation.findUniqueOrThrow({ where: { id: invite.row.id } })).status,
    ).toBe('PENDING');
    expect(await invitations.publicDecline(invite.decline, true, 'Private response')).toMatchObject(
      { state: 'DECLINED', confirmed: true },
    );
    expect((await invitations.publicDecline(invite.decline, true)).state).toBe('DECLINED');
    await expect(invitations.accept(reviewer, invite.raw)).rejects.toThrow();
    const saved = await owner.reviewerInvitation.findUniqueOrThrow({
      where: { id: invite.row.id },
    });
    expect(saved.declineReasonEncrypted).not.toContain('Private response');
    expect(
      await withTenantContext({ ...ctx, conferenceId: foreign }, (tx) =>
        tx.reviewerInvitationChange.count(),
      ),
    ).toBe(0);
    const list = await operations.list(p, { limit: 100, email: invite.row.email });
    expect(list.data[0].declineReason).toBe('Private response');
    const limited = { ...p, scopes: p.scopes.filter((s) => s !== 'invitations:responses:read') };
    expect(
      (await operations.list(limited, { limit: 100, email: invite.row.email })).data[0],
    ).not.toHaveProperty('declineReason');
    expect(
      JSON.stringify(
        await owner.reviewerInvitationChange.findMany({
          where: { invitationId: invite.row.id },
          select: { action: true, version: true },
        }),
      ),
    ).not.toMatch(/Private response|sha256:|token/);
  });
  it('retains old mailed tokens and enforces elapsed expiry before the sweep runs', async () => {
    const user = id();
    await owner.user.create({
      data: { id: user, name: 'Legacy invite', email: user + '@example.com' },
    });
    const legacyToken = id();
    const legacy = await owner.reviewerInvitation.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        email: user + '@example.com',
        token: legacyToken,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    expect((await invitations.accept(user, legacyToken)).invitation.status).toBe('ACCEPTED');
    const membership = await owner.membership.findFirstOrThrow({
      where: { userId: user, conferenceId: conf },
    });
    await owner.roleGrant.deleteMany({ where: { membershipId: membership.id, role: 'REVIEWER' } });
    await invitations.accept(user, legacyToken);
    expect(
      await owner.roleGrant.count({ where: { membershipId: membership.id, role: 'REVIEWER' } }),
    ).toBe(0);

    const expired = await makeInvite();
    await owner.reviewerInvitation.update({
      where: { id: expired.row.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await invitations.publicDecline(expired.decline, true)).state).toBe('EXPIRED');
    const before = await operations.changes(p, { limit: 100 });
    expect(before.data.some((row) => row.invitationId === legacy.id)).toBe(true);
    await expect(
      withTenantContext(ctx, (tx) =>
        tx.reviewerInvitationChange.deleteMany({ where: { invitationId: legacy.id } }),
      ),
    ).rejects.toThrow();
    await expect(
      worker.reviewerInvitationChange.deleteMany({ where: { invitationId: legacy.id } }),
    ).rejects.toThrow();
  });
  it('serializes accept/decline races with coherent reviewer membership', async () => {
    for (let i = 0; i < 8; i++) {
      const user = id();
      await owner.user.create({
        data: { id: user, name: 'Synthetic race', email: user + '@example.com' },
      });
      const invite = await makeInvite(user + '@example.com');
      await Promise.allSettled([
        invitations.accept(user, invite.raw),
        invitations.publicDecline(invite.decline, true),
      ]);
      const saved = await owner.reviewerInvitation.findUniqueOrThrow({
        where: { id: invite.row.id },
      });
      expect(['ACCEPTED', 'DECLINED']).toContain(saved.status);
      const membership = await owner.membership.count({
        where: { userId: user, conferenceId: conf, roles: { some: { role: 'REVIEWER' } } },
      });
      expect(membership).toBe(saved.status === 'ACCEPTED' ? 1 : 0);
      expect(
        await owner.reviewerInvitationChange.count({ where: { invitationId: invite.row.id } }),
      ).toBe(1);
    }
  });
  it('extends without rotation, reissues both secrets, and revokes without deleting history', async () => {
    const invite = await makeInvite();
    const extended = await operations.operate(p, invite.row.id, {
      action: 'EXTEND',
      version: 0,
      requestId: id(),
      lifetimeDays: 3,
    });
    expect(new URL(extended.invitationUrl!).searchParams.get('reviewerInvite')).toBe(invite.raw);
    const requestId = id();
    const reissued = await operations.operate(p, invite.row.id, {
      action: 'REISSUE',
      version: 1,
      requestId,
      lifetimeDays: 4,
    });
    expect(reissued.declineUrl).not.toContain(invite.decline);
    expect(new URL(reissued.invitationUrl!).searchParams.get('reviewerInvite')).not.toBe(
      invite.raw,
    );
    expect((await invitations.publicDecline(invite.decline, true)).state).toBe('INVALID');
    await expect(invitations.accept(reviewer, invite.raw)).rejects.toThrow();
    expect(
      (
        await operations.operate(p, invite.row.id, {
          action: 'REISSUE',
          version: 1,
          requestId,
          lifetimeDays: 4,
        })
      ).replayed,
    ).toBe(true);
    const revoked = await operations.operate(p, invite.row.id, {
      action: 'REVOKE',
      version: 2,
      requestId: id(),
    });
    expect(revoked.invitation.lifecycleStatus).toBe('REVOKED');
    expect(await owner.reviewerInvitation.count({ where: { id: invite.row.id } })).toBe(1);
    const reinvited = await operations.operate(p, invite.row.id, {
      action: 'REINVITE',
      version: 3,
      requestId: id(),
    });
    expect(reinvited.invitation.id).not.toBe(invite.row.id);
    const changes = await operations.changes(p, { limit: 100 });
    expect(changes.data.some((row) => row.invitationId === invite.row.id)).toBe(true);
  });
  it('processes 1,000 mixed rows under the worker role, resumes chunks, and retains one result per row', async () => {
    const existing = await makeInvite();
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      rowId: `row-${i}`,
      name: `Researcher ${i}`,
      email: `${id()}@example.com`,
      affiliation: 'Synthetic institute',
      researchFields: ['computing'],
    }));
    rows[1].email = 'invalid';
    rows[2].email = rows[0].email;
    rows[3].email = existing.row.email;
    const requestId = id();
    const queued = queue.enqueueInvitationBatch.mock.calls.length;
    const input = { requestId, rows, lifetimeDays: 5 };
    const job = await batches.submit(p, input);
    expect((await batches.submit(p, input)).replayed).toBe(true);
    expect(queue.enqueueInvitationBatch).toHaveBeenCalledTimes(queued + 1);
    expect(await chunk(job.id)).toMatchObject({ done: false, processed: 25 });
    expect(await chunk(job.id)).toMatchObject({ done: false, processed: 50 });
    const started = performance.now();
    for (;;) {
      if ((await chunk(job.id)).done) break;
    }
    const saved = await owner.reviewerInvitationBatch.findUniqueOrThrow({ where: { id: job.id } });
    expect(saved.status).toBe('COMPLETED');
    expect(saved.processed).toBe(1000);
    expect(saved.results).toHaveLength(1000);
    const results = saved.results as Array<{ outcome: string }>;
    expect(results[1].outcome).toBe('INVALID');
    expect(results[2].outcome).toBe('DUPLICATE_IN_BATCH');
    expect(results[3].outcome).toBe('EXISTING');
    expect(results.filter((row) => row.outcome === 'CREATED')).toHaveLength(997);
    expect(await chunk(job.id)).toMatchObject({ done: true, processed: 1000 });
    expect(
      (await batches.results(p, job.id, { offset: 0, limit: 5 })).data[0].invitationUrl,
    ).toBeTruthy();
    await owner.reviewerInvitationBatch.update({
      where: { id: job.id },
      data: { expiresAt: new Date(0) },
    });
    const expired = await batches.results(p, job.id, { offset: 0, limit: 5 });
    expect(expired.resultsExpired).toBe(true);
    expect(expired.data[0].invitationUrl).toBeNull();
    expect(expired.data[0]).not.toHaveProperty('input');
    console.info(
      `Synthetic 1,000-row remaining 950-row processing: ${Math.round(performance.now() - started)}ms`,
    );
  }, 90000);
  it('releases unfinished work through the shared integration service, retaining drafts and updating coverage', async () => {
    await owner.membership.create({
      data: {
        id: id(),
        userId: reviewer,
        organizationId: org,
        conferenceId: conf,
        scope: 'CONFERENCE',
        roles: { create: { id: id(), role: 'REVIEWER' } },
      },
    });
    const paper = await owner.paper.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        trackId: track,
        submittedById: organizer,
        title: 'Release synthetic paper',
        abstract: 'Synthetic',
        keywords: [],
        status: 'UNDER_REVIEW',
      },
    });
    const round = await owner.reviewRound.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: paper.id,
        roundNumber: 1,
        reviewDueAt: new Date('2030-01-01'),
      },
    });
    const assignment = await owner.reviewerAssignment.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: paper.id,
        roundId: round.id,
        reviewerUserId: reviewer,
        dueAt: new Date('2020-01-01'),
      },
    });
    const draft = await owner.review.create({
      data: {
        id: id(),
        organizationId: org,
        conferenceId: conf,
        paperId: paper.id,
        roundId: round.id,
        assignmentId: assignment.id,
        reviewerUserId: reviewer,
        scores: {},
        commentsToAuthors: 'Retained draft',
      },
    });
    const coi = new CoiCheckService();
    const rounds = new RoundsService(conferenceService, {
      log: vi.fn(),
    } as unknown as AuditService);
    const notifications = {
      publishReviewerAssigned: vi.fn().mockResolvedValue(true),
    } as unknown as NotificationPublisher;
    const coordination = new ReviewCoordinationService(conferenceService, coi, notifications);
    const writes = new BotWriteService(store, rounds, coi, notifications, coordination);
    const coverage = new ReviewerCoverageService(store);
    expect(await coverage.summary(p, { limit: 100 })).toMatchObject({
      eligiblePapers: 1,
      oneActive: 1,
      zeroActive: 0,
      overdueOnly: 1,
    });
    const operation = {
      requestId: id(),
      version: 0,
      action: 'RELEASE' as const,
      reason: 'Organizer reassigned workload',
    };
    expect((await writes.intervene(p, assignment.id, operation)).replayed).toBe(false);
    expect((await writes.intervene(p, assignment.id, operation)).replayed).toBe(true);
    const saved = await owner.reviewerAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(saved.status).toBe('REPLACED');
    expect(saved.releasedAt).toBeTruthy();
    expect(saved.releaseReason).toBe(operation.reason);
    expect(
      (await owner.review.findUniqueOrThrow({ where: { id: draft.id } })).commentsToAuthors,
    ).toBe('Retained draft');
    expect(await coverage.summary(p, { limit: 100 })).toMatchObject({
      eligiblePapers: 1,
      zeroActive: 1,
      oneActive: 0,
      overdueOnly: 0,
      operationallyUncovered: 1,
    });
    const reviews = new ReviewsService(
      conferenceService,
      rounds,
      coi,
      { log: vi.fn() } as unknown as AuditService,
      notifications,
    );
    await expect(
      reviews.submitReview(reviewer, conf, assignment.id, { version: 0 }, ['REVIEWER']),
    ).rejects.toThrow('Only the assigned reviewer');
    await expect(
      writes.intervene(p, assignment.id, { ...operation, requestId: id(), version: 1 }),
    ).rejects.toThrow('unfinished active');
    await owner.reviewerAssignment.update({
      where: { id: assignment.id },
      data: { status: 'COMPLETED', releasedAt: null },
    });
    await owner.review.update({ where: { id: draft.id }, data: { submittedAt: new Date() } });
    await expect(
      writes.intervene(p, assignment.id, { ...operation, requestId: id(), version: 1 }),
    ).rejects.toThrow('unfinished active');
  });
  it('commits queue references atomically and rolls back jobs when the invitation transaction fails', async () => {
    const realQueue = new QueueService();
    await realQueue.onModuleInit();
    try {
      const batchId = id();
      const count = () =>
        owner.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT count(*) FROM pgboss.job WHERE name='reviewer.invitation_batch' AND data->>'batchId'=${batchId}`;
      await expect(
        withTenantContext(ctx, async (tx) => {
          await realQueue.enqueueInvitationBatch(batchId, tx);
          throw new Error('rollback fixture');
        }),
      ).rejects.toThrow('rollback fixture');
      expect((await count())[0].count).toBe(0n);
      await withTenantContext(ctx, (tx) => realQueue.enqueueInvitationBatch(batchId, tx));
      expect((await count())[0].count).toBe(1n);
      const jobs = await owner.$queryRaw<
        Array<{ data: unknown }>
      >`SELECT data FROM pgboss.job WHERE name='reviewer.invitation_batch' AND data->>'batchId'=${batchId}`;
      expect(jobs[0].data).toEqual({ batchId });
    } finally {
      await realQueue.onModuleDestroy();
    }
  });
  it('cancels queued work when its credential is revoked and restricts worker key reads', async () => {
    const job = await batches.submit(p, {
      requestId: id(),
      rows: [
        { name: 'Cancelled', email: id() + '@example.com', affiliation: '', researchFields: [] },
      ],
    });
    await owner.apiIntegrationKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    expect(await chunk(job.id)).toMatchObject({ done: true, processed: 0 });
    expect(
      (await owner.reviewerInvitationBatch.findUniqueOrThrow({ where: { id: job.id } })).status,
    ).toBe('CANCELLED');
    await expect(
      worker.apiIntegrationKey.findMany({ select: { secretHash: true } }),
    ).rejects.toThrow();
    await owner.apiIntegrationKey.update({ where: { id: keyId }, data: { revokedAt: null } });
  });
});
