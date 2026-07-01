import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind, BidValue, ReviewRound } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CopyAssignmentsFromPreviousRoundInput,
  CreateAssignmentInput,
  ReviewerAssignmentDto,
} from '@openconferences/schemas';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { CoiCheckService } from './coi-check.service';
import { RoundsService } from './rounds.service';
import { mapReviewerAssignment } from './review.mapper';

type CreatedAssignment = {
  assignment: ReturnType<typeof mapReviewerAssignment>;
  reviewerEmail: string;
  paperTitle: string;
};

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly rounds: RoundsService,
    private readonly coiCheck: CoiCheckService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async list(
    userId: string,
    conferenceId: string,
    roundId: string,
    roles: RoleKind[],
  ): Promise<{
    data: Array<
      ReviewerAssignmentDto & {
        paperTitle?: string;
        reviewerName?: string;
        reviewerEmail?: string;
        bidValue?: BidValue | null;
      }
    >;
  }> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list assignments');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await this.rounds.loadRound(userId, conferenceId, roundId, roles);

    const assignments = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerAssignment.findMany({
          where: { roundId, conferenceId },
          include: {
            paper: { select: { title: true } },
            reviewer: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
    );

    const bids = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.bid.findMany({
          where: {
            conferenceId,
            paperId: { in: assignments.map((a) => a.paperId) },
            reviewerUserId: { in: assignments.map((a) => a.reviewerUserId) },
          },
        }),
    );

    const bidMap = new Map(bids.map((b) => [`${b.paperId}:${b.reviewerUserId}`, b.value]));

    return {
      data: assignments.map((a) => ({
        ...mapReviewerAssignment(a),
        paperTitle: a.paper.title,
        reviewerName: a.reviewer.name,
        reviewerEmail: a.reviewer.email,
        bidValue: bidMap.get(`${a.paperId}:${a.reviewerUserId}`) ?? null,
      })),
    };
  }

  async copyFromPreviousRound(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: CopyAssignmentsFromPreviousRoundInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to assign reviewers');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const targetRound = await this.rounds.loadRound(userId, conferenceId, roundId, roles);

    if (targetRound.status === 'CLOSED') {
      throw new ConflictException('Cannot assign reviewers to a closed round');
    }

    if (targetRound.roundNumber <= 1) {
      throw new BadRequestException('There is no previous round to copy assignments from');
    }

    const previousRound = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewRound.findFirst({
        where: {
          conferenceId,
          roundNumber: targetRound.roundNumber - 1,
        },
      }),
    );

    if (!previousRound) {
      throw new NotFoundException('Previous review round not found');
    }

    const paperIdFilter = input.paperIds?.length ? new Set(input.paperIds) : null;

    const sourceAssignments = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerAssignment.findMany({
          where: {
            conferenceId,
            roundId: previousRound.id,
            ...(paperIdFilter ? { paperId: { in: [...paperIdFilter] } } : {}),
          },
          include: {
            paper: { select: { id: true, title: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
    );

    let createdCount = 0;
    let skippedCount = 0;
    const failures: Array<{ paperId: string; reviewerUserId: string; reason: string }> = [];

    for (const source of sourceAssignments) {
      const outcome = await this.tryCreateAssignment(
        userId,
        conference.organizationId,
        conferenceId,
        targetRound,
        source.paperId,
        source.reviewerUserId,
        source.dueAt ?? undefined,
      );

      if (outcome.kind === 'created') {
        createdCount += 1;
        await this.audit.log({
          actorUserId: userId,
          organizationId: conference.organizationId,
          conferenceId,
          action: 'reviewer.assigned',
          entity: 'ReviewerAssignment',
          entityId: outcome.assignment.id,
          diff: {
            paperId: source.paperId,
            reviewerUserId: source.reviewerUserId,
            roundId,
            copiedFromRoundId: previousRound.id,
          },
        });
        await this.notifications.publishReviewerAssigned({
          to: outcome.reviewerEmail,
          conferenceId,
          organizationId: conference.organizationId,
          paperTitle: outcome.paperTitle,
          roundNumber: targetRound.roundNumber,
          dueAt:
            (outcome.assignment.dueAt
              ? new Date(outcome.assignment.dueAt)
              : targetRound.reviewDueAt
            )?.toISOString() ?? 'TBD',
          assignmentId: outcome.assignment.id,
          idempotencyKey: `reviewer-assignment-${outcome.assignment.id}`,
        });
        continue;
      }

      if (outcome.kind === 'skipped') {
        skippedCount += 1;
        continue;
      }

      failures.push({
        paperId: source.paperId,
        reviewerUserId: source.reviewerUserId,
        reason: outcome.reason,
      });
    }

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'reviewer.assignments_copied_from_previous_round',
      entity: 'ReviewRound',
      entityId: roundId,
      diff: {
        previousRoundId: previousRound.id,
        previousRoundNumber: previousRound.roundNumber,
        createdCount,
        skippedCount,
        failureCount: failures.length,
      },
    });

    return {
      createdCount,
      skippedCount,
      failures,
      previousRoundNumber: previousRound.roundNumber,
      message:
        createdCount > 0
          ? `Copied ${createdCount} assignment${createdCount === 1 ? '' : 's'} from Round ${previousRound.roundNumber}.`
          : `No assignments were copied from Round ${previousRound.roundNumber}.`,
    };
  }

  async assign(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: CreateAssignmentInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to assign reviewers');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.rounds.loadRound(userId, conferenceId, input.roundId, roles);

    if (round.status === 'CLOSED') {
      throw new ConflictException('Cannot assign reviewers to a closed round');
    }

    const outcome = await this.tryCreateAssignment(
      userId,
      conference.organizationId,
      conferenceId,
      round,
      paperId,
      input.reviewerUserId,
      input.dueAt ? new Date(input.dueAt) : undefined,
    );

    if (outcome.kind === 'skipped') {
      throw new ConflictException(outcome.reason);
    }

    if (outcome.kind === 'failed') {
      if (outcome.reason === 'Paper not found') {
        throw new NotFoundException(outcome.reason);
      }
      if (outcome.reason === 'Reviewer not found in this conference') {
        throw new NotFoundException(outcome.reason);
      }
      throw new ConflictException(outcome.reason);
    }

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'reviewer.assigned',
      entity: 'ReviewerAssignment',
      entityId: outcome.assignment.id,
      diff: {
        paperId,
        reviewerUserId: input.reviewerUserId,
        roundId: input.roundId,
      },
    });

    await this.notifications.publishReviewerAssigned({
      to: outcome.reviewerEmail,
      conferenceId,
      organizationId: conference.organizationId,
      paperTitle: outcome.paperTitle,
      roundNumber: round.roundNumber,
      dueAt:
        (outcome.assignment.dueAt
          ? new Date(outcome.assignment.dueAt)
          : round.reviewDueAt
        )?.toISOString() ?? 'TBD',
      assignmentId: outcome.assignment.id,
      idempotencyKey: `reviewer-assignment-${outcome.assignment.id}`,
    });

    return {
      assignment: outcome.assignment,
      message: 'Reviewer assigned successfully',
    };
  }

  async unassign(userId: string, conferenceId: string, assignmentId: string, roles: RoleKind[]) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to remove assignments');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const assignment = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewerAssignment.findFirst({ where: { id: assignmentId } }),
    );

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    assertScope(assignment, { conferenceId });

    await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => tx.reviewerAssignment.delete({ where: { id: assignmentId } }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'reviewer.unassigned',
      entity: 'ReviewerAssignment',
      entityId: assignmentId,
      diff: { paperId: assignment.paperId, reviewerUserId: assignment.reviewerUserId },
    });
  }

  private async tryCreateAssignment(
    userId: string,
    organizationId: string,
    conferenceId: string,
    round: ReviewRound,
    paperId: string,
    reviewerUserId: string,
    dueAt?: Date,
  ): Promise<
    | {
        kind: 'created';
        assignment: CreatedAssignment['assignment'];
        reviewerEmail: string;
        paperTitle: string;
      }
    | { kind: 'skipped'; reason: string }
    | { kind: 'failed'; reason: string }
  > {
    const existing = await withTenantContext({ userId, conferenceId, bypass: true }, async (tx) =>
      tx.reviewerAssignment.findFirst({
        where: { roundId: round.id, paperId, reviewerUserId },
      }),
    );

    if (existing) {
      return { kind: 'skipped', reason: 'Already assigned in this round' };
    }

    const paper = await withTenantContext({ userId, conferenceId, bypass: true }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId, conferenceId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
    );

    if (!paper) {
      return { kind: 'skipped', reason: 'Paper is not open for review' };
    }

    const reviewerMembership = await withTenantContext(
      { userId, conferenceId, organizationId, bypass: true },
      async (tx) =>
        tx.membership.findFirst({
          where: {
            userId: reviewerUserId,
            conferenceId,
            scope: 'CONFERENCE',
            roles: { some: { role: 'REVIEWER' } },
          },
          include: { user: { select: { email: true, name: true } } },
        }),
    );

    if (!reviewerMembership) {
      return { kind: 'failed', reason: 'Reviewer not found in this conference' };
    }

    try {
      const created = await withTenantContext(
        { userId, conferenceId, organizationId, bypass: true },
        async (tx) => {
          const coiResult = await this.coiCheck.checkReviewerPaperConflict(
            tx,
            reviewerUserId,
            paperId,
            conferenceId,
          );

          if (coiResult.hasConflict) {
            const detail =
              coiResult.reason === 'AUTHORSHIP'
                ? 'Reviewer is an author of this paper'
                : 'Reviewer has a declared conflict of interest';
            throw new ConflictException(detail);
          }

          const bid = await tx.bid.findUnique({
            where: {
              paperId_reviewerUserId: { paperId, reviewerUserId },
            },
          });

          if (bid?.value === 'CONFLICT') {
            throw new ConflictException('Reviewer bid CONFLICT on this paper');
          }

          const assignment = await tx.reviewerAssignment.create({
            data: {
              id: generateId(),
              organizationId,
              conferenceId,
              roundId: round.id,
              paperId,
              reviewerUserId,
              status: 'ASSIGNED',
              dueAt: dueAt ?? round.reviewDueAt,
            },
          });

          if (paper.status === 'SUBMITTED') {
            await tx.paper.update({
              where: { id: paperId },
              data: { status: 'UNDER_REVIEW' },
            });
          }

          return assignment;
        },
      );

      return {
        kind: 'created',
        assignment: mapReviewerAssignment(created),
        reviewerEmail: reviewerMembership.user.email,
        paperTitle: paper.title,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        return { kind: 'failed', reason: error.message };
      }
      throw error;
    }
  }
}
