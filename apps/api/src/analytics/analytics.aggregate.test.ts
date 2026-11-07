import { describe, expect, it } from 'vitest';
import {
  aggregatePaperAnalytics,
  aggregateRevenue,
  aggregateRevenueReports,
  aggregateRegistrations,
  paymentContribution,
  submissionsByDay,
  topAuthorCounts,
  topPaperCounts,
} from './analytics.service';
type Paper = Parameters<typeof aggregatePaperAnalytics>[0][number];
const now = new Date('2026-10-09T12:00:00Z');
const makePaper = (id: string, status: Paper['status'] = 'UNDER_REVIEW'): Paper => ({
  id,
  status,
  createdAt: now,
  authorships: [
    { fullName: 'Ada', email: 'ada@example.test', affiliation: 'Institute', isCorresponding: true },
  ],
  reviewRounds: [],
});
const assignment = (
  id: string,
  state: 'none' | 'draft' | 'submitted' | 'inconsistent' = 'none',
) => ({
  status: state === 'inconsistent' ? ('COMPLETED' as const) : ('ASSIGNED' as const),
  reviewerUserId: id,
  reviewer: { name: 'Same Name' },
  dueAt: new Date('2026-10-01'),
  createdAt: now,
  review:
    state === 'none' || state === 'inconsistent'
      ? null
      : { submittedAt: state === 'submitted' ? now : null },
});
describe('analytics aggregates', () => {
  it('excludes drafts and both withdrawals from every paper metric', () => {
    const hidden = ['DRAFT', 'WITHDRAWN', 'WITHDRAWN_NONPAYMENT'].map((s, i) => ({
      ...makePaper(`hidden${i}`, s as Paper['status']),
      reviewRounds: [
        {
          reviewDueAt: null,
          reviewsReleasedAt: null,
          decisions: [{ outcome: 'ACCEPT' as const }],
          assignments: [assignment('x', 'submitted')],
        },
      ],
    }));
    const data = aggregatePaperAnalytics([...hidden, makePaper('included')], null, 2, now);
    expect(data.submissions).toMatchObject({
      total: 1,
      excluded: { draft: 1, withdrawn: 2 },
      byStatus: [{ status: 'UNDER_REVIEW', count: 1 }],
      byDay: [{ date: '2026-10-09', count: 1 }],
    });
    expect(data.reviews.assigned).toBe(0);
    expect(data.decisions.total).toBe(0);
    expect(data.authors).toEqual([{ name: 'Ada', count: 1 }]);
    expect(data.institutions).toEqual([{ name: 'Institute', count: 1 }]);
  });
  it('counts genuine submissions, separates closed work and does not merge reviewers by name', () => {
    const p = makePaper('p');
    p.reviewRounds = [
      {
        reviewDueAt: null,
        reviewsReleasedAt: null,
        decisions: [],
        assignments: [
          assignment('a'),
          assignment('b', 'draft'),
          assignment('c', 'submitted'),
          assignment('d', 'inconsistent'),
        ],
      },
    ];
    const closed = makePaper('closed', 'DECISION_MADE');
    closed.reviewRounds = [
      {
        reviewDueAt: null,
        reviewsReleasedAt: now,
        decisions: [{ outcome: 'ACCEPT' }],
        assignments: [assignment('a', 'draft')],
      },
    ];
    const data = aggregatePaperAnalytics([p, closed], null, 2, now);
    expect(data.reviews).toMatchObject({
      assigned: 5,
      completed: 1,
      submitted: 1,
      notStarted: 1,
      draft: 1,
      closedIncomplete: 1,
      inconsistent: 1,
      overdue: 2,
      underCoveredPapers: 1,
    });
    expect(data.reviews.reviewerLoad).toHaveLength(2);
    expect(data.reviews.reviewerLoad.map((r) => r.id)).toEqual(['a', 'b']);
  });
  it('counts distinct paper IDs even for identical titles, and separates authors with identical names', () => {
    expect(
      topAuthorCounts([
        { name: 'Ada', email: 'ada@example.test', paperId: 'p1', status: 'SUBMITTED' },
        { name: 'ada', email: 'ADA@example.test', paperId: 'p1', status: 'SUBMITTED' },
        { name: 'Ada', email: 'ada@example.test', paperId: 'p2', status: 'SUBMITTED' },
        { name: 'Ada', email: 'other@example.test', paperId: 'p3', status: 'SUBMITTED' },
        { name: 'Ada', email: 'ada@example.test', paperId: 'p4', status: 'DRAFT' },
      ]),
    ).toEqual([
      { name: 'Ada', count: 2 },
      { name: 'Ada', count: 1 },
    ]);
  });
  it('retains every corresponding author while limiting institution rankings', () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      name: `Author ${i}`,
      email: `a${i}@example.test`,
      paperId: `p${i}`,
      status: 'SUBMITTED',
    }));
    expect(topAuthorCounts(rows)).toHaveLength(14);
    expect(topPaperCounts(rows.map((r) => ({ key: r.name, paperId: r.paperId })))).toHaveLength(12);
    expect(
      topPaperCounts([
        { key: 'Institute', paperId: '1' },
        { key: 'institute', paperId: '1' },
        { key: 'Institute', paperId: '2' },
      ]),
    ).toEqual([{ name: 'Institute', count: 2 }]);
  });
  it('separates unpaid, due soon and overdue registrations without counting cancelled/refunded work', () => {
    const rows = [
      'PAID',
      'PENDING',
      'AWAITING_VERIFICATION',
      'ADDITIONAL_PAYMENT_REQUIRED',
      'CANCELLED',
      'REFUNDED',
      'DISCARDED_NONPAYMENT',
    ].map((status, i) => ({
      paperId: `p${i}`,
      status,
      deadlineAt: i === 2 ? new Date('2026-10-11') : new Date('2026-10-01'),
    }));
    expect(aggregateRegistrations(rows, new Set(['p0', 'p4', 'p6']), now)).toMatchObject({
      total: 7,
      paid: 1,
      unpaid: 3,
      atRisk: 1,
      overdue: 2,
      unpaidAccepted: 2,
    });
  });
  it('only adds captured receipts and subtracts real refund records', () => {
    expect(paymentContribution({ kind: 'INITIAL', status: 'CAPTURED', amountMinor: 100 })).toBe(
      100,
    );
    expect(
      paymentContribution({ kind: 'REFUND', status: 'PARTIALLY_REFUNDED', amountMinor: 20 }),
    ).toBe(-20);
    expect(paymentContribution({ kind: 'INITIAL', status: 'REFUNDED', amountMinor: 100 })).toBe(0);
    expect(paymentContribution({ kind: 'REFUND', status: 'CREATED', amountMinor: 20 })).toBe(0);
  });
  it('groups paper creation dates by UTC day', () => {
    expect(
      submissionsByDay([
        new Date('2026-09-02T18:00:00Z'),
        new Date('2026-09-01T01:00:00Z'),
        new Date('2026-09-01T23:00:00Z'),
      ]),
    ).toEqual([
      { date: '2026-09-01', count: 2 },
      { date: '2026-09-02', count: 1 },
    ]);
  });
});

describe('fee-schedule revenue conversion', () => {
  const receipt = (
    currency: string,
    amountMinor: number,
    kind = 'INITIAL',
    status = 'CAPTURED',
    audience = 'REGULAR',
    lockedTiming: string | null = 'EARLY',
  ) => ({ currency, amountMinor, kind, status, registration: { audience, lockedTiming } });
  it('includes USD and INR receipts and refunds using the configured rate and reconciles every breakdown', () => {
    const data = aggregateRevenue(
      [
        receipt('USD', 20000),
        receipt('INR', 832700, 'INITIAL', 'CAPTURED', 'STUDENT', 'REGULAR'),
        receipt('INR', 83270, 'REFUND', 'PARTIALLY_REFUNDED', 'STUDENT', 'REGULAR'),
        receipt('USD', 2500, 'REFUND', 'REFUNDED'),
        receipt('USD', 99999, 'INITIAL', 'FAILED'),
        receipt('USD', 99999, 'REFUND', 'CREATED'),
      ],
      { currency: 'USD', domesticInrPerUsd: 83.27 },
    );
    expect(data.revenueMinor).toBe(26500);
    expect(data.excludedCurrencyPayments).toBe(0);
    expect(data.revenueConversion).toMatchObject({
      capturedMinor: 30000,
      refundedMinor: 3500,
      inrPerUsd: 83.27,
    });
    expect(data.revenueConversion.byCurrency).toEqual([
      {
        currency: 'INR',
        capturedMinor: 832700,
        refundedMinor: 83270,
        netMinor: 749430,
        convertedMinor: 9000,
        paymentCount: 2,
      },
      {
        currency: 'USD',
        capturedMinor: 20000,
        refundedMinor: 2500,
        netMinor: 17500,
        convertedMinor: 17500,
        paymentCount: 2,
      },
    ]);
    expect(data.revenueByTiming.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(
      data.revenueMinor,
    );
    expect(data.revenueByAudience.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(
      data.revenueMinor,
    );
    expect(
      data.revenueConversion.byCurrency.reduce((sum, row) => sum + (row.convertedMinor ?? 0), 0),
    ).toBe(data.revenueMinor);
  });
  it('supports reporting in INR without changing native receipts', () => {
    const data = aggregateRevenue([receipt('USD', 10000), receipt('INR', 100)], {
      currency: 'INR',
      domesticInrPerUsd: 83.27,
    });
    expect(data.revenueMinor).toBe(832800);
    expect(data.revenueConversion.capturedMinor).toBe(832800);
  });
  it('rounds each ledger amount once and reverses half-unit refunds symmetrically', () => {
    const payments = [receipt('USD', 100), receipt('USD', 100, 'REFUND', 'REFUNDED')];
    const data = aggregateRevenue(payments, { currency: 'INR', domesticInrPerUsd: 1.005 });
    expect(data.revenueConversion).toMatchObject({ capturedMinor: 101, refundedMinor: 101 });
    expect(data.revenueMinor).toBe(0);
    const inverse = aggregateRevenue([receipt('INR', 1), receipt('INR', 1, 'REFUND', 'REFUNDED')], {
      currency: 'USD',
      domesticInrPerUsd: 2,
    });
    expect(inverse.revenueConversion).toMatchObject({ capturedMinor: 1, refundedMinor: 1 });
    expect(inverse.revenueMinor).toBe(0);
  });
  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1001])(
    'retains original foreign amounts when the rate is invalid: %s',
    (rate) => {
      const data = aggregateRevenue(
        [receipt('USD', 100), receipt('INR', 100), receipt('EUR', 100)],
        { currency: 'USD', domesticInrPerUsd: rate },
      );
      expect(data.revenueMinor).toBe(100);
      expect(data.excludedCurrencyPayments).toBe(2);
      expect(data.revenueConversion.inrPerUsd).toBeNull();
      expect(
        data.revenueConversion.byCurrency
          .filter((row) => row.currency !== 'USD')
          .every((row) => row.capturedMinor === 100 && row.convertedMinor === null),
      ).toBe(true);
    },
  );
  it('keeps unsupported currencies visible even when USD/INR conversion is configured', () => {
    const data = aggregateRevenue([receipt('EUR', 500, 'REFUND', 'REFUNDED')], {
      currency: 'USD',
      domesticInrPerUsd: 83.27,
    });
    expect(data.revenueMinor).toBe(0);
    expect(data.excludedCurrencyPayments).toBe(1);
    expect(data.revenueConversion.byCurrency[0]).toMatchObject({
      currency: 'EUR',
      refundedMinor: 500,
      netMinor: -500,
      convertedMinor: null,
    });
  });
});

describe('selectable reporting currencies', () => {
  it('builds each currency from the original ledger, avoiding a rounded conversion round trip', () => {
    const data = aggregateRevenueReports(
      [
        {
          currency: 'INR',
          amountMinor: 1,
          status: 'CAPTURED',
          kind: 'INITIAL',
          registration: { audience: 'REGULAR', lockedTiming: 'EARLY' },
        },
      ],
      { currency: 'USD', domesticInrPerUsd: 2 },
    );
    expect(data.currencyReports.map((report) => [report.currency, report.revenueMinor])).toEqual([
      ['USD', 1],
      ['INR', 1],
    ]);
    for (const report of data.currencyReports) {
      expect(report.revenueByTiming.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(
        report.revenueMinor,
      );
    }
  });
  it('only offers the native report when there is no applicable rate', () => {
    expect(
      aggregateRevenueReports([], { currency: 'USD' }).currencyReports.map(
        (report) => report.currency,
      ),
    ).toEqual(['USD']);
    expect(
      aggregateRevenueReports([], {
        currency: 'EUR',
        domesticInrPerUsd: 83.27,
      }).currencyReports.map((report) => report.currency),
    ).toEqual(['EUR']);
  });
});
