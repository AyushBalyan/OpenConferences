import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Review, RoleKind, RoundStatus } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  MyAssignmentItemDto,
  ReleaseReviewsInput,
  ReviewDto,
  ReviewListDto,
  SaveReviewInput,
  SubmitReviewInput,
} from '@openconferences/schemas';
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
import { RoundsService } from './rounds.service';
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
            round: { status: { not: 'CLOSED' } },
          },
          include: {
            paper: { select: { title: true } },
            round: { select: { roundNumber: true, status: true } },
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
        paperTitle: a.paper.title,
        roundNumber: a.round.roundNumber,
        roundStatus: a.round.status,
        review: a.review ? mapReview(a.review) : null,
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
    const { assignment, review } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    if (review) {
      return mapReview(review);
    }

    return this.buildDraftReview(assignment);
  }

  async saveReview(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    input: SaveReviewInput,
    roles: RoleKind[],
  ): Promise<ReviewDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const { assignment, review } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    const round = await this.rounds.loadRound(userId, conferenceId, assignment.roundId, roles);
    this.assertReviewEditable(round.status, review?.submittedAt ?? null);

    const saved = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
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
            throw new ConflictException('Review was modified by another request');
          }

          const updated = await tx.review.update({
            where: { id: review.id },
            data: {
              scores: input.scores as Prisma.InputJsonValue,
              recommendation: input.recommendation ?? null,
              confidence: input.confidence ?? null,
              commentsToAuthors: input.commentsToAuthors ?? null,
              commentsToChairs: input.commentsToChairs ?? null,
              version: { increment: 1 },
            },
          });

          return updated;
        }

        if (input.version !== 0) {
          throw new ConflictException('Review was modified by another request');
        }

        return tx.review.create({
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
      },
    );

    return mapReview(saved);
  }

  async submitReview(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    input: SubmitReviewInput,
    roles: RoleKind[],
  ): Promise<{ review: ReviewDto; message: string }> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const { assignment, review } = await this.loadAssignmentForReviewer(
      userId,
      conferenceId,
      assignmentId,
      roles,
    );

    const round = await this.rounds.loadRound(userId, conferenceId, assignment.roundId, roles);

    if (round.status !== 'REVIEWING' && round.status !== 'REBUTTAL') {
      throw new ConflictException('Reviews cannot be submitted in the current round phase');
    }

    if (!review) {
      throw new BadRequestException('Save a review draft before submitting');
    }

    if (input.version !== review.version) {
      throw new ConflictException('Review was modified by another request');
    }

    if (review.submittedAt && round.status !== 'REBUTTAL') {
      throw new ConflictException('Review has already been submitted');
    }

    this.validateReviewForSubmit(review, conference.reviewConfig as ReviewConfig);

    const submitted = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
        const coiResult = await this.coiCheck.checkReviewerPaperConflict(
          tx,
          userId,
          assignment.paperId,
          conferenceId,
        );

        if (coiResult.hasConflict) {
          throw new ConflictException('Conflict of interest prevents review submission');
        }

        const updatedReview = await tx.review.update({
          where: { id: review.id },
          data: {
            submittedAt: review.submittedAt ?? new Date(),
            version: { increment: 1 },
          },
        });

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
      review: mapReview(submitted),
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

    const privileged = canCoordinateReview(roles);
    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

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
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    const activeRoundId = roundId ?? page.data[0]?.roundId;
    let roundStatus: RoundStatus | undefined;

    if (activeRoundId) {
      const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
        tx.reviewRound.findFirst({ where: { id: activeRoundId } }),
      );
      roundStatus = round?.status;
    }

    const data = privileged
      ? page.data.map((r) => mapReview(r))
      : page.data.map((r) => mapReviewForAuthor(r));

    return {
      data,
      roundId: activeRoundId,
      roundStatus,
      nextCursor: page.nextCursor,
    };
  }

  async releaseReviews(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: ReleaseReviewsInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to release reviews');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.rounds.loadRound(userId, conferenceId, roundId, roles);

    if (input.version !== round.version) {
      throw new ConflictException('Review round was modified by another request');
    }

    if (round.status !== 'REVIEWING') {
      throw new ConflictException('Reviews can only be released during the reviewing phase');
    }

    const result = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
        const submittedReviews = await tx.review.findMany({
          where: {
            roundId,
            conferenceId,
            submittedAt: { not: null },
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

        if (submittedReviews.length === 0) {
          throw new BadRequestException('No submitted reviews to release');
        }

        await tx.review.updateMany({
          where: {
            id: { in: submittedReviews.map((r) => r.id) },
            visibility: 'HIDDEN',
          },
          data: { visibility: 'AUTHOR_VISIBLE' },
        });

        const updatedRound = await tx.reviewRound.update({
          where: { id: roundId },
          data: {
            status: 'REBUTTAL',
            version: { increment: 1 },
          },
        });

        return { submittedReviews, updatedRound };
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'review.released',
      entity: 'ReviewRound',
      entityId: roundId,
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
          roundId,
          idempotencyKey: `review-released-${review.paperId}-${roundId}`,
        });
      }
    }

    return {
      releasedCount: result.submittedReviews.length,
      round: mapReviewRound(result.updatedRound),
      message: 'Reviews released to authors',
    };
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
        include: { review: true },
      }),
    );

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    assertScope(assignment, { conferenceId });

    if (assignment.reviewerUserId !== userId && !isPrivilegedReader(roles)) {
      throw new NotFoundException('Assignment not found');
    }

    return { assignment, review: assignment.review };
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

  private assertReviewEditable(roundStatus: string, submittedAt: Date | null): void {
    if (roundStatus === 'DECIDING' || roundStatus === 'CLOSED' || roundStatus === 'OPEN') {
      throw new ConflictException('Reviews cannot be edited in the current round phase');
    }

    if (submittedAt && roundStatus !== 'REBUTTAL') {
      throw new ConflictException('Submitted reviews cannot be edited until the rebuttal phase');
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
