import { describe, it, expect } from 'vitest';
import {
  aggregateReviewerWorkload,
  reviewerDigestPreviewInputSchema,
  type ReviewerWorkAssignment,
} from './reviewer-overview.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (
  state: ReviewerWorkAssignment['workState'],
  n = 1,
  patch: Partial<ReviewerWorkAssignment> = {},
): ReviewerWorkAssignment => ({
  id: id(n),
  organizationId: id(100),
  conferenceId: id(100),
  paperId: id(n + 100),
  roundId: id(200),
  reviewerUserId: id(300),
  reviewerName: 'Reviewer',
  reviewerEmail: 'r@example.test',
  status: 'ASSIGNED',
  version: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  dueAt: '2026-10-10T00:00:00.000Z',
  reviewProgress: state === 'SUBMITTED' ? 'SUBMITTED' : state === 'DRAFT' ? 'DRAFT' : 'NOT_STARTED',
  overdue: false,
  paperTitle: 'Paper',
  submissionNumber: null,
  trackId: id(100),
  trackName: 'Track',
  roundNumber: 1,
  isCurrentCycle: true,
  paperStatus: 'UNDER_REVIEW',
  canIntervene: ['NOT_STARTED', 'DRAFT'].includes(state),
  workState: state,
  dueSoon: false,
  ...patch,
});
describe('reviewer workload accounting', () => {
  it('includes zero-assignment reviewers and counts submitted, closed and retired separately', () => {
    const rows = aggregateReviewerWorkload(
      [
        { userId: id(300), name: 'Reviewer', email: 'r@example.test' },
        { userId: id(301), name: 'Zero', email: 'z@example.test' },
      ],
      [
        item('SUBMITTED'),
        item('DRAFT', 2, { overdue: true }),
        item('NOT_STARTED', 3, { dueSoon: true }),
        item('CLOSED', 4),
        item('RETIRED', 5),
      ],
    );
    expect(rows[0]).toMatchObject({
      assigned: 4,
      submitted: 1,
      remaining: 2,
      drafts: 1,
      notStarted: 1,
      closedIncomplete: 1,
      overdue: 1,
      dueSoon: 1,
      allSubmitted: false,
    });
    expect(rows[0]!.assignments).toHaveLength(5);
    expect(rows[1]).toMatchObject({ assigned: 0, allSubmitted: false, hasReviewerRole: true });
  });
  it('keeps work whose reviewer role was removed and flags inconsistent completion', () => {
    const rows = aggregateReviewerWorkload([], [item('DRAFT'), item('INCONSISTENT', 2)]);
    expect(rows[0]).toMatchObject({
      hasReviewerRole: false,
      remaining: 1,
      inconsistent: true,
      allSubmitted: false,
    });
  });
  it('keeps a submitted review submitted even if the assignment is active', () => {
    const [row] = aggregateReviewerWorkload([], [item('SUBMITTED')]);
    expect(row).toMatchObject({
      assigned: 1,
      submitted: 1,
      remaining: 0,
      allSubmitted: true,
      earliestDeadline: null,
    });
  });
  it('rejects duplicate, empty and over-limit digest targets', () => {
    const target = { id: id(1), version: 0 };
    expect(
      reviewerDigestPreviewInputSchema.safeParse({ assignments: [target, target] }).success,
    ).toBe(false);
    expect(reviewerDigestPreviewInputSchema.safeParse({ assignments: [] }).success).toBe(false);
    expect(
      reviewerDigestPreviewInputSchema.safeParse({
        assignments: Array.from({ length: 101 }, (_, i) => ({ id: id(i), version: 0 })),
      }).success,
    ).toBe(false);
  });
  it('aggregates a 1,000 reviewer / 10,000 assignment fixture without truncation', () => {
    const roster = Array.from({ length: 1000 }, (_, n) => ({
      userId: id(n + 30000),
      name: `Reviewer ${n}`,
      email: `r${n}@example.test`,
    }));
    const assignments = Array.from({ length: 10000 }, (_, n) =>
      item(n % 3 === 0 ? 'SUBMITTED' : 'DRAFT', n, { reviewerUserId: roster[n % 1000]!.userId }),
    );
    const start = performance.now();
    const rows = aggregateReviewerWorkload(roster, assignments);
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(1000);
    expect(rows.reduce((n, r) => n + r.assigned, 0)).toBe(10000);
    console.info(
      `reviewer aggregation: ${elapsed.toFixed(1)}ms; ${JSON.stringify(rows).length} JSON characters`,
    );
  });
});
