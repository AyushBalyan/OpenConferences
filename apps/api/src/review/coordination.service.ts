import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId, withTenantContext, type RoleKind, type Prisma } from '@openconferences/db';
import {
  effectiveReviewDeadline,
  type AssignmentInterventionInput,
  type ReviewCoordinationDto,
} from '@openconferences/schemas';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview, canManageConferenceReview } from '../tenancy/role-hierarchy';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { deriveReviewStage, minimumReviewsFromConfig, reviewCountWarning } from './review-stage';
import { lockReviewRound } from './rounds.service';
import { CoiCheckService } from './coi-check.service';

@Injectable()
export class ReviewCoordinationService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly coi: CoiCheckService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async snapshot(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<ReviewCoordinationDto> {
    this.assertChair(roles);
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const now = new Date();
    const minimumReviews = minimumReviewsFromConfig(conference.reviewConfig);
    const tenant = { userId, conferenceId, organizationId: conference.organizationId };
    // One transaction and batched relations: no request/query per paper or reviewer.
    const { papers, pendingInvitations } = await withTenantContext(tenant, async (tx) => {
      const papers = await tx.paper.findMany({
        where: {
          conferenceId,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'DECISION_MADE', 'CAMERA_READY'] },
        },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          submissionNumber: true,
          status: true,
          version: true,
          trackId: true,
          track: { select: { name: true } },
          reviewRounds: {
            orderBy: { roundNumber: 'desc' },
            select: {
              id: true,
              roundNumber: true,
              version: true,
              reviewDueAt: true,
              reviewsReleasedAt: true,
              decisions: { select: { outcome: true }, take: 1 },
              assignments: {
                orderBy: { createdAt: 'asc' },
                include: {
                  reviewer: { select: { name: true, email: true } },
                  review: { select: { submittedAt: true } },
                },
              },
            },
          },
        },
      });
      const pendingInvitations = canManageConferenceReview(roles)
        ? await tx.reviewerInvitation.count({
            where: { conferenceId, status: 'PENDING', expiresAt: { gt: now } },
          })
        : null;
      return { papers, pendingInvitations };
    });
    const data = papers.flatMap((paper) =>
      (paper.reviewRounds.length ? paper.reviewRounds : [undefined]).map((cycle, cycleIndex) => {
        const isCurrentCycle = cycleIndex === 0;
        const reviewStage = cycle
          ? deriveReviewStage({
              reviewsReleasedAt: cycle.reviewsReleasedAt,
              decisionOutcome: cycle.decisions[0]?.outcome ?? null,
              hasNewerCycle: false,
            })
          : ('SUBMITTED' as const);
        const canIntervene =
          isCurrentCycle &&
          (paper.status === 'SUBMITTED' || paper.status === 'UNDER_REVIEW') &&
          !cycle?.reviewsReleasedAt &&
          !cycle?.decisions.length;
        const assignments = (cycle?.assignments ?? []).map((a) => {
          const dueAt = effectiveReviewDeadline(a, cycle?.reviewDueAt, conference.reviewDueAt);
          const reviewProgress = a.review?.submittedAt
            ? ('SUBMITTED' as const)
            : a.review
              ? ('DRAFT' as const)
              : ('NOT_STARTED' as const);
          return {
            id: a.id,
            organizationId: a.organizationId,
            conferenceId: a.conferenceId,
            roundId: a.roundId,
            paperId: a.paperId,
            reviewerUserId: a.reviewerUserId,
            status: a.status,
            version: a.version,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
            dueAt: dueAt.toISOString(),
            reviewerName: a.reviewer.name,
            reviewerEmail: a.reviewer.email,
            reviewProgress,
            overdue:
              canIntervene &&
              ['ASSIGNED', 'ACCEPTED'].includes(a.status) &&
              reviewProgress !== 'SUBMITTED' &&
              a.status !== 'COMPLETED' &&
              dueAt < now,
          };
        });
        const activeAssignments = assignments.filter(
          (a) => !['DECLINED', 'REPLACED'].includes(a.status),
        );
        const submittedReviewCount = activeAssignments.filter(
          (a) => a.reviewProgress === 'SUBMITTED',
        ).length;
        const readyForDecision = Boolean(
          isCurrentCycle &&
          cycle &&
          !cycle.decisions.length &&
          submittedReviewCount >= minimumReviews &&
          (paper.status === 'SUBMITTED' || paper.status === 'UNDER_REVIEW'),
        );
        return {
          isCurrentCycle,
          paperId: paper.id,
          paperTitle: paper.title,
          submissionNumber: paper.submissionNumber,
          paperStatus: paper.status,
          paperVersion: paper.version,
          trackId: paper.trackId,
          trackName: paper.track.name,
          cycleId: cycle?.id ?? null,
          cycleVersion: cycle?.version ?? null,
          roundNumber: cycle?.roundNumber ?? null,
          reviewStage,
          assignmentCount: activeAssignments.length,
          submittedReviewCount,
          reviewsReleasedAt: cycle?.reviewsReleasedAt?.toISOString() ?? null,
          reviewDueAt: (cycle?.reviewDueAt ?? conference.reviewDueAt)?.toISOString() ?? null,
          warning: canIntervene ? reviewCountWarning(submittedReviewCount, minimumReviews) : null,
          assignments,
          canIntervene,
          readyForDecision,
          needsReviewers: canIntervene && activeAssignments.length < minimumReviews,
          overdueReviewCount: assignments.filter((a) => a.overdue).length,
        };
      }),
    );
    return {
      observedAt: now.toISOString(),
      minimumReviews,
      data,
      summary: {
        needsReviewers: data.filter((p) => p.needsReviewers).length,
        overdueReviews: data.reduce((sum, p) => sum + p.overdueReviewCount, 0),
        overduePapers: data.filter((p) => p.overdueReviewCount > 0).length,
        readyForDecision: data.filter((p) => p.readyForDecision).length,
        pendingInvitations,
      },
      deadlines: {
        reviewDueAt: conference.reviewDueAt?.toISOString() ?? null,
        rebuttalDueAt: conference.rebuttalDueAt?.toISOString() ?? null,
      },
    };
  }

  async intervene(
    userId: string,
    conferenceId: string,
    assignmentId: string,
    input: AssignmentInterventionInput,
    roles: RoleKind[],
  ) {
    this.assertChair(roles);
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const tenant = { userId, conferenceId, organizationId: conference.organizationId };
    const outcome = await withTenantContext(tenant, async (tx) => {
      // Read only the cycle ID before locking. Re-read assignment status after acquiring
      // the same cycle lock that review submission and decision/release already use.
      const initial = await tx.reviewerAssignment.findFirst({
        where: { id: assignmentId, conferenceId },
        select: { roundId: true },
      });
      if (!initial) throw new NotFoundException('Reviewer assignment not found');
      await lockReviewRound(tx, conferenceId, initial.roundId);
      const assignment = await tx.reviewerAssignment.findFirst({
        where: { id: assignmentId, conferenceId },
        include: {
          review: { select: { submittedAt: true } },
          reviewer: { select: { name: true, email: true } },
          paper: { select: { title: true, status: true } },
          round: true,
        },
      });
      if (!assignment) throw new NotFoundException('Reviewer assignment not found');
      if (assignment.version !== input.version)
        throw new ConflictException('Assignment changed. Refresh the ledger and try again.');
      if (!['ASSIGNED', 'ACCEPTED'].includes(assignment.status) || assignment.review?.submittedAt) {
        throw new ConflictException(
          'Only unfinished active assignments can be changed or reminded',
        );
      }
      if (!['SUBMITTED', 'UNDER_REVIEW'].includes(assignment.paper.status))
        throw new ConflictException('This paper is not open for review');
      const closed =
        assignment.round.reviewsReleasedAt ||
        (await tx.decision.findFirst({
          where: { conferenceId, roundId: assignment.roundId },
          select: { id: true },
        }));
      const newerCycle = await tx.reviewRound.findFirst({
        where: {
          conferenceId,
          paperId: assignment.paperId,
          roundNumber: { gt: assignment.round.roundNumber },
        },
        select: { id: true },
      });
      if (closed || newerCycle)
        throw new ConflictException('This review cycle is closed. Refresh the ledger.');
      const dueAt = effectiveReviewDeadline(
        assignment,
        assignment.round.reviewDueAt,
        conference.reviewDueAt,
      );
      if (input.action === 'REMIND')
        return { assignment, dueAt, newAssignment: null, newReviewer: null };
      if (!input.reason?.trim()) throw new BadRequestException('A reason is required');
      if (input.action === 'EXTEND') {
        const extended = new Date(input.dueAt ?? '');
        if (!Number.isFinite(extended.getTime()) || extended <= new Date() || extended <= dueAt) {
          throw new BadRequestException('Choose a future deadline later than the current deadline');
        }
        await tx.reviewerAssignment.update({
          where: { id: assignmentId },
          data: { dueAt: extended, version: { increment: 1 } },
        });
        await this.audit(
          tx,
          userId,
          conference.organizationId,
          conferenceId,
          assignmentId,
          'reviewer.deadline_extended',
          { from: dueAt.toISOString(), to: extended.toISOString(), reason: input.reason },
        );
        return { assignment, dueAt: extended, newAssignment: null, newReviewer: null };
      }
      if (!input.reviewerUserId || input.reviewerUserId === assignment.reviewerUserId)
        throw new BadRequestException('Choose a different reviewer');
      const member = await tx.membership.findFirst({
        where: {
          conferenceId,
          scope: 'CONFERENCE',
          userId: input.reviewerUserId,
          roles: { some: { role: 'REVIEWER' } },
        },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!member)
        throw new NotFoundException('Replacement reviewer is not a reviewer in this conference');
      const conflict = await this.coi.checkReviewerPaperConflict(
        tx,
        input.reviewerUserId,
        assignment.paperId,
        conferenceId,
      );
      const bid = await tx.bid.findUnique({
        where: {
          paperId_reviewerUserId: {
            paperId: assignment.paperId,
            reviewerUserId: input.reviewerUserId,
          },
        },
      });
      if (conflict.hasConflict || bid?.value === 'CONFLICT')
        throw new ConflictException('Replacement reviewer has a conflict of interest');
      const replacementDueAt = input.dueAt ? new Date(input.dueAt) : dueAt;
      if (!Number.isFinite(replacementDueAt.getTime()) || replacementDueAt <= new Date())
        throw new BadRequestException('Choose a future deadline for the replacement reviewer');
      const existing = await tx.reviewerAssignment.findFirst({
        where: {
          conferenceId,
          roundId: assignment.roundId,
          paperId: assignment.paperId,
          reviewerUserId: input.reviewerUserId,
        },
      });
      if (existing) throw new ConflictException('Reviewer already has an assignment in this cycle');
      // Preserve the original record and draft; the replacement starts with a new identity.
      await tx.reviewerAssignment.update({
        where: { id: assignmentId },
        data: { status: 'REPLACED', version: { increment: 1 } },
      });
      const newAssignment = await tx.reviewerAssignment.create({
        data: {
          id: generateId(),
          organizationId: conference.organizationId,
          conferenceId,
          roundId: assignment.roundId,
          paperId: assignment.paperId,
          reviewerUserId: input.reviewerUserId,
          status: 'ASSIGNED',
          dueAt: replacementDueAt,
        },
      });
      await this.audit(
        tx,
        userId,
        conference.organizationId,
        conferenceId,
        assignmentId,
        'reviewer.replaced',
        {
          previousReviewerUserId: assignment.reviewerUserId,
          reviewerUserId: input.reviewerUserId,
          replacementAssignmentId: newAssignment.id,
          dueAt: replacementDueAt.toISOString(),
          reason: input.reason,
        },
      );
      return { assignment, dueAt: replacementDueAt, newAssignment, newReviewer: member.user };
    });
    if (input.action === 'EXTEND')
      return {
        assignmentId,
        message: 'Deadline extended. The reviewer can see the updated deadline.',
      };
    if (input.action === 'REMIND') {
      const queued = await this.notifications.publishReviewReminder({
        to: outcome.assignment.reviewer.email,
        conferenceId,
        organizationId: conference.organizationId,
        conferenceName: conference.name,
        paperTitle: outcome.assignment.paper.title,
        dueAt: outcome.dueAt.toISOString(),
        assignmentId,
        idempotencyKey: `chair-review-reminder-${assignmentId}-${input.version}-${new Date().toISOString().slice(0, 10)}`,
      });
      if (!queued)
        throw new ConflictException(
          'Reminder was not queued. Check email suppression and notification delivery settings.',
        );
      await withTenantContext(tenant, (tx) =>
        this.audit(
          tx,
          userId,
          conference.organizationId,
          conferenceId,
          assignmentId,
          'reviewer.reminder_requested',
          { dueAt: outcome.dueAt.toISOString() },
        ),
      );
      return {
        assignmentId,
        message:
          'Reminder queued (or already queued today). Delivery status is available in Notifications.',
      };
    }
    const newAssignment = outcome.newAssignment!;
    try {
      const queued = await this.notifications.publishReviewerAssigned({
        to: outcome.newReviewer!.email,
        reviewerName: outcome.newReviewer!.name,
        conferenceName: conference.name,
        conferenceId,
        organizationId: conference.organizationId,
        paperTitle: outcome.assignment.paper.title,
        roundNumber: outcome.assignment.round.roundNumber,
        dueAt: outcome.dueAt.toISOString(),
        assignmentId: newAssignment.id,
        idempotencyKey: `reviewer-assignment-${newAssignment.id}`,
      });
      if (queued === false) throw new Error('Assignment email suppressed');
      return {
        assignmentId: newAssignment.id,
        message: 'Reviewer replaced. The original assignment and draft have been preserved.',
      };
    } catch {
      // Assignment is committed: do not claim failure and invite a duplicate replacement.
      return {
        assignmentId: newAssignment.id,
        message: 'Reviewer replaced. The original assignment and draft have been preserved.',
        notificationWarning:
          'The assignment email could not be queued. Check Notifications and contact the replacement reviewer.',
      };
    }
  }

  private assertChair(roles: RoleKind[]) {
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Review coordination permission required');
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    organizationId: string,
    conferenceId: string,
    entityId: string,
    action: string,
    diff: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        id: generateId(),
        actorUserId,
        organizationId,
        conferenceId,
        entity: 'ReviewerAssignment',
        entityId,
        action,
        diff,
      },
    });
  }
}
