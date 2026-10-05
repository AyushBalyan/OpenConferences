import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewCoordinationService } from './coordination.service';

const mocks = vi.hoisted(() => ({
  assignment: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  papers: vi.fn(),
  decision: vi.fn(),
  newer: vi.fn(),
  member: vi.fn(),
  bid: vi.fn(),
  existing: vi.fn(),
  audit: vi.fn(),
  lock: vi.fn(),
  invitationCount: vi.fn(),
  coi: vi.fn(),
  remind: vi.fn(),
  notify: vi.fn(),
  loadConference: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'new-assignment',
  withTenantContext: (_ctx: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: mocks.lock,
      reviewerAssignment: {
        findFirst: mocks.assignment,
        update: mocks.update,
        create: mocks.create,
      },
      paper: { findMany: mocks.papers },
      decision: { findFirst: mocks.decision },
      reviewRound: { findFirst: mocks.newer },
      membership: { findFirst: mocks.member },
      bid: { findUnique: mocks.bid },
      auditLog: { create: mocks.audit },
      reviewerInvitation: { count: mocks.invitationCount },
    }),
}));
const now = new Date('2026-10-06T10:00:00Z');
function assignment(overrides = {}) {
  return {
    id: 'assignment',
    roundId: 'round',
    paperId: 'paper',
    conferenceId: 'conf',
    organizationId: 'org',
    reviewerUserId: 'reviewer',
    status: 'ASSIGNED',
    version: 2,
    createdAt: now,
    updatedAt: now,
    dueAt: new Date('2026-10-09T10:00:00Z'),
    review: null,
    reviewer: { name: 'Reviewer', email: 'reviewer@example.org' },
    paper: { title: 'Paper', status: 'UNDER_REVIEW' },
    round: {
      roundNumber: 2,
      reviewDueAt: new Date('2026-10-08T10:00:00Z'),
      reviewsReleasedAt: null,
    },
    ...overrides,
  };
}
function service() {
  return new ReviewCoordinationService(
    { loadConference: mocks.loadConference } as never,
    { checkReviewerPaperConflict: mocks.coi } as never,
    { publishReviewReminder: mocks.remind, publishReviewerAssigned: mocks.notify } as never,
  );
}
const replace = {
  action: 'REPLACE' as const,
  version: 2,
  reason: 'Reviewer unavailable',
  reviewerUserId: 'replacement',
};
function intervene(input = replace, roles = ['CHAIR']) {
  return service().intervene('chair', 'conf', 'assignment', input, roles as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mocks.loadConference.mockResolvedValue({
    organizationId: 'org',
    name: 'Conference',
    reviewConfig: { minimumReviews: 2 },
    reviewDueAt: new Date('2026-10-07T10:00:00Z'),
  });
  mocks.lock.mockResolvedValue([{ id: 'round', paperId: 'paper' }]);
  mocks.assignment.mockImplementation(async (args) => {
    if (args.select) return { roundId: 'round' };
    if (args.where.reviewerUserId) return null;
    return assignment();
  });
  mocks.member.mockResolvedValue({
    user: { name: 'Replacement', email: 'replacement@example.org' },
  });
  mocks.coi.mockResolvedValue({ hasConflict: false });
  mocks.create.mockResolvedValue({ id: 'new-assignment' });
  mocks.remind.mockResolvedValue(true);
  mocks.invitationCount.mockResolvedValue(3);
});

describe('chair review interventions', () => {
  it('rejects reviewer and author roles before reading conference data', async () => {
    await expect(intervene(replace, ['REVIEWER', 'AUTHOR'])).rejects.toMatchObject({ status: 403 });
    expect(mocks.loadConference).not.toHaveBeenCalled();
  });
  it('scopes the assignment lookup to the conference', async () => {
    mocks.assignment.mockResolvedValue(null);
    await expect(intervene()).rejects.toMatchObject({ status: 404 });
    expect(mocks.assignment).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'assignment', conferenceId: 'conf' } }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects a stale version without replacing or notifying', async () => {
    await expect(intervene({ ...replace, version: 1 })).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'COMPLETED' },
    { status: 'REPLACED' },
    { status: 'DECLINED' },
    { review: { submittedAt: now } },
    { paper: { title: 'Paper', status: 'WITHDRAWN' } },
  ])('preserves submitted, retired and withdrawn assignment records: %j', async (overrides) => {
    mocks.assignment.mockImplementation(async (args) =>
      args.select ? { roundId: 'round' } : assignment(overrides),
    );
    await expect(intervene()).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(['decision', 'newer', 'released'])(
    'blocks changes to a closed/historical cycle: %s',
    async (kind) => {
      if (kind === 'decision') mocks.decision.mockResolvedValue({ id: 'decision' });
      if (kind === 'newer') mocks.newer.mockResolvedValue({ id: 'newer-cycle' });
      if (kind === 'released')
        mocks.assignment.mockImplementation(async (args) =>
          args.select
            ? { roundId: 'round' }
            : assignment({ round: { roundNumber: 2, reviewsReleasedAt: now } }),
        );
      await expect(intervene()).rejects.toMatchObject({ status: 409 });
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it.each(['coi', 'bid', 'membership', 'duplicate'])(
    'validates a replacement before retiring the old reviewer: %s',
    async (kind) => {
      if (kind === 'coi') mocks.coi.mockResolvedValue({ hasConflict: true, reason: 'AUTHORSHIP' });
      if (kind === 'bid') mocks.bid.mockResolvedValue({ value: 'CONFLICT' });
      if (kind === 'membership') mocks.member.mockResolvedValue(null);
      if (kind === 'duplicate')
        mocks.assignment.mockImplementation(async (args) =>
          args.select ? { roundId: 'round' } : assignment(),
        );
      await expect(intervene()).rejects.toMatchObject({
        status: kind === 'membership' ? 404 : 409,
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it('preserves the old draft and audits replacement identities in the mutation transaction', async () => {
    mocks.assignment.mockImplementation(async (args) =>
      args.select
        ? { roundId: 'round' }
        : args.where.reviewerUserId
          ? null
          : assignment({ review: { submittedAt: null } }),
    );
    const result = await intervene();
    expect(result.assignmentId).toBe('new-assignment');
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'assignment' },
      data: { status: 'REPLACED', version: { increment: 1 } },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewerUserId: 'replacement',
          dueAt: new Date('2026-10-09T10:00:00Z'),
        }),
      }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'reviewer.replaced',
          diff: expect.objectContaining({
            replacementAssignmentId: 'new-assignment',
            reason: replace.reason,
          }),
        }),
      }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'replacement@example.org' }),
    );
  });
  it('reports a committed replacement even if assignment email fails', async () => {
    mocks.notify.mockRejectedValue(new Error('Queue unavailable'));
    expect(await intervene()).toMatchObject({
      assignmentId: 'new-assignment',
      notificationWarning: expect.stringContaining('could not be queued'),
    });
  });
  it('extends past conference/cycle defaults and records the effective previous deadline', async () => {
    const result = await service().intervene(
      'chair',
      'conf',
      'assignment',
      {
        action: 'EXTEND',
        version: 2,
        reason: 'Extension requested',
        dueAt: '2026-10-12T10:00:00Z',
      },
      ['ORGANIZER'],
    );
    expect(result.message).toContain('extended');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dueAt: new Date('2026-10-12T10:00:00Z'), version: { increment: 1 } },
      }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diff: {
            from: '2026-10-09T10:00:00.000Z',
            to: '2026-10-12T10:00:00.000Z',
            reason: 'Extension requested',
          },
        }),
      }),
    );
  });
  it.each(['2026-10-05T10:00:00Z', '2026-10-09T10:00:00Z', 'not-a-date'])(
    'rejects a non-extension deadline %s',
    async (dueAt) => {
      await expect(
        service().intervene(
          'chair',
          'conf',
          'assignment',
          { action: 'EXTEND', version: 2, reason: 'Extend', dueAt },
          ['CHAIR'],
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it('queues a reminder with the extended deadline and a stable daily deduplication key', async () => {
    await service().intervene('chair', 'conf', 'assignment', { action: 'REMIND', version: 2 }, [
      'CHAIR',
    ]);
    expect(mocks.remind).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt: '2026-10-09T10:00:00.000Z',
        idempotencyKey: 'chair-review-reminder-assignment-2-2026-10-06',
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('does not claim a suppressed reminder was queued', async () => {
    mocks.remind.mockResolvedValue(false);
    await expect(
      service().intervene('chair', 'conf', 'assignment', { action: 'REMIND', version: 2 }, [
        'CHAIR',
      ]),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe('conference coordination snapshot', () => {
  it('keeps historical cycles and retired records visible without counting them in current queues', async () => {
    const base = assignment();
    mocks.papers.mockResolvedValue([
      {
        id: 'paper',
        title: 'Paper',
        status: 'UNDER_REVIEW',
        version: 1,
        trackId: 'track',
        track: { name: 'Systems' },
        submissionNumber: 'SYS-1',
        reviewRounds: [
          {
            id: 'round',
            version: 0,
            roundNumber: 2,
            reviewDueAt: null,
            reviewsReleasedAt: null,
            decisions: [],
            assignments: [
              { ...base, dueAt: new Date('2026-10-05'), review: null },
              { ...base, id: 'retired', status: 'REPLACED', review: { submittedAt: null } },
            ],
          },
          {
            id: 'old-round',
            version: 0,
            roundNumber: 1,
            reviewDueAt: null,
            reviewsReleasedAt: now,
            decisions: [{ outcome: 'MINOR_REVISION' }],
            assignments: [
              { ...base, id: 'old', dueAt: new Date('2026-10-01'), review: { submittedAt: now } },
            ],
          },
        ],
      },
      {
        id: 'unassigned',
        title: 'Unassigned',
        status: 'SUBMITTED',
        version: 1,
        trackId: 'track',
        track: { name: 'Systems' },
        submissionNumber: 'SYS-2',
        reviewRounds: [],
      },
    ]);
    const result = await service().snapshot('chair', 'conf', ['CHAIR']);
    expect(result.data).toHaveLength(3);
    expect(result.summary).toEqual({
      needsReviewers: 2,
      overdueReviews: 1,
      overduePapers: 1,
      readyForDecision: 0,
      pendingInvitations: null,
    });
    expect(result.data[0]).toMatchObject({
      assignmentCount: 1,
      submittedReviewCount: 0,
      isCurrentCycle: true,
    });
    expect(result.data[0]?.assignments).toHaveLength(2);
    expect(result.data[1]).toMatchObject({
      isCurrentCycle: false,
      canIntervene: false,
      reviewStage: 'REVISION_REQUESTED',
    });
    expect(mocks.invitationCount).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('commentsToAuthors');
  });
  it('uses only current submitted reviews for decision readiness and excludes decided cycles', async () => {
    const ready = {
      id: 'ready',
      title: 'Ready',
      status: 'UNDER_REVIEW',
      version: 1,
      trackId: 'track',
      track: { name: 'AI' },
      submissionNumber: 'AI-1',
      reviewRounds: [
        {
          id: 'cycle',
          version: 0,
          roundNumber: 1,
          reviewDueAt: null,
          reviewsReleasedAt: null,
          decisions: [],
          assignments: [
            assignment({ review: { submittedAt: now } }),
            assignment({
              id: 'second',
              reviewerUserId: 'other',
              status: 'COMPLETED',
              review: { submittedAt: now },
            }),
          ],
        },
      ],
    };
    mocks.papers.mockResolvedValue([
      ready,
      {
        ...ready,
        id: 'decided',
        status: 'DECISION_MADE',
        reviewRounds: [{ ...ready.reviewRounds[0], decisions: [{ outcome: 'ACCEPT' }] }],
      },
    ]);
    const result = await service().snapshot('organizer', 'conf', ['ORGANIZER']);
    expect(result.summary).toMatchObject({
      readyForDecision: 1,
      needsReviewers: 0,
      overdueReviews: 0,
      pendingInvitations: 3,
    });
  });
});
