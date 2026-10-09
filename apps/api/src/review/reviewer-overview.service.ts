import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { getConfig } from '@openconferences/config/env';
import {
  aggregateReviewerWorkload,
  effectiveReviewDeadline,
  type ReviewerDigestInput,
  type ReviewerDigestSnapshot,
  type ReviewerOverviewQuery,
  type ReviewerOverview,
  type ReviewerWorkAssignment,
  reviewerDigestSnapshotSchema,
} from '@openconferences/schemas';
import {
  generateId,
  withTenantContext,
  renderReviewerDigest,
  withMailDisclaimer,
  type Prisma,
  type RoleKind,
} from '@openconferences/db';
import { validateDigestTargets } from '@openconferences/db';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { QueueService } from '../queue/queue.service';
import { lockReviewRound } from './rounds.service';

export function digestPreviewToken(snapshot: ReviewerDigestSnapshot) {
  const { preparedAt: _preparedAt, ...content } = snapshot;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

@Injectable()
export class ReviewerOverviewService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly queue: QueueService,
  ) {}

  private async context(userId: string, conferenceId: string, roles: RoleKind[]) {
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Review coordination permission required');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    return { userId, conferenceId, organizationId: conference.organizationId };
  }

  async overview(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    scope: ReviewerOverviewQuery,
  ): Promise<ReviewerOverview> {
    const ctx = await this.context(userId, conferenceId, roles);
    return withTenantContext(
      ctx,
      async (tx) => {
        const now = new Date();
        const conference = await tx.conference.findUniqueOrThrow({
          where: { id: conferenceId },
          select: { name: true, reviewDueAt: true },
        });
        const members = await tx.membership.findMany({
          where: { conferenceId, scope: 'CONFERENCE', roles: { some: { role: 'REVIEWER' } } },
          select: { userId: true, user: { select: { name: true, email: true } } },
        });
        const papers = await tx.paper.findMany({
          where: { conferenceId, status: { not: 'DRAFT' } },
          select: {
            id: true,
            title: true,
            submissionNumber: true,
            status: true,
            trackId: true,
            track: { select: { name: true } },
            reviewRounds: {
              orderBy: { roundNumber: 'desc' },
              select: {
                id: true,
                roundNumber: true,
                reviewDueAt: true,
                reviewsReleasedAt: true,
                decisions: { select: { id: true }, take: 1 },
                assignments: {
                  include: {
                    reviewer: { select: { name: true, email: true } },
                    review: { select: { submittedAt: true } },
                  },
                },
              },
            },
          },
        });
        const assignments: ReviewerWorkAssignment[] = [];
        for (const paper of papers)
          for (const [index, cycle] of paper.reviewRounds.entries()) {
            const isCurrentCycle = index === 0;
            if (
              (scope.history === 'CURRENT' && !isCurrentCycle) ||
              (scope.history === 'HISTORICAL' && isCurrentCycle) ||
              (scope.track && scope.track !== paper.trackId) ||
              (scope.cycle && scope.cycle !== cycle.roundNumber)
            )
              continue;
            const search = scope.paperSearch?.toLowerCase();
            if (
              search &&
              !`${paper.title} ${paper.submissionNumber ?? ''}`.toLowerCase().includes(search)
            )
              continue;
            const open =
              isCurrentCycle &&
              ['SUBMITTED', 'UNDER_REVIEW'].includes(paper.status) &&
              !cycle.reviewsReleasedAt &&
              !cycle.decisions.length;
            for (const a of cycle.assignments) {
              const dueAt = effectiveReviewDeadline(a, cycle.reviewDueAt, conference.reviewDueAt);
              const reviewProgress = a.review?.submittedAt
                ? 'SUBMITTED'
                : a.review
                  ? 'DRAFT'
                  : 'NOT_STARTED';
              const workState =
                ['DECLINED', 'REPLACED'].includes(a.status) || paper.status.startsWith('WITHDRAWN')
                  ? 'RETIRED'
                  : reviewProgress === 'SUBMITTED'
                    ? 'SUBMITTED'
                    : a.status === 'COMPLETED'
                      ? 'INCONSISTENT'
                      : !open
                        ? 'CLOSED'
                        : reviewProgress;
              const remaining = workState === 'DRAFT' || workState === 'NOT_STARTED';
              assignments.push({
                id: a.id,
                organizationId: a.organizationId,
                conferenceId,
                roundId: a.roundId,
                paperId: paper.id,
                reviewerUserId: a.reviewerUserId,
                status: a.status,
                version: a.version,
                createdAt: a.createdAt.toISOString(),
                updatedAt: a.updatedAt.toISOString(),
                dueAt: dueAt.toISOString(),
                reviewerName: a.reviewer.name,
                reviewerEmail: a.reviewer.email,
                reviewProgress,
                overdue: remaining && dueAt < now,
                paperTitle: paper.title,
                submissionNumber: paper.submissionNumber,
                trackId: paper.trackId,
                trackName: paper.track.name,
                roundNumber: cycle.roundNumber,
                isCurrentCycle,
                paperStatus: paper.status,
                canIntervene: remaining && open,
                workState,
                dueSoon:
                  remaining &&
                  dueAt >= now &&
                  dueAt.getTime() <= now.getTime() + 72 * 60 * 60 * 1000,
              });
            }
          }
        const roster = members.map((m) => ({ userId: m.userId, ...m.user }));
        // Keep replacement choices complete; paper search narrows visible reviewers.
        const allData = aggregateReviewerWorkload(roster, assignments);
        const data = scope.paperSearch?.trim()
          ? allData.filter((r) => r.assignments.length > 0)
          : allData;
        const digests = await tx.reviewerReminderDigest.findMany({
          where: { conferenceId, utcDay: now.toISOString().slice(0, 10) },
          select: {
            id: true,
            reviewerUserId: true,
            status: true,
            createdAt: true,
            notificationLogId: true,
            notificationLog: { select: { status: true, error: true } },
          },
        });
        const byReviewer = new Map(digests.map((d) => [d.reviewerUserId, d]));
        for (const row of data) {
          const d = byReviewer.get(row.userId);
          if (d)
            row.digestToday = {
              id: d.id,
              status: d.notificationLog?.status ?? d.status,
              createdAt: d.createdAt.toISOString(),
              notificationLogId: d.notificationLogId,
            };
        }
        data.sort(
          (a, b) =>
            b.overdue - a.overdue ||
            b.remaining - a.remaining ||
            (a.earliestDeadline ?? 'z').localeCompare(b.earliestDeadline ?? 'z') ||
            a.name.localeCompare(b.name) ||
            a.userId.localeCompare(b.userId),
        );
        const good = data.filter((r) => !r.inconsistent);
        return {
          observedAt: now.toISOString(),
          conferenceName: conference.name,
          scope,
          complete: true,
          data,
          roster,
          tracks: [
            ...new Map(
              papers.map((p) => [p.trackId, { id: p.trackId, name: p.track.name }]),
            ).values(),
          ],
          cycles: [
            ...new Set(papers.flatMap((p) => p.reviewRounds.map((c) => c.roundNumber))),
          ].sort((a, b) => a - b),
          summary: {
            overdue: good.filter((r) => r.overdue > 0).length,
            dueSoon: good.filter((r) => r.dueSoon > 0).length,
            allSubmitted: good.filter((r) => r.allSubmitted).length,
            unassigned: good.filter((r) => r.assigned === 0).length,
          },
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }

  private async prepare(
    tx: Prisma.TransactionClient,
    conferenceId: string,
    organizationId: string,
    reviewerUserId: string,
    targets: Array<{ id: string; version: number }>,
  ): Promise<ReviewerDigestSnapshot> {
    const initial = await tx.reviewerAssignment.findMany({
      where: { conferenceId, reviewerUserId, id: { in: targets.map((t) => t.id) } },
      select: { roundId: true },
    });
    for (const roundId of [...new Set(initial.map((a) => a.roundId))].sort())
      await lockReviewRound(tx, conferenceId, roundId);
    let validated;
    try {
      validated = await validateDigestTargets(tx, conferenceId, reviewerUserId, targets);
    } catch (e) {
      throw new ConflictException(e instanceof Error ? e.message : 'Assignments changed');
    }
    const template =
      (await tx.notificationTemplate.findFirst({
        where: { organizationId, key: 'reviewer.reminder_digest', isActive: true },
        orderBy: { version: 'desc' },
      })) ??
      (await tx.notificationTemplate.findFirst({
        where: { organizationId: null, key: 'reviewer.reminder_digest', isActive: true },
        orderBy: { version: 'desc' },
      }));
    if (!template) throw new NotFoundException('Reviewer reminder template is not configured');
    const data = {
      recipient: validated.member.email.trim().toLowerCase(),
      reviewerName: validated.member.name,
      conferenceName: validated.conferenceName,
      reviewUrl: `${getConfig().webUrl.replace(/\/$/, '')}/dashboard/conferences/${conferenceId}/reviews/my-assignments`,
      items: validated.items,
    };
    const rendered = renderReviewerDigest(template, data);
    return {
      templateId: template.id,
      templateVersion: template.version,
      ...data,
      ...rendered,
      html: withMailDisclaimer(rendered.html, 'html'),
      text: withMailDisclaimer(rendered.text, 'text'),
      preparedAt: new Date().toISOString(),
    };
  }

  async preview(
    userId: string,
    conferenceId: string,
    reviewerUserId: string,
    roles: RoleKind[],
    targets: Array<{ id: string; version: number }>,
  ) {
    const ctx = await this.context(userId, conferenceId, roles);
    return withTenantContext(ctx, async (tx) => {
      const snapshot = await this.prepare(
        tx,
        conferenceId,
        ctx.organizationId,
        reviewerUserId,
        targets,
      );
      const suppression = await tx.emailSuppression.findUnique({
        where: { email: snapshot.recipient },
        select: { id: true },
      });
      if (suppression)
        throw new ConflictException('This recipient is suppressed. No reminder can be sent.');
      return {
        ...snapshot,
        previewToken: digestPreviewToken(snapshot),
        dailyLimit:
          'One manual digest per reviewer, per conference, per UTC day. Individual and scheduled reminders have separate limits.',
      };
    });
  }

  async send(
    userId: string,
    conferenceId: string,
    reviewerUserId: string,
    roles: RoleKind[],
    input: ReviewerDigestInput,
  ) {
    const ctx = await this.context(userId, conferenceId, roles);
    return withTenantContext(
      ctx,
      async (tx) => {
        const utcDay = new Date().toISOString().slice(0, 10);
        // Serialise this day's reservation before cycle locks (same order for every caller).
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${conferenceId}:${reviewerUserId}:${utcDay}`},0))::text`;
        const sameRequest = await tx.reviewerReminderDigest.findUnique({
          where: { requestId: input.requestId },
        });
        if (
          sameRequest &&
          (sameRequest.conferenceId !== conferenceId ||
            sameRequest.reviewerUserId !== reviewerUserId)
        )
          throw new ConflictException('Request ID already belongs to another reminder');
        const existing =
          sameRequest ??
          (await tx.reviewerReminderDigest.findUnique({
            where: { conferenceId_reviewerUserId_utcDay: { conferenceId, reviewerUserId, utcDay } },
          }));
        if (
          existing &&
          (existing.status !== 'CANCELLED' || existing.notificationLogId || sameRequest)
        )
          return this.result(existing, true);
        const snapshot = await this.prepare(
          tx,
          conferenceId,
          ctx.organizationId,
          reviewerUserId,
          input.assignments,
        );
        if (digestPreviewToken(snapshot) !== input.previewToken)
          throw new ConflictException('The reminder content or deadline changed. Preview again.');
        const digest = existing
          ? await tx.reviewerReminderDigest.update({
              where: { id: existing.id },
              data: {
                requestId: input.requestId,
                requestedById: userId,
                status: 'PREPARING',
                error: null,
                snapshot: snapshot as unknown as Prisma.InputJsonValue,
                cancelledSnapshots: [
                  ...(Array.isArray(existing.cancelledSnapshots)
                    ? existing.cancelledSnapshots
                    : []),
                  existing.snapshot,
                ] as Prisma.InputJsonValue,
              },
            })
          : await tx.reviewerReminderDigest.create({
              data: {
                id: generateId(),
                organizationId: ctx.organizationId,
                conferenceId,
                reviewerUserId,
                requestedById: userId,
                requestId: input.requestId,
                utcDay,
                snapshot: snapshot as unknown as Prisma.InputJsonValue,
              },
            });
        const jobId = await this.queue.enqueueReviewerDigest(
          { digestId: digest.id, requestId: input.requestId },
          tx,
        );
        if (!jobId)
          throw new ConflictException('Reminder could not be scheduled. Refresh and retry.');
        await tx.auditLog.create({
          data: {
            id: generateId(),
            actorUserId: userId,
            organizationId: ctx.organizationId,
            conferenceId,
            entity: 'ReviewerReminderDigest',
            entityId: digest.id,
            action: 'reviewer.digest_requested',
            diff: {
              reviewerUserId,
              assignmentIds: input.assignments.map((a) => a.id),
              utcDay,
              requestId: input.requestId,
            },
          },
        });
        return this.result(digest, false);
      },
      { timeout: 15000 },
    );
  }

  private result(
    digest: {
      id: string;
      status: string;
      snapshot: Prisma.JsonValue;
      notificationLogId: string | null;
    },
    alreadyRequested: boolean,
  ) {
    return {
      digestId: digest.id,
      status: digest.status as 'PREPARING' | 'QUEUED' | 'SUPPRESSED' | 'CANCELLED' | 'FAILED',
      alreadyRequested,
      assignmentCount: reviewerDigestSnapshotSchema.parse(digest.snapshot).items.length,
      notificationLogId: digest.notificationLogId,
      message: alreadyRequested
        ? 'A manual digest has already been requested today. Check its status before retrying.'
        : 'Reminder preparation scheduled. Delivery is not yet confirmed.',
    };
  }
}
