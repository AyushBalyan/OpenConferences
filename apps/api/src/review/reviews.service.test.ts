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
  readRound,
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
  readRound: vi.fn(),
}));
vi.mock('@openconferences/db', () => ({
  generateId: () => 'test-id',
  Prisma: { DbNull: 'DbNull' },
  withTenantContext: (_context: unknown, callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: lockRound,
      reviewRound: {
        findFirst: async () => ({ reviewsReleasedAt: new Date(), decisions: [] }),
        updateMany: transitionRound,
        findUniqueOrThrow: readRound,
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
  paper: { title: 'Test paper', currentVersionId: null, submissionNumber: 'TEST-K7Q4' },
  reviewer: { email: 'reviewer@example.edu', name: 'Ada Lovelace' },
};

const publishReviewThankYou = vi.fn();
const publishReviewReleased = vi.fn();

function service(_status: string, blindingMode = 'DOUBLE') {
  return new ReviewsService(
    {
      loadConference: vi.fn().mockResolvedValue({
        organizationId: 'org',
        name: 'Test Conference',
        reviewConfig: {},
        blindingMode,
      }),
    } as never,
    {
      loadRound: vi
        .fn()
        .mockResolvedValue({ paperId: 'paper', version: 1, reviewsReleasedAt: null }),
    } as never,
    { checkReviewerPaperConflict: vi.fn().mockResolvedValue({ hasConflict: false }) } as never,
    { log: vi.fn() } as never,
    { publishReviewThankYou, publishReviewReleased } as never,
  );
}

describe('review phase capabilities', () => {
  const releasedReview = {
    id: 'review',
    organizationId: 'org',
    conferenceId: 'conf',
    assignmentId: 'assignment',
    paperId: 'paper',
    roundId: 'round',
    reviewerUserId: 'reviewer',
    scores: { originality: 4 },
    recommendation: 'ACCEPT',
    confidence: 4,
    commentsToAuthors: 'Useful feedback',
    commentsToChairs: 'Private feedback',
    visibility: 'AUTHOR_VISIBLE',
    submittedAt: new Date(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    round: { roundNumber: 1 },
    reviewer: { name: 'Ada Reviewer', email: 'ada@example.test' },
  };
  describe.each(['SINGLE', 'DOUBLE', 'OPEN'])('%s reviewer identity', (mode) => {
    it.each(['CHAIR', 'ORGANIZER', 'PLATFORM_ADMIN'] as const)(
      'exposes identity to a non-author %s',
      async (role) => {
        paperLookup.mockResolvedValue({
          conferenceId: 'conf',
          submittedById: 'author',
          authorships: [],
        });
        reviewLookup.mockResolvedValue([releasedReview]);
        const result = await service('REVIEWING', mode).listReviewsForPaper(
          'committee',
          'conf',
          'paper',
          [role],
        );
        expect(result.data[0]).toMatchObject({
          reviewerName: 'Ada Reviewer',
          reviewerEmail: 'ada@example.test',
        });
      },
    );
    it.each(['AUTHOR', 'CHAIR', 'ORGANIZER', 'PLATFORM_ADMIN'] as const)(
      'anonymizes the paper author with role %s',
      async (role) => {
        paperLookup.mockResolvedValue({
          conferenceId: 'conf',
          submittedById: 'author',
          authorships: [],
        });
        reviewLookup.mockResolvedValue([releasedReview]);
        const result = await service('REVIEWING', mode).listReviewsForPaper(
          'author',
          'conf',
          'paper',
          [role],
        );
        expect(result.data[0]?.reviewerUserId).toBeUndefined();
        expect(result.data[0]?.reviewerName).toBeUndefined();
        expect(result.data[0]?.reviewerEmail).toBeUndefined();
        expect(result.data[0]?.commentsToChairs).toBeUndefined();
        expect(reviewLookup).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ visibility: 'AUTHOR_VISIBLE' }),
            include: { round: { select: { roundNumber: true } } },
          }),
        );
      },
    );
    it('treats a chair who is a coauthor as an author', async () => {
      paperLookup.mockResolvedValue({
        conferenceId: 'conf',
        submittedById: 'someone',
        authorships: [{ userId: 'coauthor' }],
      });
      reviewLookup.mockResolvedValue([releasedReview]);
      const result = await service('REVIEWING', mode).listReviewsForPaper(
        'coauthor',
        'conf',
        'paper',
        ['CHAIR', 'AUTHOR'],
      );
      expect(JSON.stringify(result)).not.toContain('ada@example.test');
      expect(JSON.stringify(result)).not.toContain('Ada Reviewer');
    });
    it('does not grant identity access to an organization admin alone', async () => {
      paperLookup.mockResolvedValue({
        conferenceId: 'conf',
        submittedById: 'author',
        authorships: [],
      });
      reviewLookup.mockResolvedValue([releasedReview]);
      const result = await service('REVIEWING', mode).listReviewsForPaper(
        'admin',
        'conf',
        'paper',
        ['ORG_ADMIN'],
      );
      expect(result.data[0]?.reviewerName).toBeUndefined();
      expect(result.data[0]?.reviewerEmail).toBeUndefined();
    });
  });
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

  it('rejects a save when replacement occurs after the initial assignment lookup', async () => {
    assignmentLookup
      .mockResolvedValueOnce(assignment)
      .mockResolvedValueOnce({ ...assignment, status: 'REPLACED' });
    await expect(
      service('REVIEWING').saveReview(
        'reviewer',
        'conf',
        'assignment',
        { scores: {}, version: 0 },
        ['REVIEWER'],
      ),
    ).rejects.toMatchObject({ status: 403 });
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

  it.each(['MINOR_REVISION', 'MAJOR_REVISION', 'ACCEPT', 'REJECT'])(
    'releases hidden submitted reviews after a %s decision without reopening the cycle',
    async (outcome) => {
      const now = new Date();
      decisionLookup.mockResolvedValue({ id: 'decision', outcome });
      reviewLookup.mockResolvedValue([
        {
          id: 'review',
          paperId: 'paper',
          paper: { title: 'Paper', authorships: [{ email: 'author@example.edu' }] },
        },
      ]);
      transitionRound.mockResolvedValue({ count: 1 });
      readRound.mockResolvedValue({
        id: 'round',
        reviewsReleasedAt: now,
        decisions: [{ outcome }],
        version: 2,
        createdAt: now,
        updatedAt: now,
      });

      const reviews = service('REVIEWING');
      const result = await reviews.releaseReviews(
        'chair',
        'conf',
        'paper',
        'round',
        { version: 1 },
        ['CHAIR'],
      );

      expect(result.releasedCount).toBe(1);
      expect(result.round.reviewStage).toBe(
        outcome.endsWith('REVISION') ? 'REVISION_REQUESTED' : 'DECIDED',
      );
      expect(reviewLookup).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roundId: 'round',
            conferenceId: 'conf',
            paperId: 'paper',
            submittedAt: { not: null },
            visibility: 'HIDDEN',
          },
        }),
      );
      expect(updateReview).toHaveBeenCalledWith({
        where: { id: { in: ['review'] }, visibility: 'HIDDEN' },
        data: { visibility: 'AUTHOR_VISIBLE' },
      });
      expect(publishReviewReleased).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'author@example.edu',
          paperId: 'paper',
          roundId: 'round',
        }),
      );

      await expect(
        reviews.saveReview('reviewer', 'conf', 'assignment', { scores: {}, version: 0 }, [
          'REVIEWER',
        ]),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REVIEW_PHASE_LOCKED' }),
      });
    },
  );

  it('rejects submitting a review after a decision', async () => {
    decisionLookup.mockResolvedValue({ id: 'decision' });
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
    await expect(
      service('REVIEWING').submitReview('reviewer', 'conf', 'assignment', { version: 1 }, [
        'REVIEWER',
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REVIEW_PHASE_LOCKED' }),
    });
    expect(updateReview).not.toHaveBeenCalled();
    expect(updateAssignment).not.toHaveBeenCalled();
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
        expect(publishReviewThankYou).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'reviewer@example.edu',
            reviewerName: 'Ada Lovelace',
            conferenceName: 'Test Conference',
            paperTitle: 'Test paper',
            submissionNumber: 'TEST-K7Q4',
            idempotencyKey: 'review-thank-you-review',
          }),
        );
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
