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
  it.each(['2020-01-01T00:00:00Z', 'invalid'])(
    'rejects a past or invalid individual deadline before creating a cycle: %s',
    async (dueAt) => {
      const loadConference = vi.fn();
      const ensureOpenCycle = vi.fn();
      const service = new AssignmentsService(
        { loadConference } as never,
        { ensureOpenCycle } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        service.assign('chair', 'conf', 'paper', { reviewerUserId: 'reviewer', dueAt }, ['CHAIR']),
      ).rejects.toMatchObject({ status: 400 });
      expect(loadConference).not.toHaveBeenCalled();
      expect(ensureOpenCycle).not.toHaveBeenCalled();
    },
  );
  it('distinguishes unstarted, draft and submitted reviews and honors persisted deadlines', async () => {
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
    expect(result.data.map((item) => item.dueAt)).toEqual([
      '2026-09-29T12:00:00.000Z',
      '2026-09-29T12:00:00.000Z',
      assignedAt.toISOString(),
    ]);
  });
});
