import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@openconferences/db';
import { assertLocalDatabaseUrl } from '../../../../infra/testing/local-test-target.mjs';
import { ReviewsService } from './reviews.service';

const runtime = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock('@openconferences/db', async (original) => {
  const actual = await original<typeof import('@openconferences/db')>();
  return {
    ...actual,
    // Same tenant context as production: restricted API role with RLS settings.
    withTenantContext: async (
      ctx: { userId: string; conferenceId: string; organizationId?: string },
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      if (!runtime.client) throw new Error('Test database not initialized');
      return runtime.client.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
          await tx.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true), set_config('app.current_conference_id', ${ctx.conferenceId}, true), set_config('app.current_org_id', ${ctx.organizationId ?? ''}, true)`;
          return callback(tx);
        },
        { timeout: 10000 },
      );
    },
  };
});

// Explicit opt-in only, and only a loopback *_test database. Never the app DATABASE_URL.
const url = process.env.REVIEW_RELEASE_TEST_DATABASE_URL;
if (url) assertLocalDatabaseUrl(url);

describe.skipIf(!url)('selective review release in real PostgreSQL', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/unused_test',
  });
  const orgId = randomUUID();
  const conferenceId = randomUUID();
  const chairId = randomUUID();
  const authorId = randomUUID();
  const trackId = randomUUID();
  const paperId = randomUUID();
  const roundId = randomUUID();
  // R1..R3 submitted, R4 still a draft.
  const reviewers = Array.from({ length: 4 }, (_, index) => ({
    userId: randomUUID(),
    assignmentId: randomUUID(),
    reviewId: randomUUID(),
    submitted: index < 3,
  }));
  const [r1, r2, r3, r4] = reviewers as [
    (typeof reviewers)[0],
    (typeof reviewers)[0],
    (typeof reviewers)[0],
    (typeof reviewers)[0],
  ];
  const publishReviewReleased = vi.fn();
  const audit = vi.fn();

  const service = new ReviewsService(
    {
      loadConference: async () => ({
        organizationId: orgId,
        rebuttalDueAt: null,
        reviewConfig: {},
      }),
    } as never,
    { loadRound: () => db.reviewRound.findUniqueOrThrow({ where: { id: roundId } }) } as never,
    { checkReviewerPaperConflict: async () => ({ hasConflict: false }) } as never,
    { log: audit } as never,
    { publishReviewReleased } as never,
  );

  const currentVersion = async () =>
    (await db.reviewRound.findUniqueOrThrow({ where: { id: roundId } })).version;
  const visibility = async () =>
    Object.fromEntries(
      (
        await db.review.findMany({
          where: { paperId },
          select: { id: true, visibility: true },
        })
      ).map((review) => [review.id, review.visibility]),
    );
  const release = async (reviewIds?: string[]) =>
    service.releaseReviews(
      chairId,
      conferenceId,
      paperId,
      roundId,
      { version: await currentVersion(), ...(reviewIds ? { reviewIds } : {}) },
      ['CHAIR'],
    );

  beforeAll(async () => {
    runtime.client = db;
    await db.$transaction(async (tx) => {
      await tx.organization.create({ data: { id: orgId, name: 'Release test', slug: orgId } });
      await tx.conference.create({
        data: {
          id: conferenceId,
          organizationId: orgId,
          name: 'Release test',
          slug: conferenceId,
          authorJoinToken: randomUUID(),
        },
      });
      const people: Array<[string, string, 'CHAIR' | 'AUTHOR' | 'REVIEWER']> = [
        [chairId, 'Test Chair', 'CHAIR'],
        [authorId, 'Test Author', 'AUTHOR'],
        ...reviewers.map(
          (r, index) =>
            [r.userId, `Reviewer ${index + 1}`, 'REVIEWER'] as [string, string, 'REVIEWER'],
        ),
      ];
      for (const [id, name, role] of people) {
        await tx.user.create({ data: { id, name, email: `${id}@example.test` } });
        const membershipId = randomUUID();
        await tx.membership.create({
          data: {
            id: membershipId,
            userId: id,
            organizationId: orgId,
            conferenceId,
            scope: 'CONFERENCE',
          },
        });
        await tx.roleGrant.create({ data: { id: randomUUID(), membershipId, role } });
      }
      await tx.track.create({
        data: { id: trackId, organizationId: orgId, conferenceId, name: 'Track', slug: trackId },
      });
      await tx.paper.create({
        data: {
          id: paperId,
          organizationId: orgId,
          conferenceId,
          trackId,
          submittedById: authorId,
          title: 'Selective release paper',
          abstract: 'Abstract',
          keywords: [],
        },
      });
      await tx.authorship.create({
        data: {
          id: randomUUID(),
          paperId,
          userId: authorId,
          order: 1,
          isCorresponding: true,
          fullName: 'Test Author',
          email: `${authorId}@example.test`,
        },
      });
      await tx.reviewRound.create({
        data: { id: roundId, organizationId: orgId, conferenceId, paperId, roundNumber: 1 },
      });
      for (const r of reviewers) {
        await tx.reviewerAssignment.create({
          data: {
            id: r.assignmentId,
            organizationId: orgId,
            conferenceId,
            roundId,
            paperId,
            reviewerUserId: r.userId,
          },
        });
        await tx.review.create({
          data: {
            id: r.reviewId,
            organizationId: orgId,
            conferenceId,
            roundId,
            paperId,
            assignmentId: r.assignmentId,
            reviewerUserId: r.userId,
            recommendation: 'ACCEPT',
            commentsToAuthors: 'Feedback',
            submittedAt: r.submitted ? new Date() : null,
          },
        });
      }
    });
  });

  afterAll(async () => {
    try {
      await db.$transaction(async (tx) => {
        await tx.review.deleteMany({ where: { paperId } });
        await tx.reviewerAssignment.deleteMany({ where: { paperId } });
        await tx.reviewRound.deleteMany({ where: { id: roundId } });
        await tx.authorship.deleteMany({ where: { paperId } });
        await tx.paper.deleteMany({ where: { id: paperId } });
        await tx.track.deleteMany({ where: { id: trackId } });
        await tx.membership.deleteMany({ where: { conferenceId } });
        await tx.conference.deleteMany({ where: { id: conferenceId } });
        await tx.user.deleteMany({
          where: { id: { in: [chairId, authorId, ...reviewers.map((r) => r.userId)] } },
        });
        await tx.organization.deleteMany({ where: { id: orgId } });
      });
    } finally {
      await db.$disconnect();
    }
  });

  it('releases only R2 and keeps R1, R3 and the R4 draft hidden', async () => {
    const before = await currentVersion();
    const result = await release([r2.reviewId]);

    expect(result.releasedCount).toBe(1);
    expect(result.message).toBe('1 review released to authors');
    expect(await visibility()).toEqual({
      [r1.reviewId]: 'HIDDEN',
      [r2.reviewId]: 'AUTHOR_VISIBLE',
      [r3.reviewId]: 'HIDDEN',
      [r4.reviewId]: 'HIDDEN',
    });
    const round = await db.reviewRound.findUniqueOrThrow({ where: { id: roundId } });
    expect(round.reviewsReleasedAt).not.toBeNull();
    expect(round.version).toBe(before + 1);
    expect(publishReviewReleased).toHaveBeenCalledTimes(1);
    expect(publishReviewReleased).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `review-released-${r2.reviewId}` }),
    );
    expect(audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'review.released',
        diff: { releasedCount: 1, releasedReviewIds: [r2.reviewId], selective: true },
      }),
    );
  });

  it('rejects a selection containing an already released review without changing anything', async () => {
    const before = await currentVersion();
    await expect(release([r1.reviewId, r2.reviewId])).rejects.toMatchObject({ status: 400 });
    expect((await visibility())[r1.reviewId]).toBe('HIDDEN');
    expect(await currentVersion()).toBe(before);
  });

  it('rejects releasing a draft review', async () => {
    await expect(release([r4.reviewId])).rejects.toMatchObject({ status: 400 });
    expect((await visibility())[r4.reviewId]).toBe('HIDDEN');
  });

  it('rejects a stale cycle version', async () => {
    const stale = (await currentVersion()) - 1;
    await expect(
      service.releaseReviews(
        chairId,
        conferenceId,
        paperId,
        roundId,
        { version: stale, reviewIds: [r1.reviewId] },
        ['CHAIR'],
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await visibility())[r1.reviewId]).toBe('HIDDEN');
  });

  it('rejects a reviewer trying to release reviews', async () => {
    await expect(
      service.releaseReviews(
        r1.userId,
        conferenceId,
        paperId,
        roundId,
        { version: await currentVersion(), reviewIds: [r1.reviewId] },
        ['REVIEWER'],
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('releases R1 and R3 together, then has nothing left to release', async () => {
    const result = await release([r1.reviewId, r3.reviewId]);
    expect(result.releasedCount).toBe(2);
    expect(await visibility()).toEqual({
      [r1.reviewId]: 'AUTHOR_VISIBLE',
      [r2.reviewId]: 'AUTHOR_VISIBLE',
      [r3.reviewId]: 'AUTHOR_VISIBLE',
      [r4.reviewId]: 'HIDDEN',
    });
    await expect(release()).rejects.toMatchObject({ status: 400 });
  });
});
