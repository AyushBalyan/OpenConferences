import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
const id = '00000000-0000-4000-8000-000000000001';
const path = `/dashboard/conferences/${id}/analytics`;
const conference = {
  id,
  organizationId: id,
  name: 'Systems & Society 2026',
  slug: 'systems-2026',
  status: 'REVIEWING',
  blindingMode: 'DOUBLE',
  version: 1,
  myRoles: ['CHAIR'],
};
function fixture(): ConferenceAnalyticsOverview {
  return {
    conferenceId: id,
    computedAt: '2026-10-09T10:30:00.000Z',
    currency: 'INR',
    submissions: {
      total: 96,
      excluded: { draft: 8, withdrawn: 5 },
      byStatus: [
        { status: 'SUBMITTED', count: 22 },
        { status: 'UNDER_REVIEW', count: 55 },
        { status: 'DECISION_MADE', count: 15 },
        { status: 'CAMERA_READY', count: 4 },
      ],
      byDay: Array.from({ length: 20 }, (_, i) => ({
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        count: [2, 3, 4, 0, 6, 4, 8, 6, 4, 7, 3, 4, 6, 5, 3, 9, 4, 2, 7, 9][i]!,
      })),
    },
    reviews: {
      assigned: 180,
      completed: 112,
      submitted: 112,
      draft: 33,
      notStarted: 21,
      closedIncomplete: 12,
      inconsistent: 2,
      overdue: 14,
      underCoveredPapers: 23,
      reviewerLoad: Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: [
          'Alexandra Montgomery',
          'Samira Rahman',
          'Daniel Chen',
          'Priya Deshmukh',
          'Gabriel Santos',
          'Nora O’Connor',
          'Yuki Tanaka',
          'Sofia Martínez',
          'Kwame Mensah',
          'Elena Petrova',
          'Amir Hassan',
          'Mei Lin',
        ][i]!,
        count: [8, 7, 6, 5, 4, 4, 4, 4, 3, 3, 3, 3][i]!,
      })),
    },
    decisions: {
      total: 19,
      acceptRate: 12 / 19,
      byOutcome: [
        { outcome: 'ACCEPT', count: 12 },
        { outcome: 'REJECT', count: 3 },
        { outcome: 'MINOR_REVISION', count: 3 },
        { outcome: 'MAJOR_REVISION', count: 1 },
      ],
    },
    registrations: {
      total: 27,
      paid: 19,
      unpaid: 5,
      atRisk: 2,
      overdue: 1,
      byStatus: [
        { status: 'PAID', count: 19 },
        { status: 'PENDING', count: 3 },
        { status: 'AWAITING_VERIFICATION', count: 2 },
        { status: 'CANCELLED', count: 3 },
      ],
    },
    revenueMinor: 20250000,
    revenueByTiming: [
      { name: 'EARLY', amountMinor: 15500000 },
      { name: 'REGULAR', amountMinor: 4750000 },
    ],
    revenueByAudience: [
      { name: 'STUDENT', amountMinor: 6500000 },
      { name: 'REGULAR', amountMinor: 13750000 },
    ],
    excludedCurrencyPayments: 0,
    unpaidAccepted: 3,
    authors: Array.from({ length: 25 }, (_, i) => ({
      name:
        ['Aarav Sharma', 'Nadia Ahmed', 'Chen Wei', 'Maria Fernandes'][i] ??
        `Corresponding Author ${i + 1}`,
      count: i < 4 ? 6 : i < 13 ? 4 : 3,
    })),
    institutions: [
      { name: 'Indian Institute of Technology, Bombay', count: 16 },
      { name: 'National University of Singapore', count: 13 },
      { name: 'University of Cambridge', count: 11 },
      { name: 'Massachusetts Institute of Technology', count: 9 },
      { name: 'École Polytechnique Fédérale de Lausanne', count: 8 },
      { name: 'University of California, Berkeley', count: 7 },
      { name: 'Unspecified', count: 6 },
    ],
  };
}
async function mockApi(page: Page, mode: 'normal' | 'empty' | 'error' = 'normal') {
  let calls = 0,
    failNext = false;
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null },
      status = 200;
    if (endpoint.endsWith('/get-session'))
      body = {
        session: {
          id: 'session',
          userId: id,
          token: 'test',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {
          id,
          name: 'Test Chair',
          email: 'chair@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint.endsWith('/analytics/overview')) {
      calls++;
      if (mode === 'error' || failNext) {
        failNext = false;
        status = 500;
        body = { detail: 'Unavailable' };
      } else if (mode === 'empty')
        body = {
          ...fixture(),
          submissions: { total: 0, excluded: { draft: 3, withdrawn: 2 }, byStatus: [], byDay: [] },
          reviews: {
            assigned: 0,
            completed: 0,
            submitted: 0,
            draft: 0,
            notStarted: 0,
            closedIncomplete: 0,
            inconsistent: 0,
            overdue: 0,
            underCoveredPapers: 0,
            reviewerLoad: [],
          },
          decisions: { total: 0, acceptRate: 0, byOutcome: [] },
          registrations: { total: 0, paid: 0, unpaid: 0, atRisk: 0, overdue: 0, byStatus: [] },
          revenueMinor: 0,
          revenueByTiming: [],
          revenueByAudience: [],
          unpaidAccepted: 0,
          authors: [],
          institutions: [],
        };
      else body = fixture();
    } else if (endpoint === `/conferences/${id}`) body = conference;
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === '/auth/me')
      body = { id, name: 'Test Chair', email: 'chair@example.test', twoFactorEnabled: true };
    else if (endpoint.includes('inbox')) body = { data: [], nextCursor: null, unreadCount: 0 };
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
  return {
    calls: () => calls,
    failNext: () => {
      failNext = true;
    },
  };
}
async function capture(page: Page, file: string) {
  const previous = await page.evaluate(() => {
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
    }, previous);
  }
}
test('analytics charts render on desktop and mobile', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await expect(page.getByText('Submissions by status', { exact: true })).toBeVisible();
  await page.locator('.recharts-surface').first().waitFor();
  mkdirSync('.impeccable/review/analytics', { recursive: true });
  const prefix = process.env.ANALYTICS_CAPTURE_BASELINE ? 'before-' : '';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(page, `.impeccable/review/analytics/${prefix}desktop.png`);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, `.impeccable/review/analytics/${prefix}mobile.png`);
  if (!prefix) {
    for (const [section, name] of [
      ['#review-health', 'review'],
      ['#submission-activity', 'activity'],
      ['#participation', 'people'],
      ['#registration-finance', 'finance'],
    ]) {
      await page.locator(section!).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `.impeccable/review/analytics/mobile-${name}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      document.querySelector('main')!.scrollTo(0, 0);
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: '.impeccable/review/analytics/desktop-first.png' });
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('scope definitions, exact data and chart modes are available', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByText('96 included papers.', { exact: true })).toBeVisible();
  await page.getByText('How these numbers are counted', { exact: true }).click();
  await expect(
    page.getByText('Activity uses paper creation dates in UTC.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '14 reviews past their deadline' })).toHaveAttribute(
    'href',
    /queue=OVERDUE/,
  );
  await page.getByRole('button', { name: 'Cumulative', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cumulative', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByText('View activity data', { exact: true }).click();
  const table = page.getByRole('table', { name: 'Included papers by creation period, UTC' });
  await expect(table.getByRole('row').last()).toContainText('96');
  await page.getByRole('button', { name: 'Per period', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Per period', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('author search and pagination retain every author', async ({ page }) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.getByText('25 of 25 authors · Page 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next authors' }).click();
  await expect(page.getByText('25 of 25 authors · Page 2 of 3')).toBeVisible();
  await page.getByLabel('Find a corresponding author').fill('Nadia');
  await expect(page.getByText('1 of 25 authors · Page 1 of 1')).toBeVisible();
  await expect(page.getByRole('row', { name: 'Nadia Ahmed 6' })).toBeVisible();
  await page.getByLabel('Find a corresponding author').fill('missing');
  await expect(
    page.getByText('No matching authors. Clear the search to see everyone.'),
  ).toBeVisible();
});
test('empty data distinguishes unavailable percentages from zero activity', async ({ page }) => {
  await mockApi(page, 'empty');
  await page.goto(path);
  await expect(page.getByText('0 included papers.', { exact: true })).toBeVisible();
  await expect(page.getByText('Acceptance share unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('No review assignments in the latest cycles yet.')).toBeVisible();
  await expect(page.getByText('No included papers to plot yet.')).toBeVisible();
});
test('failed loads do not fabricate counts, and refresh failures retain a labeled snapshot', async ({
  page,
}) => {
  await mockApi(page, 'error');
  await page.goto(path);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Analytics could not be loaded' }),
  ).toContainText('Analytics could not be loaded');
  await expect(page.getByText('0 included papers.', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/**');
  const api = await mockApi(page);
  await page.getByRole('button', { name: 'Refresh analytics' }).click();
  await expect(page.getByText('96 included papers.', { exact: true })).toBeVisible();
  api.failNext();
  await page.getByRole('button', { name: 'Refresh analytics' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Showing the previous snapshot' }),
  ).toContainText('Showing the previous snapshot');
  await expect(page.getByText('96 included papers.', { exact: true })).toBeVisible();
});
