import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PLATFORM_NOTIFICATION_TEMPLATES } from '../packages/db/src/notification-templates';
import { renderReviewerDigest } from '../packages/db/src/reviewer-digest';
import { withMailDisclaimer } from '../packages/db/src/mail-disclaimer';
import {
  aggregateReviewerWorkload,
  type AssignmentInterventionInput,
  type ReviewerDigestInput,
  type ReviewerOverview,
  type ReviewerWorkAssignment,
} from '@openconferences/schemas';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const conferenceId = id(1),
  userId = id(2),
  reviewer = id(3),
  path = `/dashboard/conferences/${conferenceId}/reviews/reviewers`;
const conference = {
  id: conferenceId,
  organizationId: conferenceId,
  name: 'Reviewer overview preview',
  slug: 'reviewers-preview',
  status: 'REVIEWING',
  blindingMode: 'DOUBLE',
  version: 1,
  myRoles: ['CHAIR'],
};
const assignment = (
  n: number,
  state: ReviewerWorkAssignment['workState'] = 'DRAFT',
): ReviewerWorkAssignment => ({
  id: id(10 + n),
  organizationId: conferenceId,
  conferenceId,
  roundId: id(20 + n),
  paperId: id(30 + n),
  reviewerUserId: reviewer,
  status: state === 'SUBMITTED' ? 'COMPLETED' : 'ASSIGNED',
  version: 0,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  dueAt: state === 'DRAFT' ? '2026-10-01T10:00:00.000Z' : '2030-10-11T10:00:00.000Z',
  reviewerName: 'Ada Reviewer',
  reviewerEmail: 'ada@example.test',
  reviewProgress: state === 'SUBMITTED' ? 'SUBMITTED' : state === 'DRAFT' ? 'DRAFT' : 'NOT_STARTED',
  overdue: state === 'DRAFT',
  paperTitle:
    n === 1 ? 'Reliable conference review systems' : 'A practical approach to shared decisions',
  submissionNumber: `SYS-00${n}`,
  trackId: conferenceId,
  trackName: 'Systems',
  roundNumber: 2,
  isCurrentCycle: true,
  paperStatus: 'UNDER_REVIEW',
  canIntervene: state !== 'SUBMITTED' && state !== 'CLOSED',
  workState: state,
  dueSoon: false,
});
async function mockApi(
  page: Page,
  options: { fail?: boolean; many?: boolean; partial?: boolean; historical?: boolean } = {},
) {
  const a = assignment(1),
    b = assignment(2, 'NOT_STARTED'),
    c = assignment(3, 'SUBMITTED');
  const roster = [
    { userId: reviewer, name: 'Ada Reviewer', email: 'ada@example.test' },
    { userId: id(4), name: 'Grace Reviewer', email: 'grace@example.test' },
    ...(options.many
      ? Array.from({ length: 30 }, (_, n) => ({
          userId: id(100 + n),
          name: `Reviewer ${n}`,
          email: `reviewer${n}@example.test`,
        }))
      : []),
  ];
  const rows = aggregateReviewerWorkload(roster, [a, b, c]);
  if (options.partial) {
    rows[1]!.assignments = [
      {
        ...b,
        id: id(70),
        reviewerUserId: id(4),
        reviewerName: 'Grace Reviewer',
        reviewerEmail: 'grace@example.test',
      },
    ];
    Object.assign(rows[1]!, { assigned: 1, remaining: 1, notStarted: 1 });
  }
  const data: ReviewerOverview = {
    observedAt: '2026-10-09T10:00:00.000Z',
    conferenceName: conference.name,
    scope: { history: 'CURRENT' },
    complete: true,
    data: rows,
    roster,
    tracks: [{ id: conferenceId, name: 'Systems' }],
    cycles: [1, 2],
    summary: {
      overdue: 1,
      dueSoon: 0,
      allSubmitted: 0,
      unassigned: rows.length - (options.partial ? 2 : 1),
    },
  };
  const sends: Array<{ reviewerId: string; body: ReviewerDigestInput }> = [],
    previews: Array<Pick<ReviewerDigestInput, 'assignments'>> = [],
    interventions: Array<AssignmentInterventionInput> = [];
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = {},
      status = 200;
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': 'http://localhost:3000',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
        },
      });
      return;
    }
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
    else if (endpoint.endsWith('/reviewer-overview')) {
      if (options.fail) {
        status = 500;
        body = { detail: 'Unavailable' };
      } else {
        const url = new URL(route.request().url());
        if (url.searchParams.get('history') === 'HISTORICAL')
          body = {
            ...data,
            scope: { history: 'HISTORICAL' },
            data: data.data.map((r) => ({
              ...r,
              remaining: 0,
              overdue: 0,
              drafts: 0,
              notStarted: 0,
              assignments: r.assignments.map((a) => ({
                ...a,
                canIntervene: false,
                isCurrentCycle: false,
                roundNumber: 1,
                workState: 'CLOSED',
                overdue: false,
              })),
            })),
            summary: { overdue: 0, dueSoon: 0, allSubmitted: 0, unassigned: 1 },
          };
        else {
          const search = url.searchParams.get('paperSearch')?.trim().toLowerCase();
          body = search
            ? {
                ...data,
                data: data.data.filter((r) =>
                  r.assignments.some((a) =>
                    `${a.submissionNumber} ${a.paperTitle}`.toLowerCase().includes(search),
                  ),
                ),
              }
            : data;
        }
      }
    } else if (endpoint.endsWith('/reminders/preview')) {
      const input = route.request().postDataJSON();
      previews.push(input);
      const reviewerId = endpoint.split('/reviewers/')[1]!.split('/')[0]!,
        r = data.data.find((r) => r.userId === reviewerId)!;
      const items = r.assignments
        .filter((a) => input.assignments.some((t: { id: string }) => t.id === a.id))
        .map((a) => ({ ...a, dueAt: a.dueAt! }));
      const reviewUrl = `http://localhost:3000/dashboard/conferences/${conferenceId}/reviews/my-assignments`;
      const rendered = renderReviewerDigest(
        PLATFORM_NOTIFICATION_TEMPLATES.find((t) => t.key === 'reviewer.reminder_digest')!,
        { reviewerName: r.name, conferenceName: conference.name, reviewUrl, items },
      );
      body = {
        templateId: id(400),
        templateVersion: 2,
        recipient: `confirmed-${r.email}`,
        reviewerName: r.name,
        conferenceName: conference.name,
        reviewUrl,
        items,
        ...rendered,
        html: withMailDisclaimer(rendered.html, 'html'),
        text: withMailDisclaimer(rendered.text, 'text'),
        preparedAt: new Date().toISOString(),
        previewToken: 'a'.repeat(64),
        dailyLimit: 'One per UTC day',
      };
    } else if (endpoint.endsWith('/reminders')) {
      const reviewerId = endpoint.split('/reviewers/')[1]!.split('/')[0]!;
      sends.push({ reviewerId, body: route.request().postDataJSON() });
      if (options.partial && reviewerId === id(4)) {
        status = 409;
        body = { detail: 'Assignment changed. Refresh and preview again.' };
      } else
        body = {
          digestId: id(200),
          status: 'PREPARING',
          assignmentCount: 1,
          alreadyRequested: false,
          notificationLogId: null,
          message: 'Reminder preparation scheduled. Delivery is not yet confirmed.',
        };
    } else if (endpoint.endsWith('/intervene')) {
      const input = route.request().postDataJSON();
      interventions.push(input);
      a.version++;
      if (input.action === 'EXTEND') {
        a.dueAt = input.dueAt;
        a.overdue = false;
      }
      body = {
        assignmentId: a.id,
        message:
          input.action === 'REMIND'
            ? 'Reminder queued.'
            : input.action === 'EXTEND'
              ? 'Deadline extended.'
              : 'Reviewer replaced. Original draft preserved.',
      };
    } else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === '/auth/me')
      body = {
        id: userId,
        name: 'Test Chair',
        email: 'chair@example.test',
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
  return { data, sends, previews, interventions };
}
async function capture(page: Page, file: string) {
  const original = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const shell = main.parentElement!.parentElement!;
    const style = shell.getAttribute('style');
    main.scrollTop = 0;
    shell.setAttribute('style', 'position:relative;inset:auto;height:auto;min-height:100vh');
    return style;
  });
  try {
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await page.evaluate((style) => {
      const shell = document.querySelector('main')!.parentElement!.parentElement!;
      if (style === null) shell.removeAttribute('style');
      else shell.setAttribute('style', style);
    }, original);
  }
}
test('complete roster, expandable assignments and a two-step email confirmation', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Reviewer overview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grace Reviewer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ada Reviewer', exact: true }).click();
  await expect(page.getByText('Draft saved', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Remind', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Choose reminder assignments' })).toBeVisible();
  expect(api.sends).toHaveLength(0);
  await page.getByRole('button', { name: 'Preview emails' }).click();
  await expect(page.getByRole('heading', { name: 'Review reminder emails' })).toBeVisible();
  expect(api.sends).toHaveLength(0);
  await expect(page.getByText('(confirmed-ada@example.test)', { exact: true })).toBeVisible();
  await expect(page.getByText('2 selected assignments', { exact: true })).toBeVisible();
  await page.getByText('Show exact email preview').click();
  await expect(
    page
      .frameLocator('iframe[title="Email preview for Ada Reviewer"]')
      .getByText('SYS-001', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'Due 1 Oct 2026, 10:00 UTC' })).toBeVisible();
  mkdirSync('.impeccable/review/reviewer-overview', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.locator('#digest-heading').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: '.impeccable/review/reviewer-overview/digest-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#digest-heading').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: '.impeccable/review/reviewer-overview/digest-mobile.png' });
  await page
    .frameLocator('iframe[title="Email preview for Ada Reviewer"]')
    .locator('body')
    .evaluate((el) => el.ownerDocument.defaultView!.scrollTo(0, el.scrollHeight));
  await page.screenshot({
    path: '.impeccable/review/reviewer-overview/digest-mobile-email-end.png',
  });
  await page
    .getByRole('button', { name: 'Confirm 1 reminder email', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/reviewer-overview/digest-mobile-confirm.png' });
  await page.getByRole('button', { name: 'Confirm 1 reminder email', exact: true }).click();
  await expect(
    page.getByText('PREPARING. Reminder preparation scheduled. Delivery is not yet confirmed.'),
  ).toBeVisible();
  expect(api.sends).toHaveLength(1);
  expect(api.sends[0]!.body.assignments).toHaveLength(2);
  expect(api.sends[0]!.body.previewToken).toHaveLength(64);
});
test('historical cycles are read only', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await page.getByLabel('Review cycles', { exact: true }).selectOption('HISTORICAL');
  await expect(page).toHaveURL(/history=HISTORICAL/);
  await expect(
    page.getByText('Historical assignments are read only.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remind', exact: true }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Ada Reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Extend deadline', exact: true })).toHaveCount(0);
});
test('reviewer search preserves paper scope totals and URL state', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await page.getByLabel('Find a reviewer').fill('Grace');
  await expect(page.getByRole('button', { name: 'Ada Reviewer', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/reviewerSearch=Grace/);
  await expect(page.getByText('Overdue (1)', { exact: true })).toBeVisible();
  await page.getByLabel('Paper scope', { exact: true }).fill('Reliable');
  await expect(page).toHaveURL(/paperSearch=Reliable/);
  await expect(page.getByLabel('Find a reviewer')).toHaveValue('Grace');
  await expect(page.getByText('No reviewers match these filters.', { exact: true })).toBeVisible();
  await expect(page.getByText('No reviewers or assignments yet.', { exact: true })).toHaveCount(0);
});
test('pagination clears selection and keeps a complete roster', async ({ page }) => {
  await mockApi(page, { many: true });
  await page.goto(path);
  await expect(page.getByText('32 of 32 reviewers · Page 1 of 2')).toBeVisible();
  await page.getByLabel('Select Ada Reviewer', { exact: true }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('0 reviewers selected on this page')).toBeVisible();
  await expect(page.getByText('32 of 32 reviewers · Page 2 of 2')).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.getByText('32 of 32 reviewers · Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Has remaining (1)', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Has remaining (1)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 of 32 reviewers · Page 1 of 1')).toBeVisible();
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByLabel('Sort reviewers').selectOption('assigned');
  await page.getByLabel('Sort reviewers').selectOption('submitted');
});
test('individual assignment reminder previews its recipient and saved deadline', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto(path);
  await page.getByRole('button', { name: 'Ada Reviewer', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'SYS-001 · Reliable conference review systems' }),
  ).toHaveAttribute('href', /submissions\/.*section=reviews&round=/);
  await page.getByRole('button', { name: 'Remind assignment', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Confirm individual reminder' })).toBeVisible();
  expect(api.interventions).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirm individual reminder', exact: true }).click();
  await expect.poll(() => api.interventions.length).toBe(1);
  expect(api.interventions[0]).toEqual({ action: 'REMIND', version: 0 });
});
test('extension and replacement retain existing intervention safeguards', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto(path);
  await page.getByRole('button', { name: 'Ada Reviewer', exact: true }).click();
  await page.getByRole('button', { name: 'Extend deadline', exact: true }).first().click();
  await page.getByLabel('Reason (required)').fill('Reviewer requested more time');
  await page.getByLabel('New individual deadline (your local time)').fill('2031-10-15T17:30');
  await page.getByRole('button', { name: 'Confirm extension' }).click();
  await expect(page.getByText('Deadline extended.', { exact: true })).toBeVisible();
  expect(api.interventions[0]).toMatchObject({
    action: 'EXTEND',
    version: 0,
    reason: 'Reviewer requested more time',
  });
  await page.getByRole('button', { name: 'Replace reviewer', exact: true }).first().click();
  await page.getByLabel('Replacement reviewer').selectOption(id(4));
  await page.getByLabel('Reason (required)').fill('Reviewer unavailable');
  await page.getByLabel('New individual deadline (your local time)').fill('2031-10-16T17:30');
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(
    page.getByText('Reviewer replaced. Original draft preserved.', { exact: true }),
  ).toBeVisible();
  expect(api.interventions[1]).toMatchObject({ reviewerUserId: id(4) });
});
test('bulk outcomes are per recipient and retries preserve request IDs', async ({ page }) => {
  const api = await mockApi(page, { partial: true });
  await page.goto(path);
  await page.getByLabel('Select eligible reviewers on this page').check();
  await page.getByRole('button', { name: 'Prepare reminders' }).click();
  await page.getByRole('button', { name: 'Preview emails' }).click();
  await page.getByRole('button', { name: 'Confirm 2 reminder emails' }).click();
  await expect(
    page.getByText('Assignment changed. Refresh and preview again.', { exact: true }),
  ).toBeVisible();
  expect(api.sends).toHaveLength(2);
  const requestId = api.sends[1]!.body.requestId;
  await page.getByRole('button', { name: 'Retry unsuccessful requests' }).click();
  await expect.poll(() => api.sends.length).toBe(3);
  expect(api.sends[2]!.body.requestId).toBe(requestId);
});
test('load errors do not show a false empty roster', async ({ page }) => {
  await mockApi(page, { fail: true });
  await page.goto(path);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load reviewer overview' }),
  ).toContainText('Could not load reviewer overview');
  await expect(page.getByText('No reviewers or assignments yet.')).toHaveCount(0);
});
test('desktop and mobile reviewer layouts contain overflow', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Ada Reviewer', exact: true })).toBeVisible();
  mkdirSync('.impeccable/review/reviewer-overview', { recursive: true });
  await capture(page, '.impeccable/review/reviewer-overview/desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Reviewer overview', exact: true })).toBeVisible();
  await capture(page, '.impeccable/review/reviewer-overview/mobile.png');
  await page.getByRole('button', { name: 'Ada Reviewer', exact: true }).click();
  const assignmentDetails = page.locator(`#assignments-${reviewer}`);
  await assignmentDetails.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'start' }));
  await expect(
    assignmentDetails.getByRole('button', { name: 'Remind assignment', exact: true }).first(),
  ).toBeInViewport();
  await expect(
    assignmentDetails.getByRole('button', { name: 'Extend deadline', exact: true }).first(),
  ).toBeInViewport();
  await expect(
    assignmentDetails.getByRole('button', { name: 'Replace reviewer', exact: true }).first(),
  ).toBeInViewport();
  await page.screenshot({ path: '.impeccable/review/reviewer-overview/expanded-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
