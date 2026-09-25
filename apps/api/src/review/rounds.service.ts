import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecisionOutcome, Prisma, ReviewRound, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { ReviewStage, UpdateReviewRoundInput } from '@openconferences/schemas';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapReviewRound } from './review.mapper';
import { deriveReviewStage, minimumReviewsFromConfig, reviewCountWarning } from './review-stage';

export type LockedReviewCycle = {
  id: string;
  paperId: string;
  version: number;
  reviewsReleasedAt: Date | null;
  rebuttalDueAt: Date | null;
};

export async function lockReviewRound(
  tx: Prisma.TransactionClient,
  conferenceId: string,
  roundId: string,
): Promise<LockedReviewCycle> {
  const [round] = await tx.$queryRaw<LockedReviewCycle[]>`
    SELECT id, "paperId", version, "reviewsReleasedAt", "rebuttalDueAt"
    FROM review_rounds
    WHERE id = ${roundId}::uuid AND "conferenceId" = ${conferenceId}::uuid
    FOR UPDATE
  `;
  if (!round) throw new NotFoundException('Review round not found');
  return round;
}

@Injectable()
export class RoundsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
  ) {}

  async list(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions & { paperId?: string } = {},
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewRound.findMany({
          where: { conferenceId, ...(options.paperId ? { paperId: options.paperId } : {}) },
          orderBy: [{ paperId: 'asc' }, { roundNumber: 'asc' }],
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);
    const stages = await this.stagesFor(userId, conferenceId, conference.organizationId, page.data);

    return {
      data: page.data.map((row) => mapReviewRound(row, stages.get(row.id) ?? 'IN_REVIEW')),
      nextCursor: page.nextCursor,
    };
  }

  async listProgress(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<{
    minimumReviews: number;
    data: Array<{
      paperId: string;
      paperTitle: string;
      paperStatus: string;
      paperVersion: number;
      cycleId: string | null;
      roundNumber: number | null;
      cycleVersion: number | null;
      reviewStage: ReviewStage;
      assignmentCount: number;
      submittedReviewCount: number;
      reviewsReleasedAt: string | null;
      warning: string | null;
    }>;
  }> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to view review progress');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const minimumReviews = minimumReviewsFromConfig(conference.reviewConfig);

    const papers = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findMany({
          where: {
            conferenceId,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'DECISION_MADE', 'CAMERA_READY'] },
          },
          orderBy: { title: 'asc' },
          include: {
            reviewRounds: { orderBy: { roundNumber: 'desc' }, take: 1 },
          },
        }),
    );

    const cycleIds = papers.flatMap((paper) => paper.reviewRounds.map((cycle) => cycle.id));
    const [decisions, reviewCounts, assignmentCounts] = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        Promise.all([
          tx.decision.findMany({
            where: { conferenceId, roundId: { in: cycleIds } },
            select: { roundId: true, outcome: true },
          }),
          tx.review.groupBy({
            by: ['roundId'],
            where: { conferenceId, roundId: { in: cycleIds }, submittedAt: { not: null } },
            _count: { _all: true },
          }),
          tx.reviewerAssignment.groupBy({
            by: ['roundId'],
            where: { conferenceId, roundId: { in: cycleIds } },
            _count: { _all: true },
          }),
        ]),
    );

    const decisionByCycle = new Map(decisions.map((row) => [row.roundId, row.outcome]));
    const submittedByCycle = new Map(reviewCounts.map((row) => [row.roundId, row._count._all]));
    const assignedByCycle = new Map(assignmentCounts.map((row) => [row.roundId, row._count._all]));

    return {
      minimumReviews,
      data: papers.map((paper) => {
        const cycle = paper.reviewRounds[0] ?? null;
        const submittedReviewCount = cycle ? (submittedByCycle.get(cycle.id) ?? 0) : 0;
        const reviewStage: ReviewStage = cycle
          ? deriveReviewStage({
              reviewsReleasedAt: cycle.reviewsReleasedAt,
              decisionOutcome: decisionByCycle.get(cycle.id) ?? null,
              hasNewerCycle: false,
            })
          : 'SUBMITTED';
        return {
          paperId: paper.id,
          paperTitle: paper.title,
          paperStatus: String(paper.status),
          paperVersion: paper.version,
          cycleId: cycle?.id ?? null,
          roundNumber: cycle?.roundNumber ?? null,
          cycleVersion: cycle?.version ?? null,
          reviewStage,
          assignmentCount: cycle ? (assignedByCycle.get(cycle.id) ?? 0) : 0,
          submittedReviewCount,
          reviewsReleasedAt: cycle?.reviewsReleasedAt?.toISOString() ?? null,
          warning:
            cycle && reviewStage !== 'DECIDED' && reviewStage !== 'REVISION_REQUESTED'
              ? reviewCountWarning(submittedReviewCount, minimumReviews)
              : null,
        };
      }),
    };
  }

  async update(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: UpdateReviewRoundInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to update review rounds');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.loadRound(userId, conferenceId, roundId, roles);

    if (input.version !== round.version) {
      throw new ConflictException('Review round was modified by another request');
    }

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const result = await tx.reviewRound.updateMany({
          where: { id: roundId, conferenceId, version: input.version },
          data: {
            ...(input.reviewDueAt !== undefined
              ? { reviewDueAt: input.reviewDueAt ? new Date(input.reviewDueAt) : null }
              : {}),
            ...(input.rebuttalDueAt !== undefined
              ? { rebuttalDueAt: input.rebuttalDueAt ? new Date(input.rebuttalDueAt) : null }
              : {}),
            ...(input.revisionDueAt !== undefined
              ? { revisionDueAt: input.revisionDueAt ? new Date(input.revisionDueAt) : null }
              : {}),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException('Review round was modified by another request');
        }
        return tx.reviewRound.findUniqueOrThrow({ where: { id: roundId } });
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'review_round.updated',
      entity: 'ReviewRound',
      entityId: roundId,
      diff: input,
    });

    const stage = await this.stageFor(userId, conferenceId, conference.organizationId, updated);
    return mapReviewRound(updated, stage);
  }

  async ensureOpenCycle(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      conferenceId: string;
      paperId: string;
      reviewDueAt: Date | null;
      rebuttalDueAt: Date | null;
    },
  ): Promise<ReviewRound> {
    const latest = await tx.reviewRound.findFirst({
      where: { paperId: input.paperId, conferenceId: input.conferenceId },
      orderBy: { roundNumber: 'desc' },
      include: { decisions: { select: { outcome: true } } },
    });

    if (!latest) {
      return tx.reviewRound.create({
        data: {
          id: generateId(),
          organizationId: input.organizationId,
          conferenceId: input.conferenceId,
          paperId: input.paperId,
          roundNumber: 1,
          reviewDueAt: input.reviewDueAt,
          rebuttalDueAt: input.rebuttalDueAt,
        },
      });
    }

    const decision = latest.decisions[0] ?? null;
    if (!decision) return latest;

    throw new ConflictException('This paper cycle already has a decision');
  }

  async loadRound(
    userId: string,
    conferenceId: string,
    roundId: string,
    roles: RoleKind[],
  ): Promise<ReviewRound> {
    await this.conferences.loadConference(userId, conferenceId, roles);

    const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewRound.findFirst({ where: { id: roundId } }),
    );

    if (!round) {
      throw new NotFoundException('Review round not found');
    }

    assertScope(round, { conferenceId });
    return round;
  }

  private async stagesFor(
    userId: string,
    conferenceId: string,
    organizationId: string,
    rounds: ReviewRound[],
  ): Promise<Map<string, ReviewStage>> {
    if (rounds.length === 0) return new Map();
    const facts = await this.factsFor(userId, conferenceId, organizationId, rounds);
    return new Map(
      rounds.map((round) => {
        const fact = facts.get(round.id);
        return [
          round.id,
          deriveReviewStage({
            reviewsReleasedAt: round.reviewsReleasedAt,
            decisionOutcome: fact?.decisionOutcome ?? null,
            hasNewerCycle: fact?.hasNewerCycle ?? false,
          }),
        ];
      }),
    );
  }

  private async stageFor(
    userId: string,
    conferenceId: string,
    organizationId: string,
    round: ReviewRound,
  ): Promise<ReviewStage> {
    const stages = await this.stagesFor(userId, conferenceId, organizationId, [round]);
    return stages.get(round.id) ?? 'IN_REVIEW';
  }

  private async factsFor(
    userId: string,
    conferenceId: string,
    organizationId: string,
    rounds: ReviewRound[],
  ): Promise<Map<string, { decisionOutcome: DecisionOutcome | null; hasNewerCycle: boolean }>> {
    const paperIds = [...new Set(rounds.map((round) => round.paperId))];
    const [decisions, siblings] = await withTenantContext(
      { userId, conferenceId, organizationId },
      async (tx) =>
        Promise.all([
          tx.decision.findMany({
            where: { conferenceId, roundId: { in: rounds.map((round) => round.id) } },
            select: { roundId: true, outcome: true },
          }),
          tx.reviewRound.findMany({
            where: { conferenceId, paperId: { in: paperIds } },
            select: { id: true, paperId: true, roundNumber: true },
          }),
        ]),
    );
    const decisionByRound = new Map(decisions.map((row) => [row.roundId, row.outcome]));
    const maxRound = new Map<string, number>();
    for (const sibling of siblings) {
      maxRound.set(
        sibling.paperId,
        Math.max(maxRound.get(sibling.paperId) ?? 0, sibling.roundNumber),
      );
    }
    return new Map(
      rounds.map((round) => [
        round.id,
        {
          decisionOutcome: decisionByRound.get(round.id) ?? null,
          hasNewerCycle: (maxRound.get(round.paperId) ?? round.roundNumber) > round.roundNumber,
        },
      ]),
    );
  }
}
