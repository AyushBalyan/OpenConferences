import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@openconferences/db';
import { lockReviewRound } from './rounds.service';
import { ReviewsService } from './reviews.service';
import { RebuttalsService } from './rebuttals.service';

const runtime = vi.hoisted(() => ({
  client: null as PrismaClient | null,
  rendezvous: null as (() => Promise<void>) | null,
}));
vi.mock('@openconferences/db', async (original) => {
  const actual = await original<typeof import('@openconferences/db')>();
  return {
    ...actual,
    withTenantContext: async (
      ctx: { userId: string; conferenceId: string; organizationId?: string },
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      if (!runtime.client) throw new Error('Test database not initialized');
      return runtime.client.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
          await tx.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true), set_config('app.current_conference_id', ${ctx.conferenceId}, true), set_config('app.current_org_id', ${ctx.organizationId ?? ''}, true)`;
          // Align both service calls after their preflight reads, at the real row lock.
          const wrapped = new Proxy(tx, {
            get(target, key) {
              if (key === '$queryRaw')
                return async (...args: Parameters<typeof tx.$queryRaw>) => {
                  const result = await target.$queryRaw(...args);
                  if (runtime.rendezvous) await runtime.rendezvous();
                  return result;
                };
              return Reflect.get(target, key);
            },
          });
          return callback(wrapped);
        },
        { timeout: 10000 },
      );
    },
  };
});

// Explicit opt-in only. Never fall back to the application's DATABASE_URL.
const url = process.env.REVIEW_LOCK_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/inbox_test') {
    throw new Error('Lock tests require the isolated local inbox_test database');
  }
}

describe.skipIf(!url)('round locks in real PostgreSQL', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/inbox_test',
  });
  const orgId = randomUUID();
  const conferenceId = randomUUID();
  const userId = randomUUID();
  const roundId = randomUUID();
  const authorId = randomUUID();
  const trackId = randomUUID();
  const paperId = randomUUID();
  const assignmentId = randomUUID();

  const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
    db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
        await tx.$queryRaw`SELECT set_config('app.current_user_id', ${userId}, true),
        set_config('app.current_org_id', ${orgId}, true),
        set_config('app.current_conference_id', ${conferenceId}, true)`;
        return fn(tx);
      },
      { timeout: 10000 },
    );

  beforeAll(async () => {
    runtime.client = db;
    await db.$transaction(async (tx) => {
      await tx.organization.create({ data: { id: orgId, name: 'Lock test', slug: orgId } });
      await tx.user.create({
        data: { id: userId, name: 'Lock tester', email: `${userId}@example.test` },
      });
      await tx.conference.create({
        data: {
          id: conferenceId,
          organizationId: orgId,
          name: 'Lock test',
          slug: conferenceId,
          authorJoinToken: randomUUID(),
        },
      });
      await tx.membership.create({
        data: {
          id: randomUUID(),
          userId,
          organizationId: orgId,
          conferenceId,
          scope: 'CONFERENCE',
        },
      });
      await tx.user.create({
        data: { id: authorId, name: 'Test author', email: `${authorId}@example.test` },
      });
      await tx.membership.create({
        data: {
          id: randomUUID(),
          userId: authorId,
          organizationId: orgId,
          conferenceId,
          scope: 'CONFERENCE',
        },
      });
      await tx.track.create({
        data: {
          id: trackId,
          organizationId: orgId,
          conferenceId,
          name: 'Test track',
          slug: trackId,
        },
      });
      await tx.paper.create({
        data: {
          id: paperId,
          organizationId: orgId,
          conferenceId,
          trackId,
          submittedById: authorId,
          title: 'Test paper',
          abstract: 'Test abstract',
          keywords: [],
        },
      });
      await tx.reviewRound.create({
        data: {
          id: roundId,
          organizationId: orgId,
          conferenceId,
          paperId,
          roundNumber: 1,
        },
      });
      await tx.reviewerAssignment.create({
        data: {
          id: assignmentId,
          organizationId: orgId,
          conferenceId,
          roundId,
          paperId,
          reviewerUserId: userId,
        },
      });
    });
  });

  afterAll(async () => {
    try {
      await db.$transaction(async (tx) => {
        await tx.rebuttal.deleteMany({ where: { paperId } });
        await tx.review.deleteMany({ where: { paperId } });
        await tx.reviewerAssignment.deleteMany({ where: { id: assignmentId } });
        await tx.paper.deleteMany({ where: { id: paperId } });
        await tx.track.deleteMany({ where: { id: trackId } });
        await tx.reviewRound.deleteMany({ where: { id: roundId } });
        await tx.membership.deleteMany({
          where: { userId: { in: [userId, authorId] }, conferenceId },
        });
        await tx.conference.deleteMany({ where: { id: conferenceId } });
        await tx.user.deleteMany({ where: { id: { in: [userId, authorId] } } });
        await tx.organization.deleteMany({ where: { id: orgId } });
      });
    } finally {
      await db.$disconnect();
    }
  });

  function gate() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  }

  async function competing<T>(left: () => Promise<T>, right: () => Promise<T>, code: string) {
    const ready = gate();
    let arrivals = 0;
    const timer = setTimeout(ready.release, 2000);
    runtime.rendezvous = async () => {
      if (++arrivals === 2) ready.release();
      await ready.promise;
    };
    try {
      const results = await Promise.allSettled([left(), right()]);
      expect(arrivals).toBe(2);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      expect(loser.reason).toMatchObject({ response: expect.objectContaining({ code }) });
    } finally {
      runtime.rendezvous = null;
      clearTimeout(timer);
      ready.release();
    }
  }

  it('actual review service rejects competing first saves and stale updates', async () => {
    await db.reviewRound.update({ where: { id: roundId }, data: { reviewsReleasedAt: null } });
    const reviews = new ReviewsService(
      { loadConference: async () => ({ organizationId: orgId, reviewConfig: {} }) } as never,
      { loadRound: () => db.reviewRound.findUniqueOrThrow({ where: { id: roundId } }) } as never,
      { checkReviewerPaperConflict: async () => ({ hasConflict: false }) } as never,
      { log: vi.fn() } as never,
      {} as never,
    );
    const save = (version: number, commentsToAuthors: string) =>
      reviews.saveReview(
        userId,
        conferenceId,
        assignmentId,
        { version, scores: {}, commentsToAuthors },
        ['REVIEWER'],
      );
    await competing(
      () => save(0, 'First A'),
      () => save(0, 'First B'),
      'REVIEW_VERSION_CONFLICT',
    );
    expect(await db.review.count({ where: { assignmentId } })).toBe(1);
    await competing(
      () => save(1, 'Updated A'),
      () => save(1, 'Updated B'),
      'REVIEW_VERSION_CONFLICT',
    );
    const persisted = await db.review.findUniqueOrThrow({ where: { assignmentId } });
    expect(persisted.version).toBe(2);
    expect(['Updated A', 'Updated B']).toContain(persisted.commentsToAuthors);
    await db.review.update({ where: { assignmentId }, data: { recommendation: 'ACCEPT' } });
    const submit = () =>
      reviews.submitReview(userId, conferenceId, assignmentId, { version: 2 }, ['REVIEWER']);
    await competing(submit, submit, 'REVIEW_VERSION_CONFLICT');
    expect((await db.review.findUniqueOrThrow({ where: { assignmentId } })).version).toBe(3);
    expect(
      (await db.reviewerAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).status,
    ).toBe('COMPLETED');
  });

  it('actual rebuttal service rejects competing first submissions and updates', async () => {
    await db.reviewRound.update({
      where: { id: roundId },
      data: { reviewsReleasedAt: new Date() },
    });
    await db.review.upsert({
      where: { assignmentId },
      update: { visibility: 'AUTHOR_VISIBLE', submittedAt: new Date() },
      create: {
        id: randomUUID(),
        organizationId: orgId,
        conferenceId,
        roundId,
        paperId,
        assignmentId,
        reviewerUserId: userId,
        visibility: 'AUTHOR_VISIBLE',
        submittedAt: new Date(),
      },
    });
    const audit = vi.fn();
    const rebuttals = new RebuttalsService(
      { loadConference: async () => ({ organizationId: orgId }) } as never,
      { log: audit } as never,
    );
    const submit = (version: number, body: string) =>
      rebuttals.submitRebuttal(authorId, conferenceId, paperId, { version, body }, ['AUTHOR']);
    await competing(
      () => submit(0, 'First A'),
      () => submit(0, 'First B'),
      'REBUTTAL_VERSION_CONFLICT',
    );
    const first = await db.rebuttal.findUniqueOrThrow({
      where: { paperId_roundId: { paperId, roundId } },
    });
    await competing(
      () => submit(first.version, 'Updated A'),
      () => submit(first.version, 'Updated B'),
      'REBUTTAL_VERSION_CONFLICT',
    );
    const persisted = await db.rebuttal.findUniqueOrThrow({ where: { id: first.id } });
    expect(persisted.version).toBe(first.version + 1);
    expect(['Updated A', 'Updated B']).toContain(persisted.body);
    expect(audit).toHaveBeenCalledTimes(2);
  });

  async function waitForBlocked(pid: number) {
    const end = Date.now() + 3000;
    while (Date.now() < end) {
      const [row] = await db.$queryRaw<Array<{ blocked: boolean }>>`
        SELECT cardinality(pg_blocking_pids(${pid}::int)) > 0 AS blocked`;
      if (row?.blocked) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Expected a real database lock wait');
  }

  it('closure waits for an admitted save transaction to finish', async () => {
    await db.reviewRound.update({ where: { id: roundId }, data: { reviewsReleasedAt: null } });
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const save = transaction(async (tx) => {
      expect((await lockReviewRound(tx, conferenceId, roundId)).version).toBeGreaterThanOrEqual(0);
      held.release();
      await release.promise;
    }).finally(held.release);
    let close: Promise<unknown> | undefined;
    try {
      await held.promise;
      close = transaction(async (tx) => {
        const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        pid = row!.pid;
        started.release();
        return tx.reviewRound.update({
          where: { id: roundId },
          data: { version: { increment: 1 } },
        });
      }).finally(started.release);
      await started.promise;
      await waitForBlocked(pid);
    } finally {
      release.release();
      await Promise.all([save, close]);
    }
    expect(
      (await db.reviewRound.findUniqueOrThrow({ where: { id: roundId } })).version,
    ).toBeGreaterThan(0);
  });

  it('a waiting save observes the committed closed phase, not a stale open phase', async () => {
    await db.reviewRound.update({
      where: { id: roundId },
      data: { reviewsReleasedAt: new Date() },
    });
    const held = gate();
    const release = gate();
    const started = gate();
    let pid = 0;
    const close = transaction(async (tx) => {
      await tx.reviewRound.update({
        where: { id: roundId },
        data: { version: { increment: 1 } },
      });
      held.release();
      await release.promise;
    }).finally(held.release);
    let save: Promise<{ version: number }> | undefined;
    try {
      await held.promise;
      save = transaction(async (tx) => {
        const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        pid = row!.pid;
        started.release();
        return lockReviewRound(tx, conferenceId, roundId);
      }).finally(started.release);
      await started.promise;
      await waitForBlocked(pid);
    } finally {
      release.release();
      await Promise.all([close, save]);
    }
    expect((await save)!.version).toBeGreaterThan(0);
  });
});
