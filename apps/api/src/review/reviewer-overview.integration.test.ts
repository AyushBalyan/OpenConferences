import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PgBoss from 'pg-boss';
import {
  PrismaClient,
  prismaQueueAdapter,
  withTenantContext,
  type Prisma,
} from '@openconferences/db';
import { REVIEWER_DIGEST_JOB_NAME, NOTIFICATION_SEND_JOB_NAME } from '@openconferences/schemas';
import { ReviewerOverviewService } from './reviewer-overview.service';
import { processReviewerDigestJob } from '../../../worker/src/reviewer-digest';
const runtime = vi.hoisted(() => ({ db: null as PrismaClient | null, failAudit: false }));
vi.mock('@openconferences/db', async (original) => {
  const actual = await original<typeof import('@openconferences/db')>();
  return {
    ...actual,
    withTenantContext: async (
      ctx: { userId?: string; conferenceId?: string; organizationId?: string },
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options: object = {},
    ) => {
      if (!runtime.db) throw new Error('Temp database not initialized');
      return runtime.db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            ctx.userId
              ? 'SET LOCAL ROLE openconferences_api'
              : 'SET LOCAL ROLE openconferences_worker',
          );
          await tx.$queryRaw`SELECT set_config('app.current_user_id',${ctx.userId ?? ''},true),set_config('app.current_conference_id',${ctx.conferenceId ?? ''},true),set_config('app.current_org_id',${ctx.organizationId ?? ''},true)`;
          return fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'auditLog' && runtime.failAudit)
                  return {
                    create: async () => {
                      throw new Error('Simulated audit failure');
                    },
                  };
                return Reflect.get(target, key);
              },
            }),
          );
        },
        { timeout: 15000, ...options },
      );
    },
  };
});
const url = process.env.REVIEWER_OVERVIEW_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    parsed.pathname !== '/reviewer_overview_test'
  )
    throw new Error('Requires isolated local reviewer_overview_test database');
}
describe.skipIf(!url)(
  'reviewer overview + durable digests with real PostgreSQL/RLS/pg-boss',
  () => {
    const db = new PrismaClient({
      datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/reviewer_overview_test',
    });
    const boss = new PgBoss({
      connectionString: url ?? 'postgresql://unused@127.0.0.1:1/reviewer_overview_test',
      schema: 'pgboss',
    });
    const org = randomUUID(),
      conf = randomUUID(),
      track = randomUUID(),
      paper = randomUUID(),
      round = randomUUID(),
      chair = randomUUID(),
      reviewer = randomUUID(),
      zero = randomUUID(),
      author = randomUUID(),
      assignment = randomUUID();
    const extraUsers: string[] = [];
    const targets = [{ id: assignment, version: 0 }];
    const queue = {
      enqueueReviewerDigest: (
        input: { digestId: string; requestId: string },
        tx: Prisma.TransactionClient,
      ) =>
        boss.send(REVIEWER_DIGEST_JOB_NAME, input, {
          db: prismaQueueAdapter(tx),
          singletonKey: input.requestId,
        }),
    };
    const conferences = {
      loadConference: () => db.conference.findUniqueOrThrow({ where: { id: conf } }),
    };
    const service = new ReviewerOverviewService(conferences as never, queue as never);
    const preview = () => service.preview(chair, conf, reviewer, ['CHAIR'], targets);
    const request = async (requestId = randomUUID()) => {
      const p = await preview();
      return service.send(chair, conf, reviewer, ['CHAIR'], {
        assignments: targets,
        requestId,
        previewToken: p.previewToken,
      });
    };
    beforeAll(async () => {
      runtime.db = db;
      await boss.start();
      await boss.createQueue(REVIEWER_DIGEST_JOB_NAME);
      await boss.createQueue(NOTIFICATION_SEND_JOB_NAME);
      await db.$executeRawUnsafe(
        'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA pgboss TO openconferences_api,openconferences_worker',
      );
      await db.organization.create({ data: { id: org, name: 'Overview test', slug: org } });
      await db.conference.create({
        data: {
          id: conf,
          organizationId: org,
          name: 'Overview test',
          slug: conf,
          authorJoinToken: randomUUID(),
          status: 'REVIEWING',
        },
      });
      for (const [id, role] of [
        [chair, 'CHAIR'],
        [reviewer, 'REVIEWER'],
        [zero, 'REVIEWER'],
        [author, 'AUTHOR'],
      ] as const) {
        await db.user.create({ data: { id, name: role, email: `${id}@example.test` } });
        await db.membership.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            scope: 'CONFERENCE',
            userId: id,
            roles: { create: { id: randomUUID(), role } },
          },
        });
      }
      await db.track.create({
        data: { id: track, organizationId: org, conferenceId: conf, name: 'Systems', slug: track },
      });
      await db.paper.create({
        data: {
          id: paper,
          organizationId: org,
          conferenceId: conf,
          trackId: track,
          title: 'A <safe> paper',
          abstract: 'Test',
          keywords: [],
          status: 'UNDER_REVIEW',
          submittedById: author,
        },
      });
      await db.reviewRound.create({
        data: {
          id: round,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundNumber: 1,
        },
      });
      await db.reviewerAssignment.create({
        data: {
          id: assignment,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundId: round,
          reviewerUserId: reviewer,
          dueAt: new Date('2030-10-10T10:00:00Z'),
        },
      });
    });
    beforeEach(async () => {
      runtime.failAudit = false;
      await db.reviewerReminderDigest.deleteMany({ where: { conferenceId: conf } });
      await db.notificationLog.deleteMany({ where: { conferenceId: conf } });
      await db.emailSuppression.deleteMany({ where: { email: `${reviewer}@example.test` } });
      await db.review.deleteMany({ where: { conferenceId: conf } });
      await db.reviewerAssignment.update({
        where: { id: assignment },
        data: { status: 'ASSIGNED', version: 0, dueAt: new Date('2030-10-10T10:00:00Z') },
      });
    });
    afterAll(async () => {
      await db.reviewerReminderDigest.deleteMany({ where: { conferenceId: conf } });
      await db.notificationLog.deleteMany({ where: { conferenceId: conf } });
      await db.auditLog.deleteMany({ where: { conferenceId: conf } });
      await db.emailSuppression.deleteMany({ where: { email: `${reviewer}@example.test` } });
      await db.review.deleteMany({ where: { conferenceId: conf } });
      await db.reviewerAssignment.deleteMany({ where: { conferenceId: conf } });
      await db.reviewRound.deleteMany({ where: { conferenceId: conf } });
      await db.paper.deleteMany({ where: { conferenceId: conf } });
      await db.track.deleteMany({ where: { conferenceId: conf } });
      await db.membership.deleteMany({ where: { conferenceId: conf } });
      await db.conference.delete({ where: { id: conf } });
      await db.user.deleteMany({
        where: { id: { in: [chair, reviewer, zero, author, ...extraUsers] } },
      });
      await db.organization.delete({ where: { id: org } });
      await boss.stop();
      await db.$disconnect();
      runtime.db = null;
    });
    it('returns the complete roster, saved deadline, and genuine submitted state', async () => {
      const overview = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
      expect(overview.data).toHaveLength(2);
      const searched = await service.overview(chair, conf, ['CHAIR'], {
        history: 'CURRENT',
        paperSearch: overview.data.find((r) => r.userId === reviewer)!.assignments[0]!.paperTitle,
      });
      expect(searched.data).toHaveLength(1);
      expect(searched.roster).toHaveLength(2);
      expect(overview.data.find((r) => r.userId === zero)).toMatchObject({
        assigned: 0,
        remaining: 0,
      });
      expect(overview.data.find((r) => r.userId === reviewer)).toMatchObject({
        assigned: 1,
        remaining: 1,
        notStarted: 1,
        earliestDeadline: '2030-10-10T10:00:00.000Z',
      });
      await db.reviewerAssignment.update({
        where: { id: assignment },
        data: { status: 'COMPLETED' },
      });
      const inconsistent = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
      expect(inconsistent.data.find((r) => r.userId === reviewer)?.inconsistent).toBe(true);
    });
    it('denies author/reviewer service access', async () => {
      await expect(
        service.overview(author, conf, ['AUTHOR'], { history: 'CURRENT' }),
      ).rejects.toThrow('permission');
    });
    it('enforces digest row security for authors and mismatched conferences', async () => {
      await request();
      const read = (userId: string, conferenceId: string) =>
        withTenantContext({ userId, conferenceId, organizationId: org }, (tx) =>
          tx.reviewerReminderDigest.findMany({ where: { conferenceId: conf } }),
        );
      expect(await read(author, conf)).toHaveLength(0);
      expect(await read(reviewer, conf)).toHaveLength(0);
      expect(await read(chair, randomUUID())).toHaveLength(0);
      expect(await read(chair, conf)).toHaveLength(1);
    });
    it('supports platform administration without permitting deletion of reservations', async () => {
      const admin = randomUUID();
      extraUsers.push(admin);
      await db.user.create({
        data: { id: admin, name: 'Platform admin', email: `${admin}@example.test` },
      });
      const membership = await db.membership.create({
        data: {
          id: randomUUID(),
          organizationId: org,
          userId: admin,
          scope: 'ORGANIZATION',
          roles: { create: { id: randomUUID(), role: 'PLATFORM_ADMIN' } },
        },
      });
      try {
        const p = await service.preview(admin, conf, reviewer, ['PLATFORM_ADMIN'], targets);
        const result = await service.send(admin, conf, reviewer, ['PLATFORM_ADMIN'], {
          assignments: targets,
          requestId: randomUUID(),
          previewToken: p.previewToken,
        });
        expect(result.status).toBe('PREPARING');
        await expect(
          withTenantContext({ userId: chair, conferenceId: conf, organizationId: org }, (tx) =>
            tx.reviewerReminderDigest.deleteMany({ where: { id: result.digestId } }),
          ),
        ).rejects.toThrow('permission denied');
      } finally {
        await db.membership.delete({ where: { id: membership.id } });
      }
    });
    it('allows an organisation administrator without a conference membership', async () => {
      const admin = randomUUID();
      extraUsers.push(admin);
      await db.user.create({
        data: { id: admin, name: 'Org admin', email: `${admin}@example.test` },
      });
      const membership = await db.membership.create({
        data: {
          id: randomUUID(),
          organizationId: org,
          userId: admin,
          scope: 'ORGANIZATION',
          roles: { create: { id: randomUUID(), role: 'ORG_ADMIN' } },
        },
      });
      try {
        const p = await service.preview(admin, conf, reviewer, ['ORG_ADMIN'], targets);
        const result = await service.send(admin, conf, reviewer, ['ORG_ADMIN'], {
          assignments: targets,
          requestId: randomUUID(),
          previewToken: p.previewToken,
        });
        expect(result.status).toBe('PREPARING');
      } finally {
        await db.membership.delete({ where: { id: membership.id } });
      }
    });
    it('keeps submitted reviews with pending edits out of remaining work and reminders', async () => {
      const result = await request();
      const digest = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: result.digestId },
      });
      await db.review.create({
        data: {
          id: randomUUID(),
          organizationId: org,
          conferenceId: conf,
          assignmentId: assignment,
          roundId: round,
          paperId: paper,
          reviewerUserId: reviewer,
          submittedAt: new Date(),
          pendingEdit: { commentsToAuthors: 'Private pending changes' },
        },
      });
      const overview = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
      expect(overview.data.find((r) => r.userId === reviewer)).toMatchObject({
        submitted: 1,
        remaining: 0,
        allSubmitted: true,
      });
      expect(JSON.stringify(overview)).not.toContain('Private pending changes');
      await processReviewerDigestJob(boss, { digestId: digest.id, requestId: digest.requestId });
      expect(
        (await db.reviewerReminderDigest.findUniqueOrThrow({ where: { id: digest.id } })).status,
      ).toBe('CANCELLED');
      expect(await db.notificationLog.count({ where: { conferenceId: conf } })).toBe(0);
    });
    it('retains missing-role workload but rejects digest sending', async () => {
      const member = await db.membership.findFirstOrThrow({
        where: { userId: reviewer, conferenceId: conf },
      });
      await db.roleGrant.deleteMany({ where: { membershipId: member.id, role: 'REVIEWER' } });
      try {
        const overview = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
        expect(overview.data.find((r) => r.userId === reviewer)).toMatchObject({
          hasReviewerRole: false,
          remaining: 1,
        });
        await expect(preview()).rejects.toThrow('no longer has');
      } finally {
        await db.roleGrant.create({
          data: { id: randomUUID(), membershipId: member.id, role: 'REVIEWER' },
        });
      }
    });
    it('separates current, historical, closed and retired assignment units', async () => {
      const newer = randomUUID();
      await db.reviewRound.create({
        data: {
          id: newer,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundNumber: 2,
        },
      });
      try {
        const current = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
        expect(current.data.find((r) => r.userId === reviewer)?.assigned).toBe(0);
        const history = await service.overview(chair, conf, ['CHAIR'], { history: 'HISTORICAL' });
        expect(history.data.find((r) => r.userId === reviewer)).toMatchObject({
          assigned: 1,
          remaining: 0,
          closedIncomplete: 1,
        });
        expect(history.data.find((r) => r.userId === reviewer)?.assignments[0]?.canIntervene).toBe(
          false,
        );
        await db.reviewerAssignment.update({
          where: { id: assignment },
          data: { status: 'REPLACED' },
        });
        const all = await service.overview(chair, conf, ['CHAIR'], { history: 'ALL' });
        expect(all.data.find((r) => r.userId === reviewer)).toMatchObject({
          assigned: 0,
          remaining: 0,
        });
        expect(all.data.find((r) => r.userId === reviewer)?.assignments[0]?.workState).toBe(
          'RETIRED',
        );
      } finally {
        await db.reviewRound.delete({ where: { id: newer } });
      }
    });
    it('previews exact escaped mail, then deduplicates concurrent daily requests', async () => {
      const p = await preview();
      expect(p.html).toContain('A &lt;safe&gt; paper');
      expect(p.text).toContain('10 Oct 2030, 10:00 UTC');
      const results = await Promise.all([request(), request()]);
      expect(new Set(results.map((r) => r.digestId)).size).toBe(1);
      expect(results.filter((r) => r.alreadyRequested)).toHaveLength(1);
      expect(results[0]!.status).toBe('PREPARING');
      expect(await db.reviewerReminderDigest.count({ where: { conferenceId: conf } })).toBe(1);
    });
    it('atomically relays one digest once, with its individual deadline', async () => {
      const result = await request();
      const digest = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: result.digestId },
      });
      await processReviewerDigestJob(boss, { digestId: digest.id, requestId: digest.requestId });
      await processReviewerDigestJob(boss, { digestId: digest.id, requestId: digest.requestId });
      const updated = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: digest.id },
      });
      expect(updated.status).toBe('QUEUED');
      expect(updated.notificationLogId).toBeTruthy();
      expect(await db.notificationLog.count({ where: { conferenceId: conf } })).toBe(1);
    });
    it('cancels stale deadlines before creating an email job and permits a fresh preview', async () => {
      const result = await request();
      const digest = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: result.digestId },
      });
      await db.reviewerAssignment.update({
        where: { id: assignment },
        data: { dueAt: new Date('2030-10-11T10:00:00Z'), version: 1 },
      });
      await processReviewerDigestJob(boss, { digestId: digest.id, requestId: digest.requestId });
      expect(
        (await db.reviewerReminderDigest.findUniqueOrThrow({ where: { id: digest.id } })).status,
      ).toBe('CANCELLED');
      expect(await db.notificationLog.count({ where: { conferenceId: conf } })).toBe(0);
      const p = await service.preview(
        chair,
        conf,
        reviewer,
        ['CHAIR'],
        [{ id: assignment, version: 1 }],
      );
      const fresh = await service.send(chair, conf, reviewer, ['CHAIR'], {
        assignments: [{ id: assignment, version: 1 }],
        requestId: randomUUID(),
        previewToken: p.previewToken,
      });
      expect(fresh.status).toBe('PREPARING');
      expect(fresh.digestId).toBe(digest.id);
      await processReviewerDigestJob(boss, { digestId: digest.id, requestId: digest.requestId });
      expect(
        (await db.reviewerReminderDigest.findUniqueOrThrow({ where: { id: digest.id } })).status,
      ).toBe('PREPARING');
    });
    it('waits for a concurrent submission and cancels before the email handoff', async () => {
      const result = await request();
      const digest = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: result.digestId },
      });
      let unlock!: () => void, locked!: () => void;
      const gate = new Promise<void>((r) => {
        unlock = r;
      });
      const ready = new Promise<void>((r) => {
        locked = r;
      });
      const submit = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM review_rounds WHERE id=${round}::uuid FOR UPDATE`;
        locked();
        await gate;
        await tx.review.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            assignmentId: assignment,
            roundId: round,
            paperId: paper,
            reviewerUserId: reviewer,
            submittedAt: new Date(),
          },
        });
      });
      await ready;
      let finished = false;
      const relay = processReviewerDigestJob(boss, {
        digestId: digest.id,
        requestId: digest.requestId,
      }).finally(() => {
        finished = true;
      });
      try {
        await new Promise((r) => setTimeout(r, 50));
        expect(finished).toBe(false);
      } finally {
        unlock();
      }
      await submit;
      await relay;
      expect(
        (await db.reviewerReminderDigest.findUniqueOrThrow({ where: { id: digest.id } })).status,
      ).toBe('CANCELLED');
      expect(await db.notificationLog.count({ where: { conferenceId: conf } })).toBe(0);
    });
    it('rejects changed previews and suppressed recipients', async () => {
      const p = await preview();
      await db.reviewerAssignment.update({
        where: { id: assignment },
        data: { dueAt: new Date('2030-10-12T10:00:00Z') },
      });
      await expect(
        service.send(chair, conf, reviewer, ['CHAIR'], {
          assignments: targets,
          requestId: randomUUID(),
          previewToken: p.previewToken,
        }),
      ).rejects.toThrow('Preview again');
      await db.emailSuppression.create({
        data: { id: randomUUID(), email: `${reviewer}@example.test`, reason: 'Test' },
      });
      await expect(preview()).rejects.toThrow('suppressed');
    });
    it('rolls back both the daily reservation and queue job when audit storage fails', async () => {
      const p = await preview();
      runtime.failAudit = true;
      await expect(
        service.send(chair, conf, reviewer, ['CHAIR'], {
          assignments: targets,
          requestId: randomUUID(),
          previewToken: p.previewToken,
        }),
      ).rejects.toThrow('audit failure');
      runtime.failAudit = false;
      expect(await db.reviewerReminderDigest.count({ where: { conferenceId: conf } })).toBe(0);
    });
    it('rolls back the notification log when queue handoff fails', async () => {
      const result = await request();
      const digest = await db.reviewerReminderDigest.findUniqueOrThrow({
        where: { id: result.digestId },
      });
      await expect(
        processReviewerDigestJob(
          { send: vi.fn().mockRejectedValue(new Error('Queue down')) } as never,
          { digestId: digest.id, requestId: digest.requestId },
        ),
      ).rejects.toThrow('Queue down');
      expect(await db.notificationLog.count({ where: { conferenceId: conf } })).toBe(0);
      expect(
        (await db.reviewerReminderDigest.findUniqueOrThrow({ where: { id: digest.id } })).status,
      ).toBe('PREPARING');
    });
    it('returns 1,000 reviewers and 10,000 assignments without hidden pagination', async () => {
      const users = Array.from({ length: 1000 }, (_, n) => ({
        id: randomUUID(),
        name: `Load reviewer ${n}`,
        email: `load-${randomUUID()}@example.test`,
      }));
      extraUsers.push(...users.map((u) => u.id));
      const members = users.map((u) => ({
        id: randomUUID(),
        organizationId: org,
        conferenceId: conf,
        scope: 'CONFERENCE' as const,
        userId: u.id,
      }));
      const papers = Array.from({ length: 10 }, (_, n) => ({
        id: randomUUID(),
        organizationId: org,
        conferenceId: conf,
        trackId: track,
        title: `Load paper ${n}`,
        abstract: 'Synthetic benchmark',
        keywords: [],
        status: 'UNDER_REVIEW' as const,
        submittedById: author,
      }));
      const rounds = papers.map((p) => ({
        id: randomUUID(),
        organizationId: org,
        conferenceId: conf,
        paperId: p.id,
        roundNumber: 1,
      }));
      await db.user.createMany({ data: users });
      await db.membership.createMany({ data: members });
      await db.roleGrant.createMany({
        data: members.map((m) => ({
          id: randomUUID(),
          membershipId: m.id,
          role: 'REVIEWER' as const,
        })),
      });
      await db.paper.createMany({ data: papers });
      await db.reviewRound.createMany({ data: rounds });
      for (const r of rounds)
        await db.reviewerAssignment.createMany({
          data: users.map((u) => ({
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: r.paperId,
            roundId: r.id,
            reviewerUserId: u.id,
            dueAt: new Date('2030-10-10T10:00:00Z'),
          })),
        });
      const start = performance.now();
      const overview = await service.overview(chair, conf, ['CHAIR'], { history: 'CURRENT' });
      const elapsed = performance.now() - start;
      expect(overview.data).toHaveLength(1002);
      expect(overview.data.reduce((n, r) => n + r.assigned, 0)).toBe(10001);
      console.info(
        `Local PostgreSQL reviewer snapshot: ${elapsed.toFixed(1)}ms; ${JSON.stringify(overview).length} JSON characters; 1002 reviewers / 10001 assignments`,
      );
    });
  },
);
