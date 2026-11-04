import { expect, test, type Page } from '@playwright/test';
const id = '00000000-0000-4000-8000-000000000001';
const path = `/dashboard/conferences/${id}`;
async function mockCfp(
  page: Page,
  options: { closes?: string; role?: string; failClose?: boolean } = {},
) {
  const conference = {
    id,
    organizationId: id,
    slug: 'cfp-test',
    name: 'CFP deadline test conference',
    status: 'CFP_OPEN',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [options.role ?? 'ORGANIZER'],
    cfpOpensAt: '2020-01-01T00:00:00Z',
    cfpClosesAt: options.closes ?? '2099-01-01T00:00:00Z',
  };
  const transitions: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null };
    let status = 200;
    if (endpoint.endsWith('/get-session'))
      body = {
        session: { id: 'session', token: 'test', userId: id, expiresAt: '2099-01-01T00:00:00Z' },
        user: { id, name: 'Test organizer', email: 'organizer@example.test', emailVerified: true },
      };
    else if (endpoint === '/auth/me')
      body = {
        id,
        name: 'Test organizer',
        email: 'organizer@example.test',
        twoFactorEnabled: true,
      };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${id}`) body = conference;
    else if (endpoint.endsWith('/status')) {
      const next = route.request().postDataJSON().status as string;
      transitions.push(next);
      if (options.failClose) {
        status = 409;
        body = { detail: 'Conference changed. Refresh and try again.' };
      } else {
        conference.status = next;
        conference.version++;
        body = conference;
      }
    } else if (endpoint.includes('/analytics'))
      body = {
        submissions: { total: 0, byStatus: [] },
        reviews: { assigned: 0, completed: 0 },
        registrations: { paid: 0 },
      };
    else if (endpoint.includes('coordination'))
      body = {
        summary: {
          needsReviewers: 0,
          overdueReviews: 0,
          overduePapers: 0,
          readyForDecision: 0,
          pendingInvitations: 0,
        },
        deadlines: { reviewDueAt: null, rebuttalDueAt: null },
        data: [],
      };
    else if (endpoint.endsWith('/author-join-link'))
      body = { token: id, url: 'http://localhost:3007/join/author?token=' + id };
    else if (endpoint.includes('inbox')) body = { data: [], nextCursor: null, unreadCount: 0 };
    await route.fulfill({ status, json: body });
  });
  return { conference, transitions };
}
test('organizers close CFP manually and see CFP Closed after refresh', async ({
  page,
}, testInfo) => {
  const api = await mockCfp(page);
  await page.goto(path);
  const close = page.getByRole('button', { name: 'Close CFP', exact: true });
  await expect(close).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await close.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('cfp-open-desktop.png') });
  await close.click();
  await expect(
    page.getByRole('main').getByText('CFP Closed', { exact: true }).first(),
  ).toBeVisible();
  expect(api.transitions).toEqual(['CFP_CLOSED']);
  await expect(close).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('main').getByText('CFP Closed', { exact: true }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('main')
    .getByText('CFP Closed', { exact: true })
    .first()
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('cfp-closed-mobile.png') });
});
test('expired deadline shows CFP Closed without requiring a lifecycle job', async ({ page }) => {
  await mockCfp(page, { closes: '2020-01-02T00:00:00Z' });
  await page.goto(path);
  await expect(
    page.getByRole('main').getByText('CFP Closed', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close CFP', exact: true })).toHaveCount(0);
});
test('an open author page closes at the deadline and removes new submission', async ({ page }) => {
  const now = new Date('2026-11-03T00:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await mockCfp(page, { role: 'AUTHOR', closes: '2026-11-03T00:00:02Z' });
  await page.goto(path);
  await expect(page.getByRole('link', { name: 'New submission', exact: true })).toBeVisible();
  await page.clock.runFor(2001);
  await expect(
    page.getByRole('main').getByText('CFP Closed', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'New submission', exact: true })).toHaveCount(0);
});
test('chairs cannot close CFP', async ({ page }) => {
  await mockCfp(page, { role: 'CHAIR' });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Organizer overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close CFP', exact: true })).toHaveCount(0);
});

test('a failed organizer request remains retryable', async ({ page }) => {
  await mockCfp(page, { failClose: true });
  await page.goto(path);
  const close = page.getByRole('button', { name: 'Close CFP', exact: true });
  await close.click();
  await expect(page.getByText('Conference changed. Refresh and try again.').first()).toBeVisible();
  await expect(close).toBeEnabled();
});
