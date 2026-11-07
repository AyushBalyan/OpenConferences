import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { Prisma, withTenantContext } from '@openconferences/db';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { effectiveReviewDeadline } from '@openconferences/schemas';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { minimumReviewsFromConfig } from '../review/review-stage';

const TOP_NAMES = 12;
export const EXCLUDED_PAPER_STATUSES = ['DRAFT', 'WITHDRAWN', 'WITHDRAWN_NONPAYMENT'] as const;
const excluded = new Set<string>(EXCLUDED_PAPER_STATUSES);
const unpaidStatuses = new Set(['PENDING', 'AWAITING_VERIFICATION', 'ADDITIONAL_PAYMENT_REQUIRED']);
export function topPaperCounts(rows: { key: string; paperId: string }[], limit = TOP_NAMES) {
  const grouped = new Map<string, { name: string; papers: Set<string> }>();
  for (const row of rows) {
    const name = row.key.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const entry = grouped.get(key) ?? { name, papers: new Set<string>() };
    entry.papers.add(row.paperId);
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .map((r) => ({ name: r.name, count: r.papers.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// A paper's identity, not its title, determines whether it was counted already.
export function topAuthorCounts(
  rows: { name: string; email: string; paperId: string; status: string }[],
) {
  const grouped = new Map<string, { name: string; papers: Set<string> }>();
  for (const row of rows) {
    if (excluded.has(row.status)) continue;
    const name = row.name.trim();
    if (!name) continue;
    const key = row.email.trim().toLowerCase() || name.toLocaleLowerCase();
    const entry = grouped.get(key) ?? { name, papers: new Set<string>() };
    entry.papers.add(row.paperId);
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .map((r) => ({ name: r.name, count: r.papers.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function submissionsByDay(createdAts: Date[]) {
  const counts = new Map<string, number>();
  for (const createdAt of createdAts) {
    const day = createdAt.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

const paperSelect = {
  id: true,
  status: true,
  createdAt: true,
  authorships: {
    select: { fullName: true, email: true, affiliation: true, isCorresponding: true },
  },
  reviewRounds: {
    orderBy: { roundNumber: 'desc' },
    take: 1,
    select: {
      reviewDueAt: true,
      reviewsReleasedAt: true,
      decisions: { select: { outcome: true } },
      assignments: {
        where: { status: { notIn: ['DECLINED', 'REPLACED'] } },
        select: {
          status: true,
          reviewerUserId: true,
          dueAt: true,
          createdAt: true,
          reviewer: { select: { name: true } },
          review: { select: { submittedAt: true } },
        },
      },
    },
  },
} satisfies Prisma.PaperSelect;
type AnalyticsPaper = Prisma.PaperGetPayload<{ select: typeof paperSelect }>;

export function aggregatePaperAnalytics(
  papers: AnalyticsPaper[],
  reviewDueAt: Date | null,
  minimumReviews: number,
  now: Date,
): Pick<
  ConferenceAnalyticsOverview,
  'submissions' | 'reviews' | 'decisions' | 'authors' | 'institutions'
> & { acceptedPaperIds: Set<string> } {
  const included = papers.filter((p) => !excluded.has(p.status));
  const statuses = new Map<AnalyticsPaper['status'], number>();
  const outcomes = new Map<
    NonNullable<AnalyticsPaper['reviewRounds'][number]['decisions'][number]>['outcome'],
    number
  >();
  let assigned = 0,
    submitted = 0,
    notStarted = 0,
    draft = 0,
    overdue = 0,
    closedIncomplete = 0,
    inconsistent = 0,
    underCoveredPapers = 0;
  const reviewers = new Map<string, { id: string; name: string; count: number }>();
  const acceptedPaperIds = new Set<string>();
  for (const p of included) {
    statuses.set(p.status, (statuses.get(p.status) ?? 0) + 1);
    const cycle = p.reviewRounds[0];
    const decision = cycle?.decisions[0];
    if (decision) {
      outcomes.set(decision.outcome, (outcomes.get(decision.outcome) ?? 0) + 1);
      if (decision.outcome === 'ACCEPT') acceptedPaperIds.add(p.id);
    }
    const open =
      ['SUBMITTED', 'UNDER_REVIEW'].includes(p.status) && !decision && !cycle?.reviewsReleasedAt;
    let cycleSubmitted = 0;
    for (const a of cycle?.assignments ?? []) {
      assigned++;
      if (a.review?.submittedAt) {
        submitted++;
        cycleSubmitted++;
        continue;
      }
      if (a.status === 'COMPLETED') {
        inconsistent++;
        continue;
      }
      if (!open) {
        closedIncomplete++;
        continue;
      }
      if (a.review) draft++;
      else notStarted++;
      if (effectiveReviewDeadline(a, cycle?.reviewDueAt, reviewDueAt) < now) overdue++;
      const reviewer = reviewers.get(a.reviewerUserId) ?? {
        id: a.reviewerUserId,
        name: a.reviewer.name.trim() || 'Reviewer',
        count: 0,
      };
      reviewer.count++;
      reviewers.set(a.reviewerUserId, reviewer);
    }
    if (open && cycleSubmitted < minimumReviews) underCoveredPapers++;
  }
  const totalDecisions = [...outcomes.values()].reduce((n, v) => n + v, 0);
  return {
    submissions: {
      total: included.length,
      excluded: {
        draft: papers.filter((p) => p.status === 'DRAFT').length,
        withdrawn: papers.filter((p) => p.status.startsWith('WITHDRAWN')).length,
      },
      byStatus: [...statuses].map(([status, count]) => ({ status, count })),
      byDay: submissionsByDay(included.map((p) => p.createdAt)),
    },
    reviews: {
      assigned,
      completed: submitted,
      submitted,
      notStarted,
      draft,
      overdue,
      closedIncomplete,
      inconsistent,
      underCoveredPapers,
      reviewerLoad: [...reviewers.values()]
        .sort(
          (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        )
        .slice(0, TOP_NAMES),
    },
    decisions: {
      total: totalDecisions,
      acceptRate: totalDecisions ? acceptedPaperIds.size / totalDecisions : 0,
      byOutcome: [...outcomes].map(([outcome, count]) => ({ outcome, count })),
    },
    acceptedPaperIds,
    authors: topAuthorCounts(
      included.flatMap((p) =>
        p.authorships
          .filter((a) => a.isCorresponding)
          .map((a) => ({ name: a.fullName, email: a.email, paperId: p.id, status: p.status })),
      ),
    ),
    institutions: topPaperCounts(
      included.flatMap((p) =>
        p.authorships.map((a) => ({ key: a.affiliation?.trim() || 'Unspecified', paperId: p.id })),
      ),
    ),
  };
}

export function aggregateRegistrations(
  rows: { paperId: string; status: string; deadlineAt: Date }[],
  accepted: Set<string>,
  now: Date,
) {
  const counts = new Map<string, number>();
  let unpaid = 0,
    overdue = 0,
    atRisk = 0;
  const paidPapers = new Set<string>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    if (row.status === 'PAID') paidPapers.add(row.paperId);
    if (!unpaidStatuses.has(row.status)) continue;
    unpaid++;
    if (row.deadlineAt < now) overdue++;
    else if (row.deadlineAt.getTime() <= now.getTime() + 7 * 86400000) atRisk++;
  }
  return {
    total: rows.length,
    paid: paidPapers.size,
    unpaid,
    overdue,
    atRisk,
    byStatus: [...counts].map(([status, count]) => ({ status, count })),
    unpaidAccepted: [...accepted].filter((id) => !paidPapers.has(id)).length,
  };
}

export function paymentContribution(payment: {
  status: string;
  kind: string;
  amountMinor: number;
}) {
  if (payment.kind === 'REFUND')
    return ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status) ? -payment.amountMinor : 0;
  return payment.status === 'CAPTURED' ? payment.amountMinor : 0;
}

// This is reporting conversion at the current fee-schedule rate, not payment repricing.
// Both USD and INR have 100 minor units. Round each positive ledger amount once,
// then apply its sign, so a refund reverses the same rounded conversion as a receipt.
export function aggregateRevenue(
  payments: {
    status: string;
    kind: string;
    amountMinor: number;
    currency: string;
    registration: { audience: string; lockedTiming: string | null };
  }[],
  schedule: { currency?: string; domesticInrPerUsd?: number },
) {
  const currency = schedule.currency ?? 'INR';
  const rate = schedule.domesticInrPerUsd;
  const inrPerUsd =
    typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate <= 1000 ? rate : null;
  const timing = new Map<string, number>(),
    audience = new Map<string, number>();
  const sources = new Map<
    string,
    NonNullable<ConferenceAnalyticsOverview['revenueConversion']>['byCurrency'][number]
  >();
  let revenueMinor = 0,
    excludedCurrencyPayments = 0,
    capturedMinor = 0,
    refundedMinor = 0;
  for (const payment of payments) {
    const original = paymentContribution(payment);
    if (!original) continue;
    const factor =
      payment.currency === currency
        ? new Prisma.Decimal(1)
        : inrPerUsd && currency === 'USD' && payment.currency === 'INR'
          ? new Prisma.Decimal(1).div(inrPerUsd)
          : inrPerUsd && currency === 'INR' && payment.currency === 'USD'
            ? new Prisma.Decimal(inrPerUsd)
            : null;
    const converted = factor
      ? new Prisma.Decimal(Math.abs(original))
          .mul(factor)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber() * Math.sign(original)
      : null;
    const source = sources.get(payment.currency) ?? {
      currency: payment.currency,
      capturedMinor: 0,
      refundedMinor: 0,
      netMinor: 0,
      convertedMinor: factor ? 0 : null,
      paymentCount: 0,
    };
    source.capturedMinor += original > 0 ? original : 0;
    source.refundedMinor += original < 0 ? -original : 0;
    source.netMinor += original;
    source.paymentCount++;
    if (converted !== null) source.convertedMinor = (source.convertedMinor ?? 0) + converted;
    sources.set(payment.currency, source);
    if (converted === null) {
      excludedCurrencyPayments++;
      continue;
    }
    capturedMinor += original > 0 ? converted : 0;
    refundedMinor += original < 0 ? -converted : 0;
    revenueMinor += converted;
    const timingKey = payment.registration.lockedTiming ?? 'UNSPECIFIED';
    timing.set(timingKey, (timing.get(timingKey) ?? 0) + converted);
    audience.set(
      payment.registration.audience,
      (audience.get(payment.registration.audience) ?? 0) + converted,
    );
  }
  const amounts = (values: Map<string, number>) =>
    [...values]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, amountMinor]) => ({ name, amountMinor }));
  return {
    currency,
    revenueMinor,
    excludedCurrencyPayments,
    revenueByTiming: amounts(timing),
    revenueByAudience: amounts(audience),
    revenueConversion: {
      inrPerUsd,
      capturedMinor,
      refundedMinor,
      byCurrency: [...sources.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    },
  };
}

export function aggregateRevenueReports(
  payments: Parameters<typeof aggregateRevenue>[0],
  schedule: Parameters<typeof aggregateRevenue>[1],
) {
  const report = aggregateRevenue(payments, schedule);
  const currencyReports = [report];
  if (report.revenueConversion.inrPerUsd && ['USD', 'INR'].includes(report.currency)) {
    currencyReports.push(
      aggregateRevenue(payments, {
        ...schedule,
        currency: report.currency === 'USD' ? 'INR' : 'USD',
      }),
    );
  }
  return { ...report, currencyReports };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly conferences: ConferenceService) {}
  async getOverview(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<ConferenceAnalyticsOverview> {
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Insufficient permissions to view analytics');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const feeSchedule = (conference.feeSchedule ?? {}) as {
      currency?: string;
      domesticInrPerUsd?: number;
    };
    const tenant = { userId, conferenceId, organizationId: conference.organizationId };
    return withTenantContext(
      tenant,
      async (tx) => {
        const now = new Date();
        const [papers, registrations, payments] = await Promise.all([
          tx.paper.findMany({ where: { conferenceId }, select: paperSelect }),
          tx.registration.findMany({
            where: { conferenceId, paper: { status: { notIn: [...EXCLUDED_PAPER_STATUSES] } } },
            select: { paperId: true, status: true, deadlineAt: true },
          }),
          // Money is a ledger: withdrawals must not erase real receipts or refunds.
          tx.payment.findMany({
            where: { organizationId: conference.organizationId, registration: { conferenceId } },
            select: {
              status: true,
              kind: true,
              amountMinor: true,
              currency: true,
              registration: { select: { audience: true, lockedTiming: true } },
            },
          }),
        ]);
        const { acceptedPaperIds, ...paperMetrics } = aggregatePaperAnalytics(
          papers,
          conference.reviewDueAt,
          minimumReviewsFromConfig(conference.reviewConfig),
          now,
        );
        const { unpaidAccepted, ...registrationMetrics } = aggregateRegistrations(
          registrations,
          acceptedPaperIds,
          now,
        );
        return {
          conferenceId,
          ...paperMetrics,
          registrations: registrationMetrics as ConferenceAnalyticsOverview['registrations'],
          unpaidAccepted,
          ...aggregateRevenueReports(payments, feeSchedule),
          computedAt: now.toISOString(),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }
}
