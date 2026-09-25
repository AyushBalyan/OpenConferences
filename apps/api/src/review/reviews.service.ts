import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId, Prisma, withTenantContext } from '@openconferences/db';
import type { Review, RoleKind } from '@openconferences/db';
import type {
  MyAssignmentItemDto,
  ReleaseReviewsInput,
  ReviewDto,
  ReviewListDto,
  SaveReviewInput,
  SubmitReviewInput,
} from '@openconferences/schemas';
import { reviewerAssignmentDueAt } from '@openconferences/schemas';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { CoiCheckService } from './coi-check.service';
import { RoundsService, lockReviewRound } from './rounds.service';
import { deriveReviewStage } from './review-stage';
import {
  isPrivilegedReader,
  mapReview,
  mapReviewForAuthor,
  mapReviewRound,
  mapReviewerAssignment,
} from './review.mapper';

type ReviewConfig = {
  scoreDimensions?: Array<{ key: string; label?: string; min?: number; max?: number }>;
  requireConfidence?: boolean;
};

type PendingEdit = {
  scores: Prisma.InputJsonValue;
  recommendation: Review['recommendation'];
  confidence: number | null;
  commentsToAuthors: string | null;
  commentsToChairs: string | null;
};

function pendingEditPayload(input: SaveReviewInput): Prisma.InputJsonValue {
  return {
    scores: input.scores,
    recommendation: input.recommendation ?? null,
    confidence: input.confidence ?? null,
    commentsToAuthors: input.commentsToAuthors ?? null,
    commentsToChairs: input.commentsToChairs ?? null,
  };
}

/** Chairs and authors read the last submission. The reviewer keeps later autosaves aside. */
function reviewVisibleToOwner(review: Review): Review {
  if (
    !review.submittedAt ||
    !review.pendingEdit ||
    typeof review.pendingEdit !== 'object' ||
    Array.isArray(review.pendingEdit)
  ) {
    return review;
  }
  const pending = review.pendingEdit as PendingEdit;
  return {
    ...review,
    scores: pending.scores ?? review.scores,
    recommendation: pending.recommendation ?? null,
    confidence: pending.confidence ?? null,
    commentsToAuthors: pending.commentsToAuthors ?? null,
    commentsToChairs: pending.commentsToChairs ?? null,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly rounds: RoundsService,
    private readonly coiCheck: CoiCheckService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async listMyAssignments(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions = {},
  ): Promise<{ data: MyAssignmentItemDto[]; nextCursor: string | null }> {
    if (!roles.includes('REVIEWER') && !isPrivilegedReader(roles)) {
      throw new ForbiddenException('Reviewer role required');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerAssignment.findMany({
          where: {
            conferenceId,
            reviewerUserId: userId,
          },
          include: {
            paper: { select: { title: true, currentVersionId: true } },
            round: {
              select: {
                roundNumber: true,
                reviewsReleasedAt: true,
                decisions: { select: { outcome: true }, take: 1 },
              },
            },
            review: true,
          },
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map((a) => ({
        ...mapReviewerAssignment(a),
        dueAt: reviewerAssignmentDueAt(a.createdAt, conference.reviewDueAt).toISOString(),
        paperTitle: a.paper.title,
        currentVersionId: a.paper.currentVersionId,
        roundNumber: a.round.roundNumber,
        reviewStage: deriveReviewStage({
          reviewsReleasedAt: a.round.reviewsReleasedAt,
          decisionOutcome: a.round.decisions[0]?.outcome ?? null,
          hasNewerCycle: false,
        }),
        review: a.review
          ? {
              ...mapReview(reviewVisibleToOwner(a.review)),
              hasPendingEdit: Boolean(a.review.submittedAt && a.review.pendingEdit),
            }
          : null,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async getReview(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    roles: RoleKind[],
  ): Promise<ReviewDto> {
    const { assignment, review, paper } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    const paperMeta = {
      paperTitle: paper.title,
      currentVersionId: paper.currentVersionId,
    };

    const decided = await this.cycleHasDecision(userId, conferenceId, assignment.roundId);
    const canEdit =
      assignment.reviewerUserId === userId && assignment.status !== 'DECLINED' && !decided;
    const capabilities = {
      canEdit,
      editLockReason: canEdit
        ? null
        : 'This review is read-only because the cycle has a decision or this account cannot edit it.',
    };

    if (review) {
      return {
        ...mapReview(reviewVisibleToOwner(review)),
        hasPendingEdit: Boolean(review.submittedAt && review.pendingEdit),
        ...paperMeta,
        revisionResponse: await this.revisionResponseForPaper(
          userId,
          conferenceId,
          paper.currentVersionId,
        ),
        ...capabilities,
      };
    }

    return {
      ...this.buildDraftReview(assignment),
      ...paperMeta,
      revisionResponse: await this.revisionResponseForPaper(
        userId,
        conferenceId,
        paper.currentVersionId,
      ),
      ...capabilities,
    };
  }

  async saveReview(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    input: SaveReviewInput,
    roles: RoleKind[],
  ): Promise<ReviewDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const { assignment, review, paper } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    if (assignment.reviewerUserId !== userId || assignment.status === 'DECLINED') {
      throw new ForbiddenException('Only the assigned reviewer may edit this review');
    }
    await this.rounds.loadRound(userId, conferenceId, assignment.roundId, roles);

    const saved = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await lockReviewRound(tx, conferenceId, assignment.roundId);
        await this.assertCycleOpen(tx, conferenceId, assignment.roundId);
        const coiResult = await this.coiCheck.checkReviewerPaperConflict(
          tx,
          userId,
          assignment.paperId,
          conferenceId,
        );

        if (coiResult.hasConflict) {
          throw new ConflictException('Conflict of interest prevents review submission');
        }

        if (review) {
          if (input.version !== review.version) {
            throw new ConflictException({
              code: 'REVIEW_VERSION_CONFLICT',
              message: 'Review was modified by another request',
            });
          }

          const editingSubmitted = Boolean(review.submittedAt);
          const updated = await tx.review.updateMany({
            where: { id: review.id, conferenceId, reviewerUserId: userId, version: input.version },
            data: editingSubmitted
              ? {
                  pendingEdit: pendingEditPayload(input),
                  version: { increment: 1 },
                }
              : {
                  scores: input.scores as Prisma.InputJsonValue,
                  recommendation: input.recommendation ?? null,
                  confidence: input.confidence ?? null,
                  commentsToAuthors: input.commentsToAuthors ?? null,
                  commentsToChairs: input.commentsToChairs ?? null,
                  pendingEdit: Prisma.DbNull,
                  version: { increment: 1 },
                },
          });

          if (updated.count !== 1) {
            throw this.versionConflict();
          }
          return tx.review.findUniqueOrThrow({ where: { id: review.id } });
        }

        if (input.version !== 0) {
          throw new ConflictException({
            code: 'REVIEW_VERSION_CONFLICT',
            message: 'Review was modified by another request',
          });
        }

        const created = await tx.review.createMany({
          skipDuplicates: true,
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            assignmentId: assignment.id,
            roundId: assignment.roundId,
            paperId: assignment.paperId,
            reviewerUserId: userId,
            scores: input.scores as Prisma.InputJsonValue,
            recommendation: input.recommendation ?? null,
            confidence: input.confidence ?? null,
            commentsToAuthors: input.commentsToAuthors ?? null,
            commentsToChairs: input.commentsToChairs ?? null,
            visibility: 'HIDDEN',
            version: 1,
          },
        });
        if (created.count !== 1) {
          throw this.versionConflict();
        }
        return tx.review.findUniqueOrThrow({ where: { assignmentId: assignment.id } });
      },
    );

    return {
      ...mapReview(reviewVisibleToOwner(saved)),
      hasPendingEdit: Boolean(saved.submittedAt && saved.pendingEdit),
      paperTitle: paper.title,
      currentVersionId: paper.currentVersionId,
    };
  }

  async submitReview(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    input: SubmitReviewInput,
    roles: RoleKind[],
  ): Promise<{ review: ReviewDto; message: string }> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const { assignment, review, paper } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    if (assignment.reviewerUserId !== userId || assignment.status === 'DECLINED') {
      throw new ForbiddenException('Only the assigned reviewer may submit this review');
    }
    await this.rounds.loadRound(userId, conferenceId, assignment.roundId, roles);

    if (!review) {
      throw new BadRequestException('Save a review draft before submitting');
    }

    if (input.version !== review.version) {
      throw new ConflictException({
        code: 'REVIEW_VERSION_CONFLICT',
        message: 'Review was modified by another request',
      });
    }

    this.validateReviewForSubmit(
      reviewVisibleToOwner(review),
      conference.reviewConfig as ReviewConfig,
    );

    const submitted = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await lockReviewRound(tx, conferenceId, assignment.roundId);
        await this.assertCycleOpen(tx, conferenceId, assignment.roundId);
        const coiResult = await this.coiCheck.checkReviewerPaperConflict(
          tx,
          userId,
          assignment.paperId,
          conferenceId,
        );

        if (coiResult.hasConflict) {
          throw new ConflictException('Conflict of interest prevents review submission');
        }

        const publishing = reviewVisibleToOwner(review);
        const updated = await tx.review.updateMany({
          where: { id: review.id, conferenceId, reviewerUserId: userId, version: input.version },
          data: {
            scores: publishing.scores as Prisma.InputJsonValue,
            recommendation: publishing.recommendation,
            confidence: publishing.confidence,
            commentsToAuthors: publishing.commentsToAuthors,
            commentsToChairs: publishing.commentsToChairs,
            pendingEdit: Prisma.DbNull,
            submittedAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw this.versionConflict();
        }
        const updatedReview = await tx.review.findUniqueOrThrow({ where: { id: review.id } });
        await tx.reviewerAssignment.update({
          where: { id: assignment.id },
          data: { status: 'COMPLETED' },
        });

        return updatedReview;
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'review.submitted',
      entity: 'Review',
      entityId: submitted.id,
      diff: { assignmentId, paperId: assignment.paperId },
    });

    return {
      review: {
        ...mapReview(submitted),
        hasPendingEdit: false,
        paperTitle: paper.title,
        currentVersionId: paper.currentVersionId,
      },
      message: 'Review submitted successfully',
    };
  }

  async listReviewsForPaper(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions & { roundId?: string } = {},
  ): Promise<ReviewListDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);
    const roundId = options.roundId;

    const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId, conferenceId },
        include: { authorships: true },
      }),
    );

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    assertScope(paper, { conferenceId });

    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);
    // A committee role must not expose private reviews of the reader's own paper.
    const privileged = canCoordinateReview(roles) && !isAuthor;

    if (!privileged && !isAuthor) {
      throw new ForbiddenException('Insufficient permissions to view reviews');
    }

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.review.findMany({
          where: {
            paperId,
            conferenceId,
            ...(roundId ? { roundId } : {}),
            ...(privileged ? {} : { visibility: 'AUTHOR_VISIBLE' }),
          },
          orderBy: [{ round: { roundNumber: 'asc' } }, { createdAt: 'asc' }],
          include: { round: { select: { roundNumber: true } } },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    const activeRoundId = roundId ?? page.data[0]?.roundId;
    let reviewStage: ReviewListDto['reviewStage'];

    if (activeRoundId) {
      const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
        tx.reviewRound.findFirst({
          where: { id: activeRoundId },
          include: { decisions: { select: { outcome: true }, take: 1 } },
        }),
      );
      if (round) {
        reviewStage = deriveReviewStage({
          reviewsReleasedAt: round.reviewsReleasedAt,
          decisionOutcome: round.decisions[0]?.outcome ?? null,
          hasNewerCycle: false,
        });
      }
    }

    const data = page.data.map((review) => ({
      ...(privileged ? mapReview(review) : mapReviewForAuthor(review)),
      roundNumber: review.round.roundNumber,
    }));

    return {
      data,
      roundId: activeRoundId,
      reviewStage,
      nextCursor: page.nextCursor,
    };
  }

  async releaseReviews(
    userId: string,
    conferenceId: string,
    paperId: string,
    cycleId: string,
    input: ReleaseReviewsInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to release reviews');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.rounds.loadRound(userId, conferenceId, cycleId, roles);

    if (round.paperId !== paperId) {
      throw new NotFoundException('Review cycle not found for this paper');
    }

    if (input.version !== round.version) {
      throw new ConflictException('Review round was modified by another request');
    }

    const result = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await lockReviewRound(tx, conferenceId, cycleId);
        await this.assertCycleOpen(tx, conferenceId, cycleId);
        const hiddenSubmitted = await tx.review.findMany({
          where: {
            roundId: cycleId,
            conferenceId,
            paperId,
            submittedAt: { not: null },
            visibility: 'HIDDEN',
          },
          include: {
            paper: {
              select: {
                title: true,
                authorships: {
                  where: { isCorresponding: true },
                  select: { email: true, fullName: true },
                },
              },
            },
          },
        });

        if (hiddenSubmitted.length === 0) {
          throw new BadRequestException('No submitted reviews to release');
        }

        const rebuttalDueAt =
          input.rebuttalDueAt !== undefined
            ? new Date(input.rebuttalDueAt)
            : (round.rebuttalDueAt ??
              (conference.rebuttalDueAt && conference.rebuttalDueAt > new Date()
                ? conference.rebuttalDueAt
                : null));

        const transition = await tx.reviewRound.updateMany({
          where: { id: cycleId, conferenceId, paperId, version: input.version },
          data: {
            reviewsReleasedAt: round.reviewsReleasedAt ?? new Date(),
            ...(rebuttalDueAt ? { rebuttalDueAt } : {}),
            version: { increment: 1 },
          },
        });
        if (transition.count !== 1) {
          throw new ConflictException('Review round was modified by another request');
        }

        await tx.review.updateMany({
          where: { id: { in: hiddenSubmitted.map((review) => review.id) }, visibility: 'HIDDEN' },
          data: { visibility: 'AUTHOR_VISIBLE' },
        });

        const updatedRound = await tx.reviewRound.findUniqueOrThrow({
          where: { id: cycleId },
          include: { decisions: { select: { outcome: true }, take: 1 } },
        });

        return { submittedReviews: hiddenSubmitted, updatedRound };
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'review.released',
      entity: 'ReviewRound',
      entityId: cycleId,
      diff: { releasedCount: result.submittedReviews.length },
    });

    for (const review of result.submittedReviews) {
      const corresponding = review.paper.authorships[0];
      if (corresponding?.email) {
        await this.notifications.publishReviewReleased({
          to: corresponding.email,
          conferenceId,
          organizationId: conference.organizationId,
          paperTitle: review.paper.title,
          paperId: review.paperId,
          roundId: cycleId,
          idempotencyKey: `review-released-${review.id}`,
        });
      }
    }

    return {
      releasedCount: result.submittedReviews.length,
      round: mapReviewRound(
        result.updatedRound,
        deriveReviewStage({
          reviewsReleasedAt: result.updatedRound.reviewsReleasedAt,
          decisionOutcome: result.updatedRound.decisions[0]?.outcome ?? null,
          hasNewerCycle: false,
        }),
      ),
      message: 'Reviews released to authors',
    };
  }

  private async revisionResponseForPaper(
    userId: string,
    conferenceId: string,
    currentVersionId: string | null,
  ): Promise<string | null> {
    if (!currentVersionId) return null;
    const version = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paperVersion.findFirst({
        where: { id: currentVersionId, kind: 'REVISION' },
        select: { note: true },
      }),
    );
    const note = version?.note?.trim();
    return note ? note : null;
  }

  private versionConflict() {
    return new ConflictException({
      code: 'REVIEW_VERSION_CONFLICT',
      message: 'Review was modified by another request',
    });
  }

  private async loadAssignmentForReviewer(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    roles: RoleKind[],
  ) {
    if (!roles.includes('REVIEWER') && !isPrivilegedReader(roles)) {
      throw new ForbiddenException('Reviewer role required');
    }

    await this.conferences.loadConference(userId, conferenceId, roles);

    const assignment = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewerAssignment.findFirst({
        where: { id: assignmentId },
        include: {
          review: true,
          paper: { select: { title: true, currentVersionId: true } },
        },
      }),
    );

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    assertScope(assignment, { conferenceId });

    if (assignment.reviewerUserId !== userId && !isPrivilegedReader(roles)) {
      throw new NotFoundException('Assignment not found');
    }

    return {
      assignment,
      review: assignment.review,
      paper: assignment.paper,
    };
  }

  private buildDraftReview(assignment: {
    id: string;
    organizationId: string;
    conferenceId: string;
    roundId: string;
    paperId: string;
    reviewerUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ReviewDto {
    const now = new Date().toISOString();
    return {
      id: '',
      organizationId: assignment.organizationId,
      conferenceId: assignment.conferenceId,
      assignmentId: assignment.id,
      roundId: assignment.roundId,
      paperId: assignment.paperId,
      reviewerUserId: assignment.reviewerUserId,
      scores: {},
      recommendation: null,
      confidence: null,
      commentsToAuthors: null,
      commentsToChairs: null,
      visibility: 'HIDDEN',
      submittedAt: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async cycleHasDecision(userId: string, conferenceId: string, roundId: string) {
    const decision = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.decision.findFirst({ where: { roundId, conferenceId }, select: { id: true } }),
    );
    return Boolean(decision);
  }

  private async assertCycleOpen(
    tx: Prisma.TransactionClient,
    conferenceId: string,
    roundId: string,
  ) {
    const decision = await tx.decision.findFirst({
      where: { roundId, conferenceId },
      select: { id: true },
    });
    if (decision) {
      throw new ConflictException({
        code: 'REVIEW_PHASE_LOCKED',
        message: 'Reviews cannot be edited after this cycle has a decision',
      });
    }
  }

  private validateReviewForSubmit(review: Review, reviewConfig: ReviewConfig): void {
    if (!review.recommendation) {
      throw new BadRequestException('Recommendation is required');
    }

    if (!review.commentsToAuthors?.trim()) {
      throw new BadRequestException('Comments to authors are required');
    }

    if (reviewConfig.requireConfidence && review.confidence == null) {
      throw new BadRequestException('Confidence score is required');
    }

    const dimensions = reviewConfig.scoreDimensions ?? [];
    const scores = (review.scores ?? {}) as Record<string, number>;

    for (const dimension of dimensions) {
      const value = scores[dimension.key];
      if (value == null) {
        throw new BadRequestException(`Score for ${dimension.label ?? dimension.key} is required`);
      }

      const min = dimension.min ?? 1;
      const max = dimension.max ?? 5;
      if (value < min || value > max) {
        throw new BadRequestException(
          `Score for ${dimension.label ?? dimension.key} must be between ${min} and ${max}`,
        );
      }
    }
  }
}
