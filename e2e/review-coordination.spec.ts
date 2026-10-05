import { test, expect, type Page } from '@playwright/test';
import type { ReviewCoordinationDto } from '@openconferences/schemas';
const conferenceId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const path = `/dashboard/conferences/${conferenceId}/reviews/rounds`;
const conference = {
  id: conferenceId,
  organizationId: conferenceId,
  name: 'Review coordination preview',
  slug: 'review-preview',
  status: 'REVIEWING',
  blindingMode: 'DOUBLE',
  version: 1,
  myRoles: ['ORGANIZER', 'CHAIR'],
};
// The dashboard scrolls inside <main>. Expand only the capture frame so a full-page
// screenshot includes the table and lower actions rather than just the viewport.
async function captureDashboard(page: Page, path: string) {
  const original = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const shell = main.parentElement!.parentElement!;
    const original = { style: shell.getAttribute('style'), scrollTop: main.scrollTop };
    main.scrollTop = 0;
    shell.setAttribute('style', 'position:relative;inset:auto;height:auto;min-height:100vh');
    return original;
  });
  try {
    await page.screenshot({ path, fullPage: true });
  } finally {
    await page.evaluate((original) => {
      const main = document.querySelector('main')!;
      const shell = main.parentElement!.parentElement!;
      if (original.style === null) shell.removeAttribute('style');
      else shell.setAttribute('style', original.style);
      main.scrollTop = original.scrollTop;
    }, original);
  }
}
function snapshot(): ReviewCoordinationDto {
  const date = new Date();
  const dueAt = new Date(date.getTime() - 86400000).toISOString();
  const assignment = {
    id: '00000000-0000-4000-8000-000000000003',
    organizationId: conferenceId,
    conferenceId,
    roundId: '00000000-0000-4000-8000-000000000004',
    paperId: '00000000-0000-4000-8000-000000000005',
    reviewerUserId: userId,
    status: 'ASSIGNED' as const,
    version: 0,
    dueAt,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    reviewerName: 'Ada Reviewer',
    reviewerEmail: 'ada@example.test',
    reviewProgress: 'DRAFT' as const,
    overdue: true,
  };
  const base = {
    paperId: assignment.paperId,
    paperTitle: 'Reliable conference review systems',
    submissionNumber: 'SYS-001',
    paperStatus: 'UNDER_REVIEW',
    paperVersion: 1,
    cycleId: assignment.roundId,
    cycleVersion: 0,
    roundNumber: 2,
    reviewStage: 'IN_REVIEW' as const,
    assignmentCount: 1,
    submittedReviewCount: 0,
    reviewsReleasedAt: null,
    warning: '0 of 2 required reviews submitted',
    trackId: conferenceId,
    trackName: 'Systems',
    reviewDueAt: dueAt,
    assignments: [assignment],
    needsReviewers: true,
    overdueReviewCount: 1,
    readyForDecision: false,
    canIntervene: true,
    isCurrentCycle: true,
  };
  return {
    observedAt: date.toISOString(),
    minimumReviews: 2,
    summary: {
      needsReviewers: 1,
      overdueReviews: 1,
      overduePapers: 1,
      readyForDecision: 0,
      pendingInvitations: 2,
    },
    deadlines: { reviewDueAt: dueAt, rebuttalDueAt: null },
    data: [
      base,
      {
        ...base,
        cycleId: '00000000-0000-4000-8000-000000000006',
        roundNumber: 1,
        reviewStage: 'REVISION_REQUESTED',
        isCurrentCycle: false,
        canIntervene: false,
        needsReviewers: false,
        overdueReviewCount: 0,
        assignments: [
          {
            ...assignment,
            roundId: '00000000-0000-4000-8000-000000000006',
            id: '00000000-0000-4000-8000-000000000007',
            overdue: false,
            status: 'COMPLETED',
            reviewProgress: 'SUBMITTED',
          },
        ],
        submittedReviewCount: 1,
      },
    ],
  };
}
async function mockApi(page: Page, options: { failSecond?: boolean; ledgerFails?: boolean } = {}) {
  const data = snapshot();
  const assignments: Array<{ reviewerUserId: string; dueAt: string }> = [];
  const actions: Array<{
    action: string;
    version: number;
    reason?: string;
    dueAt?: string;
    reviewerUserId?: string;
  }> = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    let body: unknown = {};
    let status = 200;
    if (endpoint.endsWith('/get-session'))
      body = {
        session: {
          id: 'session',
          userId,
          token: 'test',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {
          id: userId,
          name: 'Test Chair',
          email: 'chair@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint.endsWith('/intervene')) {
      const input = route.request().postDataJSON();
      actions.push(input);
      if (options.failSecond && actions.length === 2) {
        status = 409;
        body = { detail: 'Assignment changed. Refresh and try again.' };
      } else {
        body = {
          assignmentId: data.data[0]!.assignments[0]!.id,
          message:
            input.action === 'EXTEND'
              ? 'Deadline extended.'
              : input.action === 'REPLACE'
                ? 'Reviewer replaced. Original draft preserved.'
                : 'Reminder queued.',
        };
        if (input.action === 'EXTEND') {
          data.data[0]!.assignments[0]!.dueAt = input.dueAt;
          data.data[0]!.assignments[0]!.version += 1;
          data.data[0]!.assignments[0]!.overdue = false;
        }
      }
    } else if (endpoint.endsWith('/assignments') && route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      assignments.push(input);
      status = 201;
      body = {
        assignment: { ...data.data[0]!.assignments[0]!, ...input },
        message: 'Reviewer assigned successfully',
      };
    } else if (endpoint.endsWith('/review-coordination')) {
      if (options.ledgerFails) {
        status = 500;
        body = { detail: 'Unavailable' };
      } else body = data;
    } else if (endpoint.endsWith('/members'))
      body = {
        data: [
          {
            userId: '00000000-0000-4000-8000-000000000008',
            name: 'Grace Reviewer',
            email: 'grace@example.test',
            roles: ['REVIEWER'],
            scope: 'CONFERENCE',
            membershipId: userId,
          },
        ],
        nextCursor: null,
      };
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint.endsWith('/papers'))
      body = {
        data: [
          {
            id: data.data[0]!.paperId,
            title: data.data[0]!.paperTitle,
            submissionNumber: 'SYS-001',
            status: 'UNDER_REVIEW',
          },
        ],
        nextCursor: null,
      };
    else if (endpoint.endsWith('/analytics/overview'))
      body = {
        submissions: { total: 1, byStatus: [{ status: 'UNDER_REVIEW', count: 1 }] },
        reviews: { assigned: 1, completed: 0 },
        registrations: { paid: 0 },
      };
    else if (endpoint === '/auth/me')
      body = {
        id: userId,
        email: 'chair@example.test',
        name: 'Test Chair',
        twoFactorEnabled: true,
      };
    else if (endpoint.includes('inbox')) body = { data: [], nextCursor: null, unreadCount: 0 };
    else body = { data: [], nextCursor: null };
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: {
        'access-control-allow-origin': 'http://localhost:3000',
        'access-control-allow-credentials': 'true',
      },
    });
  });
  return { data, actions, assignments };
}

test('manual assignment saves the chosen local deadline as UTC', async ({ page }) => {
  const { data, assignments } = await mockApi(page);
  await page.goto(`/dashboard/conferences/${conferenceId}/reviews/assignments/manual`);
  await page.getByLabel('Paper', { exact: true }).selectOption(data.data[0]!.paperId);
  await page
    .getByLabel('Reviewer', { exact: true })
    .selectOption('00000000-0000-4000-8000-000000000008');
  const deadline = '2030-10-15T17:30';
  await page.getByLabel('Individual review deadline (local time)').fill(deadline);
  const expectedUtc = await page.evaluate((value) => new Date(value).toISOString(), deadline);
  await captureDashboard(page, 'test-results/review-assignment-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await captureDashboard(page, 'test-results/review-assignment-mobile.png');
  await page.getByRole('button', { name: 'Assign reviewer', exact: true }).click();
  await expect(page.getByText(/Reviewer assigned successfully/)).toBeVisible();
  expect(assignments).toEqual([
    { reviewerUserId: '00000000-0000-4000-8000-000000000008', dueAt: expectedUtc },
  ]);
});

test('overview links to actionable ledger queues with real deadlines', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/dashboard/conferences/${conferenceId}`);
  await expect(page.getByRole('heading', { name: 'Review attention' })).toBeVisible();
  await captureDashboard(page, 'test-results/review-overview-desktop.png');
  const link = page.getByRole('link', { name: /Papers needing more reviewers/ });
  await expect(link).toHaveAttribute('href', `${path}?queue=NEEDS_REVIEWERS`);
  await expect(page.getByText('Conference slug', { exact: true })).toHaveCount(0);
  await link.click();
  await expect(page.getByRole('heading', { name: 'Paper review ledger' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Needs reviewers (1)' })).toBeVisible();
});
test('historical cycles are browseable and cannot be selected for intervention', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByText('Cycle 2', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'History', exact: true }).selectOption('HISTORICAL');
  await expect(page.getByText('Cycle 1 · Historical')).toBeVisible();
  await page.getByRole('button', { name: 'Reviewers (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Replace reviewer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select unfinished reviews' })).toBeDisabled();
  await expect(page).toHaveURL(/history=HISTORICAL/);
});
test('reminder requires preview and extension refreshes version and deadline', async ({ page }) => {
  const { actions } = await mockApi(page);
  await page.goto(path);
  await page.getByRole('button', { name: 'Reviewers (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Remind', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Review action preview' })).toContainText(
    'ada@example.test',
  );
  expect(actions).toHaveLength(0);
  await captureDashboard(page, 'test-results/review-reminder-preview.png');
  await page.getByRole('button', { name: 'Queue 1 reminder' }).click();
  await expect(page.getByText('Reminder queued.')).toBeVisible();
  await page.getByRole('button', { name: 'Extend deadline', exact: true }).click();
  await page
    .getByLabel('Reason (recorded in the audit log)')
    .fill('Reviewer requested two more days');
  await page.getByLabel('New deadline (local time)').fill('2030-10-10T17:30');
  await page.getByRole('button', { name: 'Extend 1 deadline', exact: true }).click();
  await expect(page.getByText('Deadline extended.', { exact: false })).toBeVisible();
  expect(actions.map((a) => a.action)).toEqual(['REMIND', 'EXTEND']);
  expect(actions[1]?.reason).toBe('Reviewer requested two more days');
});
test('replacement shows new recipient and preserves history in its confirmation', async ({
  page,
}) => {
  const { actions } = await mockApi(page);
  await page.goto(path);
  await page.getByRole('button', { name: 'Reviewers (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Replace reviewer', exact: true }).click();
  await page
    .getByLabel('Replacement reviewer', { exact: true })
    .selectOption('00000000-0000-4000-8000-000000000008');
  await page.getByLabel('Reason (recorded in the audit log)').fill('Reviewer unavailable');
  await expect(page.getByRole('form', { name: 'Review action preview' })).toContainText(
    'The original assignment and private draft are preserved',
  );
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(page.getByText('Reviewer replaced. Original draft preserved.')).toBeVisible();
  expect(actions[0]).toMatchObject({
    action: 'REPLACE',
    reviewerUserId: '00000000-0000-4000-8000-000000000008',
    reason: 'Reviewer unavailable',
  });
});
test('ledger errors remain visible without false empty-state counts', async ({ page }) => {
  await mockApi(page, { ledgerFails: true });
  await page.goto(path);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Failed to load review coordination' }),
  ).toContainText('Failed to load review coordination');
  await expect(page.getByText('No submitted papers yet')).toHaveCount(0);
});
test('desktop and mobile ledger layouts keep table overflow contained', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Paper review ledger' })).toBeVisible();
  await captureDashboard(page, 'test-results/review-ledger-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Find a paper')).toBeVisible();
  await captureDashboard(page, 'test-results/review-ledger-mobile.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('bulk reminders report each success and failure separately', async ({ page }) => {
  const { data, actions } = await mockApi(page, { failSecond: true });
  data.data[0]!.assignments.push({
    ...data.data[0]!.assignments[0]!,
    id: '00000000-0000-4000-8000-000000000009',
    reviewerUserId: '00000000-0000-4000-8000-000000000010',
    reviewerName: 'Linus Reviewer',
    reviewerEmail: 'linus@example.test',
  });
  data.data[0]!.assignmentCount = 2;
  await page.goto(path);
  await page.getByRole('button', { name: 'Select unfinished reviews' }).click();
  await page.getByRole('button', { name: 'Remind selected' }).click();
  await expect(page.getByRole('form', { name: 'Review action preview' })).toContainText(
    'linus@example.test',
  );
  await page.getByRole('button', { name: 'Queue 2 reminders' }).click();
  await expect(
    page.getByRole('heading', { name: 'Action results · 1 succeeded, 1 failed' }),
  ).toBeVisible();
  await expect(page.getByText('Assignment changed. Refresh and try again.')).toBeVisible();
  await expect(
    page.getByText('Assignment changed. Refresh and try again.').locator('..'),
  ).toContainText('SYS-001 · Linus Reviewer (linus@example.test)');
  await captureDashboard(page, 'test-results/review-bulk-results-desktop.png');
  expect(actions).toHaveLength(2);
});

test('paper search survives typing and links retain the URL filter', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await page.getByLabel('Find a paper').pressSequentially('SYS-001');
  await expect(page.getByLabel('Find a paper')).toHaveValue('SYS-001');
  await expect(page).toHaveURL(/search=SYS-001/);
  await expect(page.getByText('Reliable conference review systems', { exact: true })).toBeVisible();
});
