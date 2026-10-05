import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@openconferences/db';
import { ReviewCoordinationService } from './coordination.service';
import { CoiCheckService } from './coi-check.service';
import { ReviewsService } from './reviews.service';
import { AssignmentsService } from './assignments.service';

const runtime = vi.hoisted(() => ({ client: null as PrismaClient | null, failAudit: false }));
vi.mock('@openconferences/db', async (original) => {
  const actual = await original<typeof import('@openconferences/db')>();
  return {
    ...actual,
    withTenantContext: async (
      ctx: { userId: string; conferenceId: string; organizationId?: string },
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      if (!runtime.client) throw new Error('Isolated test database not initialized');
      return runtime.client.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
          await tx.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true), set_config('app.current_conference_id', ${ctx.conferenceId}, true), set_config('app.current_org_id', ${ctx.organizationId ?? ''}, true)`;
          const wrapped = new Proxy(tx, {
            get(target, key) {
              if (key === 'auditLog' && runtime.failAudit)
                return {
                  create: async () => {
                    throw new Error('Simulated audit storage failure');
                  },
                };
              return Reflect.get(target, key);
            },
          });
          return callback(wrapped);
        },
        { timeout: 10_000 },
      );
    },
  };
});
const url = process.env.REVIEW_LOCK_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/inbox_test')
    throw new Error('Coordination tests require the isolated local inbox_test database');
}

describe.skipIf(!url)('review coordination transactions in PostgreSQL with application RLS', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/inbox_test',
  });
  const orgId = randomUUID(),
    conferenceId = randomUUID(),
    trackId = randomUUID(),
    paperId = randomUUID(),
    roundId = randomUUID();
  const chairId = randomUUID(),
    reviewerId = randomUUID(),
    replacementId = randomUUID(),
    authorId = randomUUID();
  const assignmentId = randomUUID(),
    reviewId = randomUUID();
  const conferenceService = {
    loadConference: async () => db.conference.findUniqueOrThrow({ where: { id: conferenceId } }),
  };
  const roundService = {
    loadRound: async () => db.reviewRound.findUniqueOrThrow({ where: { id: roundId } }),
  };
  const notifications = {
    publishReviewerAssigned: vi.fn().mockResolvedValue(true),
    publishReviewReminder: vi.fn().mockResolvedValue(true),
    publishReviewThankYou: vi.fn(),
  };
  const coordinator = () =>
    new ReviewCoordinationService(
      conferenceService as never,
      new CoiCheckService(),
      notifications as never,
    );
  const reviews = () =>
    new ReviewsService(
      conferenceService as never,
      roundService as never,
      new CoiCheckService(),
      { log: vi.fn() } as never,
      notifications as never,
    );
  const replace = () =>
    coordinator().intervene(
      chairId,
      conferenceId,
      assignmentId,
      {
        action: 'REPLACE',
        version: 0,
        reason: 'Reviewer unavailable',
        reviewerUserId: replacementId,
        dueAt: '2030-10-10T10:00:00Z',
      },
      ['CHAIR'],
    );

  beforeAll(async () => {
    runtime.client = db;
    await db.organization.create({ data: { id: orgId, name: 'Coordination test', slug: orgId } });
    await db.conference.create({
      data: {
        id: conferenceId,
        organizationId: orgId,
        name: 'Coordination test',
        slug: conferenceId,
        authorJoinToken: randomUUID(),
        status: 'REVIEWING',
        reviewConfig: { minimumReviews: 1 },
      },
    });
    for (const [id, role] of [
      [chairId, 'CHAIR'],
      [reviewerId, 'REVIEWER'],
      [replacementId, 'REVIEWER'],
      [authorId, 'AUTHOR'],
    ] as const) {
      await db.user.create({ data: { id, name: role, email: `${id}@example.test` } });
      await db.membership.create({
        data: {
          id: randomUUID(),
          organizationId: orgId,
          conferenceId,
          userId: id,
          scope: 'CONFERENCE',
          roles: { create: { id: randomUUID(), role } },
        },
      });
    }
    await db.track.create({
      data: { id: trackId, organizationId: orgId, conferenceId, name: 'Systems', slug: trackId },
    });
    await db.paper.create({
      data: {
        id: paperId,
        organizationId: orgId,
        conferenceId,
        trackId,
        submittedById: authorId,
        title: 'Transactional coordination',
        abstract: 'Test',
        keywords: [],
        status: 'UNDER_REVIEW',
      },
    });
    await db.reviewRound.create({
      data: { id: roundId, organizationId: orgId, conferenceId, paperId, roundNumber: 1 },
    });
  });
  beforeEach(async () => {
    runtime.failAudit = false;
    vi.clearAllMocks();
    await db.review.deleteMany({ where: { conferenceId } });
    await db.reviewerAssignment.deleteMany({ where: { conferenceId } });
    await db.auditLog.deleteMany({ where: { conferenceId } });
    await db.reviewerAssignment.create({
      data: {
        id: assignmentId,
        organizationId: orgId,
        conferenceId,
        paperId,
        roundId,
        reviewerUserId: reviewerId,
        dueAt: new Date('2030-10-09'),
      },
    });
    await db.review.create({
      data: {
        id: reviewId,
        organizationId: orgId,
        conferenceId,
        paperId,
        roundId,
        assignmentId,
        reviewerUserId: reviewerId,
        scores: {},
        recommendation: 'ACCEPT',
        commentsToAuthors: 'Private draft that must survive',
      },
    });
  });
  afterAll(async () => {
    runtime.failAudit = false;
    await db.review.deleteMany({ where: { conferenceId } });
    await db.reviewerAssignment.deleteMany({ where: { conferenceId } });
    await db.auditLog.deleteMany({ where: { conferenceId } });
    await db.reviewRound.deleteMany({ where: { conferenceId } });
    await db.paper.deleteMany({ where: { conferenceId } });
    await db.track.deleteMany({ where: { conferenceId } });
    await db.membership.deleteMany({ where: { conferenceId } });
    await db.conference.deleteMany({ where: { id: conferenceId } });
    await db.user.deleteMany({
      where: { id: { in: [chairId, reviewerId, replacementId, authorId] } },
    });
    await db.organization.deleteMany({ where: { id: orgId } });
    await db.$disconnect();
  });
  it('rolls back both assignment mutations when an in-transaction audit write fails', async () => {
    runtime.failAudit = true;
    await expect(replace()).rejects.toThrow('Simulated audit storage failure');
    expect(await db.reviewerAssignment.count({ where: { conferenceId } })).toBe(1);
    expect(await db.reviewerAssignment.findUnique({ where: { id: assignmentId } })).toMatchObject({
      status: 'ASSIGNED',
      version: 0,
    });
    expect(await db.review.findUnique({ where: { id: reviewId } })).toMatchObject({
      commentsToAuthors: 'Private draft that must survive',
    });
    expect(notifications.publishReviewerAssigned).not.toHaveBeenCalled();
  });
  it('persists the deadline chosen during assignment and uses that exact date in the assignment email', async () => {
    const service = new AssignmentsService(
      conferenceService as never,
      roundService as never,
      new CoiCheckService(),
      { log: vi.fn() } as never,
      notifications as never,
    );
    const dueAt = '2030-10-15T12:45:00.000Z';
    const result = await service.assign(
      chairId,
      conferenceId,
      paperId,
      {
        reviewerUserId: replacementId,
        roundId,
        dueAt,
      },
      ['CHAIR'],
    );
    expect(result.assignment.dueAt).toBe(dueAt);
    const saved = await db.reviewerAssignment.findUniqueOrThrow({
      where: { id: result.assignment.id },
    });
    expect(saved.dueAt?.toISOString()).toBe(dueAt);
    expect(notifications.publishReviewerAssigned).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt,
        assignmentId: result.assignment.id,
        to: `${replacementId}@example.test`,
      }),
    );
    const ledger = await coordinator().snapshot(chairId, conferenceId, ['CHAIR']);
    expect(ledger.data[0]?.assignments.find((item) => item.id === saved.id)?.dueAt).toBe(dueAt);
  });
  it('preserves the draft and prevents the old reviewer from saving or submitting after replacement', async () => {
    const result = await replace();
    expect(await db.reviewerAssignment.findUnique({ where: { id: assignmentId } })).toMatchObject({
      status: 'REPLACED',
      version: 1,
    });
    expect(await db.review.findUnique({ where: { id: reviewId } })).toMatchObject({
      submittedAt: null,
      commentsToAuthors: 'Private draft that must survive',
    });
    expect(
      await db.reviewerAssignment.findUnique({ where: { id: result.assignmentId } }),
    ).toMatchObject({ reviewerUserId: replacementId, status: 'ASSIGNED' });
    await expect(
      reviews().saveReview(reviewerId, conferenceId, assignmentId, { scores: {}, version: 0 }, [
        'REVIEWER',
      ]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reviews().submitReview(reviewerId, conferenceId, assignmentId, { version: 0 }, ['REVIEWER']),
    ).rejects.toMatchObject({ status: 403 });
    const ledger = await coordinator().snapshot(chairId, conferenceId, ['CHAIR']);
    expect(ledger.data[0]).toMatchObject({ assignmentCount: 1, submittedReviewCount: 0 });
    expect(ledger.data[0]?.assignments).toHaveLength(2);
  });
  it('allows only one of two concurrent stale-version extensions', async () => {
    const extend = (date: string) =>
      coordinator().intervene(
        chairId,
        conferenceId,
        assignmentId,
        { action: 'EXTEND', version: 0, reason: 'Requested extension', dueAt: date },
        ['CHAIR'],
      );
    const results = await Promise.allSettled([
      extend('2030-10-12T10:00:00Z'),
      extend('2030-10-13T10:00:00Z'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    expect(await db.reviewerAssignment.findUnique({ where: { id: assignmentId } })).toMatchObject({
      version: 1,
    });
    expect(
      await db.auditLog.count({ where: { conferenceId, action: 'reviewer.deadline_extended' } }),
    ).toBe(1);
  });
  it('serializes replacement against review submission and never retires a submitted review', async () => {
    const results = await Promise.allSettled([
      replace(),
      reviews().submitReview(reviewerId, conferenceId, assignmentId, { version: 0 }, ['REVIEWER']),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const old = await db.reviewerAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } });
    expect(old.status === 'REPLACED' && review.submittedAt !== null).toBe(false);
    expect(old.status === 'COMPLETED' || old.status === 'REPLACED').toBe(true);
    expect(
      await db.reviewerAssignment.count({ where: { conferenceId, reviewerUserId: replacementId } }),
    ).toBe(old.status === 'REPLACED' ? 1 : 0);
  });
});
