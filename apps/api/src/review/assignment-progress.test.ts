import { reviewerAssignmentDueAt } from '@openconferences/schemas';
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
  it('distinguishes unstarted, draft and submitted reviews and caps due dates at the conference review deadline', async () => {
    const assignedAt = new Date('2026-09-22T12:00:00Z');
    const conferenceDue = new Date('2026-09-25T12:00:00Z');
    assignments.mockResolvedValue(
      [null, { submittedAt: null }, { submittedAt: assignedAt }].map((review, index) => ({
        id: `assignment-${index}`,
        organizationId: 'org',
        conferenceId: 'conf',
        roundId: 'round',
        paperId: 'paper',
        reviewerUserId: 'reviewer',
        status: 'ASSIGNED',
        dueAt: index === 2 ? assignedAt : null,
        version: 0,
        createdAt: assignedAt,
        updatedAt: assignedAt,
        review,
        paper: { title: 'Paper' },
        reviewer: { name: 'Reviewer', email: 'reviewer@example.com' },
      })),
    );
    const service = new AssignmentsService(
      {
        loadConference: async () => ({ organizationId: 'org', reviewDueAt: conferenceDue }),
      } as never,
      { loadRound: async () => ({ reviewDueAt: new Date('2026-10-01T12:00:00Z') }) } as never,
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
    const expectedDue = reviewerAssignmentDueAt(assignedAt, conferenceDue).toISOString();
    expect(result.data.map((item) => item.dueAt)).toEqual([expectedDue, expectedDue, expectedDue]);
  });
});
