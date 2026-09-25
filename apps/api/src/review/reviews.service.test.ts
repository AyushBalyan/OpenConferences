import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReviewsService } from './reviews.service';

const {
  assignmentLookup,
  paperLookup,
  reviewLookup,
  updateReview,
  createReview,
  readReview,
  updateAssignment,
  lockRound,
  transitionRound,
  decisionLookup,
} = vi.hoisted(() => ({
  assignmentLookup: vi.fn(),
  paperLookup: vi.fn(),
  reviewLookup: vi.fn(),
  updateReview: vi.fn(),
  createReview: vi.fn(),
  readReview: vi.fn(),
  updateAssignment: vi.fn(),
  lockRound: vi.fn(),
  transitionRound: vi.fn(),
  decisionLookup: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'test-id',
  Prisma: { DbNull: 'DbNull' },
  withTenantContext: (_context: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: lockRound,
      reviewRound: {
        updateMany: transitionRound,
        findUniqueOrThrow: async () => ({
          id: 'round',
          reviewsReleasedAt: new Date(),
          decisions: [],
        }),
      },
      decision: { findFirst: decisionLookup },
      reviewerAssignment: { findFirst: assignmentLookup, update: updateAssignment },
      paper: { findFirst: paperLookup },
      review: {
        findMany: reviewLookup,
        updateMany: updateReview,
        createMany: createReview,
        findUniqueOrThrow: readReview,
      },
    }),
}));

const assignment = {
  id: 'assignment',
  organizationId: 'org',
  conferenceId: 'conf',
  reviewerUserId: 'reviewer',
  paperId: 'paper',
  roundId: 'round',
  createdAt: new Date(),
  updatedAt: new Date(),
  review: null,
  paper: { title: 'Test paper', currentVersionId: null },
};

function service(_status: string) {
  return new ReviewsService(
    {
      loadConference: vi.fn().mockResolvedValue({ organizationId: 'org', reviewConfig: {} }),
    } as never,
    {
      loadRound: vi
        .fn()
        .mockResolvedValue({ paperId: 'paper', version: 1, reviewsReleasedAt: null }),
    } as never,
    { checkReviewerPaperConflict: vi.fn().mockResolvedValue({ hasConflict: false }) } as never,
    { log: vi.fn() } as never,
    {} as never,
  );
}

describe('review phase capabilities', () => {
  it('does not expose hidden reviews to a chair who authored the paper', async () => {
    paperLookup.mockResolvedValue({
      conferenceId: 'conf',
      submittedById: 'chair',
      authorships: [],
    });
    reviewLookup.mockResolvedValue([]);
    await service('REVIEWING').listReviewsForPaper('chair', 'conf', 'paper', ['CHAIR', 'AUTHOR']);
    expect(reviewLookup).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ visibility: 'AUTHOR_VISIBLE' }) }),
    );
  });
  beforeEach(() => {
    vi.clearAllMocks();
    lockRound.mockResolvedValue([
      { id: 'round', paperId: 'paper', version: 1, reviewsReleasedAt: null, rebuttalDueAt: null },
    ]);
    decisionLookup.mockResolvedValue(null);
    assignmentLookup.mockResolvedValue(assignment);
  });

  it('rejects saving when a decision lands after the initial lookup', async () => {
    decisionLookup.mockResolvedValue({ id: 'decision' });
    await expect(
      service('REVIEWING').saveReview(
        'reviewer',
        'conf',
        'assignment',
        { scores: {}, version: 0 },
        ['REVIEWER'],
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REVIEW_PHASE_LOCKED' }) });
    expect(createReview).not.toHaveBeenCalled();
    expect(updateReview).not.toHaveBeenCalled();
  });

  it('rejects stale release before publishing reviews', async () => {
    reviewLookup.mockResolvedValue([
      { id: 'review', paperId: 'paper', paper: { title: 'Paper', authorships: [] } },
    ]);
    transitionRound.mockResolvedValue({ count: 0 });
    await expect(
      service('REVIEWING').releaseReviews('chair', 'conf', 'paper', 'round', { version: 1 }, [
        'CHAIR',
      ]),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateReview).not.toHaveBeenCalled();
  });

  it('stores edits after submit without changing the review chairs already see', async () => {
    assignmentLookup.mockResolvedValue({
      ...assignment,
      review: {
        id: 'review',
        version: 2,
        submittedAt: new Date('2026-09-01T00:00:00.000Z'),
        recommendation: 'REJECT',
        commentsToAuthors: 'Original',
        commentsToChairs: null,
        confidence: 3,
        scores: { originality: 2 },
        pendingEdit: null,
        visibility: 'HIDDEN',
        organizationId: 'org',
        conferenceId: 'conf',
        assignmentId: 'assignment',
        roundId: 'round',
        paperId: 'paper',
        reviewerUserId: 'reviewer',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    updateReview.mockResolvedValue({ count: 1 });
    readReview.mockResolvedValue({
      id: 'review',
      version: 3,
      submittedAt: new Date('2026-09-01T00:00:00.000Z'),
      recommendation: 'REJECT',
      commentsToAuthors: 'Original',
      commentsToChairs: null,
      confidence: 3,
      scores: { originality: 2 },
      pendingEdit: { commentsToAuthors: 'Changed' },
      visibility: 'HIDDEN',
      organizationId: 'org',
      conferenceId: 'conf',
      assignmentId: 'assignment',
      roundId: 'round',
      paperId: 'paper',
      reviewerUserId: 'reviewer',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await service('REVIEWING').saveReview(
      'reviewer',
      'conf',
      'assignment',
      {
        scores: { originality: 5 },
        recommendation: 'ACCEPT',
        commentsToAuthors: 'Changed',
        version: 2,
      },
      ['REVIEWER'],
    );

    const data = updateReview.mock.calls.at(-1)?.[0].data;
    expect(data.pendingEdit).toMatchObject({
      commentsToAuthors: 'Changed',
      recommendation: 'ACCEPT',
    });
    expect(data.commentsToAuthors).toBeUndefined();
    expect(saved.hasPendingEdit).toBe(true);
    expect(saved.commentsToAuthors).toBe('Changed');
  });

  it.each(['save', 'submit'])(
    'rejects a concurrent %s without completing the assignment',
    async (operation) => {
      assignmentLookup.mockResolvedValue({
        ...assignment,
        review: {
          id: 'review',
          version: 1,
          submittedAt: null,
          recommendation: 'ACCEPT',
          commentsToAuthors: 'Feedback',
          scores: {},
        },
      });
      updateReview.mockResolvedValue({ count: 0 });
      const reviews = service('REVIEWING');
      const request =
        operation === 'save'
          ? reviews.saveReview('reviewer', 'conf', 'assignment', { scores: {}, version: 1 }, [
              'REVIEWER',
            ])
          : reviews.submitReview('reviewer', 'conf', 'assignment', { version: 1 }, ['REVIEWER']);
      await expect(request).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REVIEW_VERSION_CONFLICT' }),
      });
      expect(updateReview).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review', conferenceId: 'conf', reviewerUserId: 'reviewer', version: 1 },
        }),
      );
      expect(updateAssignment).not.toHaveBeenCalled();
      expect(readReview).not.toHaveBeenCalled();
    },
  );

  it('reports simultaneous first saves as a version conflict', async () => {
    createReview.mockResolvedValue({ count: 0 });
    await expect(
      service('REVIEWING').saveReview(
        'reviewer',
        'conf',
        'assignment',
        { scores: {}, version: 0 },
        ['REVIEWER'],
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_VERSION_CONFLICT' }),
    });
    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it.each(['create', 'save', 'submit'])(
    'returns the persisted version after a successful %s',
    async (operation) => {
      const persisted = {
        id: 'review',
        version: 2,
        submittedAt: null,
        recommendation: 'ACCEPT',
        commentsToAuthors: 'Feedback',
        scores: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (operation !== 'create') {
        assignmentLookup.mockResolvedValue({ ...assignment, review: { ...persisted, version: 1 } });
      }
      updateReview.mockResolvedValue({ count: 1 });
      createReview.mockResolvedValue({ count: 1 });
      readReview.mockResolvedValue(persisted);
      const reviews = service('REVIEWING');
      if (operation === 'submit') {
        const result = await reviews.submitReview(
          'reviewer',
          'conf',
          'assignment',
          { version: 1 },
          ['REVIEWER'],
        );
        expect(result.review.version).toBe(2);
        expect(updateAssignment).toHaveBeenCalledWith({
          where: { id: 'assignment' },
          data: { status: 'COMPLETED' },
        });
      } else {
        const result = await reviews.saveReview(
          'reviewer',
          'conf',
          'assignment',
          { scores: {}, version: operation === 'create' ? 0 : 1 },
          ['REVIEWER'],
        );
        expect(result.version).toBe(2);
      }
    },
  );

  it('keeps declined assignments read-only and rejects writes', async () => {
    assignmentLookup.mockResolvedValue({ ...assignment, status: 'DECLINED' });
    const reviews = service('REVIEWING');
    expect((await reviews.getReview('reviewer', 'conf', 'assignment', ['REVIEWER'])).canEdit).toBe(
      false,
    );
    await expect(
      reviews.saveReview('reviewer', 'conf', 'assignment', { scores: {}, version: 0 }, [
        'REVIEWER',
      ]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      reviews.submitReview('reviewer', 'conf', 'assignment', { version: 0 }, ['REVIEWER']),
    ).rejects.toMatchObject({ status: 403 });
  });

  it.each(['save', 'submit'])(
    'does not let a chair %s another reviewer’s work',
    async (operation) => {
      const reviews = service('REVIEWING');
      const request =
        operation === 'save'
          ? reviews.saveReview('chair', 'conf', 'assignment', { scores: {}, version: 0 }, ['CHAIR'])
          : reviews.submitReview('chair', 'conf', 'assignment', { version: 0 }, ['CHAIR']);
      await expect(request).rejects.toMatchObject({ status: 403 });
      expect(updateReview).not.toHaveBeenCalled();
      expect(createReview).not.toHaveBeenCalled();
    },
  );

  it('permits draft editing until the cycle has a decision', async () => {
    expect(
      (await service('IN_REVIEW').getReview('reviewer', 'conf', 'assignment', ['REVIEWER']))
        .canEdit,
    ).toBe(true);
  });

  it('shows a privileged reader another reviewer’s draft as read-only', async () => {
    expect(
      (await service('REVIEWING').getReview('chair', 'conf', 'assignment', ['CHAIR'])).canEdit,
    ).toBe(false);
  });
});
