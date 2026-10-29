import { test, expect, type Page } from '@playwright/test';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const conferenceId = id(1);
const submittedAt = '2026-10-20T10:00:00Z';
const paper = {
  id: id(2),
  conferenceId,
  organizationId: conferenceId,
  submittedById: id(3),
  trackId: id(4),
  title: 'Reliable conference workflows',
  abstract: 'Submission date test.',
  keywords: [],
  status: 'UNDER_REVIEW',
  version: 1,
  submissionNumber: 'TEST-A123',
  submittedAt,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
  authorships: [],
  currentVersionId: null,
};
const related = {
  paperId: paper.id,
  paperTitle: paper.title,
  paperSubmittedAt: submittedAt,
  submissionNumber: paper.submissionNumber,
};

async function mockDates(page: Page, role = 'ORGANIZER') {
  const conference = {
    id: conferenceId,
    organizationId: conferenceId,
    name: 'Date preview',
    slug: 'date-preview',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [role],
  };
  const round = {
    id: id(5),
    paperId: paper.id,
    conferenceId,
    roundNumber: 1,
    reviewStage: 'IN_REVIEW',
    version: 1,
  };
  const assignment = {
    ...related,
    id: id(6),
    roundId: round.id,
    roundNumber: 1,
    reviewerUserId: id(7),
    reviewerName: 'Ada Reviewer',
    reviewerEmail: 'ada@example.test',
    status: 'ASSIGNED',
    reviewProgress: 'NOT_STARTED',
    reviewStage: 'IN_REVIEW',
    review: null,
    dueAt: '2026-11-10T10:00:00Z',
  };
  const list = (data: unknown[]) => ({ data, nextCursor: null });
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = list([]);
    if (endpoint.endsWith('/get-session'))
      body = {
        session: { id: 'session', userId: id(3), token: 'test', expiresAt: '2027-01-01T00:00:00Z' },
        user: {
          id: id(3),
          name: 'Demo User',
          email: 'demo@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint === '/auth/me')
      body = { id: id(3), name: 'Demo User', email: 'demo@example.test', twoFactorEnabled: true };
    else if (endpoint === '/conferences') body = list([conference]);
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint.endsWith('/papers'))
      body = list([
        paper,
        { ...paper, id: id(10), title: 'Unsubmitted draft', status: 'DRAFT', submittedAt: null },
      ]);
    else if (endpoint.endsWith('/rounds')) body = list([round]);
    else if (endpoint.endsWith('/review-progress'))
      body = {
        data: [
          { ...related, cycleId: round.id, roundNumber: 1, submittedReviewCount: 2, warning: null },
        ],
        minimumReviews: 2,
      };
    else if (endpoint.endsWith('/decisions'))
      body = list([
        {
          ...related,
          id: id(8),
          roundId: round.id,
          outcome: 'ACCEPT',
          rationale: null,
          notifiedAt: null,
          createdAt: '2026-10-28T10:00:00Z',
        },
      ]);
    else if (endpoint.endsWith('/review/paper-pool'))
      body = {
        ...list([{ ...paper, bids: [], myBid: null }]),
        mode: 'oversight',
        blindingMode: 'DOUBLE',
      };
    else if (endpoint.endsWith('/assignments')) body = list([assignment]);
    else if (endpoint.endsWith('/members'))
      body = list([
        { userId: id(7), name: 'Ada Reviewer', email: 'ada@example.test', roles: ['REVIEWER'] },
      ]);
    else if (endpoint.endsWith('/bids'))
      body = list([
        {
          ...related,
          id: id(9),
          reviewerUserId: id(7),
          reviewerName: 'Ada Reviewer',
          reviewerEmail: 'ada@example.test',
          value: 'YES',
        },
      ]);
    else if (endpoint.endsWith('/conflicts-of-interest'))
      body = list([
        {
          ...related,
          id: id(11),
          userName: 'Ada Reviewer',
          type: 'INSTITUTION',
          source: 'SELF',
          note: null,
        },
      ]);
    else if (endpoint.endsWith('/registrations'))
      body = list([
        {
          ...related,
          id: id(12),
          status: 'PENDING',
          audience: 'REGULAR',
          amountDueMinor: 750000,
          currency: 'INR',
          deadlineAt: '2026-11-25T10:00:00Z',
        },
      ]);
    else if (endpoint.endsWith('/student-verifications'))
      body = list([{ ...related, id: id(13), status: 'PENDING', note: null }]);
    else if (endpoint.endsWith('/review-coordination'))
      body = {
        observedAt: submittedAt,
        minimumReviews: 2,
        summary: {
          needsReviewers: 0,
          overdueReviews: 0,
          overduePapers: 0,
          readyForDecision: 0,
          pendingInvitations: 0,
        },
        deadlines: {},
        data: [
          {
            ...related,
            paperStatus: 'UNDER_REVIEW',
            paperVersion: 1,
            cycleId: round.id,
            cycleVersion: 1,
            roundNumber: 1,
            reviewStage: 'IN_REVIEW',
            assignmentCount: 1,
            submittedReviewCount: 0,
            reviewsReleasedAt: null,
            warning: null,
            trackId: id(4),
            trackName: 'Research',
            reviewDueAt: assignment.dueAt,
            assignments: [assignment],
            isCurrentCycle: true,
            canIntervene: true,
            canReleaseReviews: false,
            needsReviewers: false,
            overdueReviewCount: 0,
            readyForDecision: false,
          },
        ],
      };
    else if (endpoint.includes('inbox')) body = { ...list([]), unreadCount: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

for (const section of [
  'submissions',
  'reviews/bidding',
  'reviews/assignments/current',
  'reviews/assignments/bids',
  'reviews/coi/all',
  'reviews/rounds',
  'reviews/decisions/recorded',
  'registrations/all',
  'registrations/verifications',
]) {
  test(`submission date is visible in ${section}`, async ({ page }) => {
    await mockDates(page);
    await page.goto(`/dashboard/conferences/${conferenceId}/${section}`);
    await expect(
      page.getByRole('columnheader', { name: 'Submission date', exact: true }),
    ).toBeVisible();
    await expect(page.locator(`table time[datetime="${submittedAt}"]`).first()).toBeVisible();
    await expect(page.locator('table time[datetime="2026-10-01T10:00:00Z"]')).toHaveCount(0);
    await expect(page.locator('table time[datetime="2026-10-28T10:00:00Z"]')).toHaveCount(0);
  });
}

test('author submissions show no fabricated date for a draft and fit mobile', async ({ page }) => {
  await mockDates(page, 'AUTHOR');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/conferences/${conferenceId}/submissions`);
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Unsubmitted draft' })
      .getByLabel('Submission date unavailable'),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
