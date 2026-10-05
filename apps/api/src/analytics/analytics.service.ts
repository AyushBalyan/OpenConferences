import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { withTenantContext } from '@openconferences/db';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { effectiveReviewDeadline } from '@openconferences/schemas';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { minimumReviewsFromConfig } from '../review/review-stage';

const PAID_REGISTRATION_STATUSES = new Set([
  'PAID',
  'AWAITING_VERIFICATION',
  'ADDITIONAL_PAYMENT_REQUIRED',
]);

const TOP_NAMES = 12;

export function topPaperCounts(
  rows: { key: string; paperId: string }[],
  limit = TOP_NAMES,
): { name: string; count: number }[] {
  const papersByKey = new Map<string, { name: string; papers: Set<string> }>();
  for (const row of rows) {
    const name = row.key.trim();
    if (!name) continue;
    const id = name.toLocaleLowerCase();
    const existing = papersByKey.get(id);
    if (existing) {
      existing.papers.add(row.paperId);
    } else {
      papersByKey.set(id, { name, papers: new Set([row.paperId]) });
    }
  }
  return [...papersByKey.values()]
    .map((entry) => ({ name: entry.name, count: entry.papers.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

const WITHDRAWN_PAPER_STATUSES = new Set(['WITHDRAWN', 'WITHDRAWN_NONPAYMENT']);

export function topAuthorCounts(
  rows: { name: string; title: string; status: string }[],
  limit?: number,
): { name: string; count: number }[] {
  const titlesByAuthor = new Map<string, { name: string; titles: Set<string> }>();
  for (const row of rows) {
    if (WITHDRAWN_PAPER_STATUSES.has(row.status)) continue;
    const name = row.name.trim();
    const title = row.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!name || !title) continue;
    const id = name.toLocaleLowerCase();
    const existing = titlesByAuthor.get(id);
    if (existing) {
      existing.titles.add(title);
    } else {
      titlesByAuthor.set(id, { name, titles: new Set([title]) });
    }
  }
  const ranked = [...titlesByAuthor.values()]
    .map((entry) => ({ name: entry.name, count: entry.titles.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return limit == null ? ranked : ranked.slice(0, limit);
}

export function submissionsByDay(createdAts: Date[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const createdAt of createdAts) {
    const date = createdAt.toISOString().slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly conferences: ConferenceService) {}

  async getOverview(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<ConferenceAnalyticsOverview> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to view analytics');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const feeSchedule = conference.feeSchedule as { currency?: string };
    const currency = feeSchedule?.currency ?? 'INR';
    const minimumReviews = minimumReviewsFromConfig(conference.reviewConfig);
    const now = new Date();
    const atRiskThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tenant = { userId, conferenceId, organizationId: conference.organizationId };

    const [
      submissionGroups,
      submittedPapers,
      authorships,
      assignmentTotal,
      completedAssignments,
      assignments,
      underReviewPapers,
      decisionGroups,
      acceptedDecisions,
      paidRegistrations,
      registrationGroups,
      atRiskRows,
      payments,
    ] = await withTenantContext(tenant, async (tx) =>
      Promise.all([
        tx.paper.groupBy({
          by: ['status'],
          where: { conferenceId },
          _count: { _all: true },
        }),
        tx.paper.findMany({
          where: { conferenceId, status: { not: 'DRAFT' } },
          select: { createdAt: true },
        }),
        tx.authorship.findMany({
          where: { paper: { conferenceId, status: { not: 'DRAFT' } } },
          select: {
            paperId: true,
            fullName: true,
            affiliation: true,
            isCorresponding: true,
            paper: { select: { title: true, status: true } },
          },
        }),
        tx.reviewerAssignment.count({
          where: { conferenceId, status: { notIn: ['DECLINED', 'REPLACED'] } },
        }),
        tx.reviewerAssignment.count({ where: { conferenceId, status: 'COMPLETED' } }),
        tx.reviewerAssignment.findMany({
          where: { conferenceId, status: { notIn: ['DECLINED', 'REPLACED'] } },
          select: {
            paperId: true,
            round: { select: { reviewDueAt: true } },
            dueAt: true,
            createdAt: true,
            reviewer: { select: { name: true } },
            review: { select: { submittedAt: true } },
          },
        }),
        tx.paper.findMany({
          where: { conferenceId, status: 'UNDER_REVIEW' },
          select: { id: true },
        }),
        tx.decision.groupBy({
          by: ['outcome'],
          where: { conferenceId },
          _count: { _all: true },
        }),
        tx.decision.findMany({
          where: { conferenceId, outcome: 'ACCEPT' },
          select: { paperId: true },
          distinct: ['paperId'],
        }),
        tx.registration.findMany({
          where: { conferenceId, status: 'PAID' },
          select: { paperId: true },
        }),
        tx.registration.groupBy({
          by: ['status'],
          where: { conferenceId },
          _count: { _all: true },
        }),
        tx.registration.count({
          where: {
            conferenceId,
            status: {
              notIn: ['PAID', 'CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT'],
            },
            deadlineAt: { lte: atRiskThreshold },
          },
        }),
        tx.payment.findMany({
          where: {
            organizationId: conference.organizationId,
            registration: { conferenceId },
            status: { in: ['CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
          },
          select: {
            status: true,
            amountMinor: true,
            registration: { select: { audience: true, lockedTiming: true } },
          },
        }),
      ]),
    );

    const byStatus = submissionGroups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    const submissionsTotal = byStatus.reduce((sum, row) => sum + row.count, 0);

    const byOutcome = decisionGroups.map((row) => ({
      outcome: row.outcome,
      count: row._count._all,
    }));

    const byRegistrationStatus = registrationGroups.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    const registrationsTotal = byRegistrationStatus.reduce((sum, row) => sum + row.count, 0);

    const paid = byRegistrationStatus
      .filter((row) => row.status === 'PAID')
      .reduce((sum, row) => sum + row.count, 0);

    const unpaid = byRegistrationStatus
      .filter((row) => !PAID_REGISTRATION_STATUSES.has(row.status))
      .reduce((sum, row) => sum + row.count, 0);

    let revenueMinor = 0;
    const timingTotals = new Map<string, number>();
    const audienceTotals = new Map<string, number>();
    for (const payment of payments) {
      const signed =
        payment.status === 'CAPTURED'
          ? payment.amountMinor
          : payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED'
            ? -payment.amountMinor
            : 0;
      revenueMinor += signed;
      const timing = payment.registration.lockedTiming ?? 'REGULAR';
      const audience = payment.registration.audience;
      timingTotals.set(timing, (timingTotals.get(timing) ?? 0) + signed);
      audienceTotals.set(audience, (audienceTotals.get(audience) ?? 0) + signed);
    }

    let notStarted = 0;
    let draft = 0;
    let submitted = 0;
    let overdue = 0;
    const submittedByPaper = new Map<string, number>();
    const openByReviewer = new Map<string, { name: string; count: number }>();
    for (const assignment of assignments) {
      const submittedAt = assignment.review?.submittedAt ?? null;
      if (submittedAt) {
        submitted += 1;
        submittedByPaper.set(
          assignment.paperId,
          (submittedByPaper.get(assignment.paperId) ?? 0) + 1,
        );
      } else if (assignment.review) {
        draft += 1;
      } else {
        notStarted += 1;
      }
      if (!submittedAt) {
        const dueAt = effectiveReviewDeadline(
          assignment,
          assignment.round?.reviewDueAt,
          conference.reviewDueAt,
        );
        if (dueAt.getTime() < now.getTime()) overdue += 1;
        const reviewerName = assignment.reviewer.name.trim() || 'Reviewer';
        const reviewerKey = reviewerName.toLocaleLowerCase();
        const existing = openByReviewer.get(reviewerKey);
        if (existing) existing.count += 1;
        else openByReviewer.set(reviewerKey, { name: reviewerName, count: 1 });
      }
    }

    const underCoveredPapers = underReviewPapers.filter(
      (paper) => (submittedByPaper.get(paper.id) ?? 0) < minimumReviews,
    ).length;

    const decisionTotal = byOutcome.reduce((sum, row) => sum + row.count, 0);
    const acceptCount = byOutcome.find((row) => row.outcome === 'ACCEPT')?.count ?? 0;
    const paidPaperIds = new Set(paidRegistrations.map((row) => row.paperId));
    const unpaidAccepted = acceptedDecisions.filter((row) => !paidPaperIds.has(row.paperId)).length;

    return {
      conferenceId,
      submissions: {
        total: submissionsTotal,
        byStatus,
        byDay: submissionsByDay(submittedPapers.map((paper) => paper.createdAt)),
      },
      reviews: {
        assigned: assignmentTotal,
        completed: completedAssignments,
        notStarted,
        draft,
        submitted,
        overdue,
        underCoveredPapers,
        reviewerLoad: [...openByReviewer.values()]
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, TOP_NAMES),
      },
      decisions: {
        total: decisionTotal,
        acceptRate: decisionTotal === 0 ? 0 : acceptCount / decisionTotal,
        byOutcome,
      },
      registrations: {
        total: registrationsTotal,
        paid,
        unpaid,
        atRisk: atRiskRows,
        byStatus: byRegistrationStatus,
      },
      revenueMinor,
      revenueByTiming: [...timingTotals.entries()].map(([name, amountMinor]) => ({
        name,
        amountMinor,
      })),
      revenueByAudience: [...audienceTotals.entries()].map(([name, amountMinor]) => ({
        name,
        amountMinor,
      })),
      unpaidAccepted,
      authors: topAuthorCounts(
        authorships
          .filter((row) => row.isCorresponding)
          .map((row) => ({
            name: row.fullName,
            title: row.paper.title,
            status: row.paper.status,
          })),
      ),
      institutions: topPaperCounts(
        authorships.map((row) => ({
          key: row.affiliation?.trim() || 'Unspecified',
          paperId: row.paperId,
        })),
      ),
      currency,
      computedAt: new Date().toISOString(),
    };
  }
}
