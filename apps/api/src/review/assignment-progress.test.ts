import { describe, expect, it, vi } from 'vitest';
import { AssignmentsService } from './assignments.service';

const { assignments } = vi.hoisted(() => ({ assignments: vi.fn() }));
vi.mock('@openconferences/db', () => ({
  withTenantContext: (_: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      reviewerAssignment: { findMany: assignments },
      bid: { findMany: async () => [] },
    }),
}));

describe('chair assignment progress', () => {
  it('distinguishes unstarted, draft and submitted reviews and applies the round deadline fallback', async () => {
    const now = new Date('2026-09-22T12:00:00Z');
    assignments.mockResolvedValue(
      [null, { submittedAt: null }, { submittedAt: now }].map((review, index) => ({
        id: `assignment-${index}`,
        organizationId: 'org',
        conferenceId: 'conf',
        roundId: 'round',
        paperId: 'paper',
        reviewerUserId: 'reviewer',
        status: 'ASSIGNED',
        dueAt: index === 2 ? now : null,
        version: 0,
        createdAt: now,
        updatedAt: now,
        review,
        paper: { title: 'Paper' },
        reviewer: { name: 'Reviewer', email: 'reviewer@example.com' },
      })),
    );
    const due = new Date('2026-10-01T12:00:00Z');
    const service = new AssignmentsService(
      { loadConference: async () => ({ organizationId: 'org' }) } as never,
      { loadRound: async () => ({ reviewDueAt: due }) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.list('chair', 'conf', 'round', ['CHAIR']);
    expect(result.data.map((item) => item.reviewProgress)).toEqual([
      'NOT_STARTED',
      'DRAFT',
      'SUBMITTED',
    ]);
    expect(result.data.map((item) => item.dueAt)).toEqual([
      due.toISOString(),
      due.toISOString(),
      now.toISOString(),
    ]);
  });
});
