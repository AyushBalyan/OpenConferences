import { describe, expect, it } from 'vitest';
import {
  aggregatePaperAnalytics,
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
