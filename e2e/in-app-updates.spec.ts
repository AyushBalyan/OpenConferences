import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { InboxItem } from '@openconferences/schemas';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const id = uuid(1),
  path = `/dashboard/conferences/${id}/inbox`;
const captureDir = '.impeccable/review/in-app-updates';
async function mockApi(
  page: Page,
  options: { role?: string; empty?: boolean; fail?: boolean } = {},
) {
  const conference = {
    id,
    organizationId: id,
    name: 'Systems & Society 2026',
    slug: 'synthetic',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [options.role ?? 'CHAIR'],
  };
  const messages = [
    'Paper submitted.',
    'Reviewer invitation accepted.',
    'Review submitted.',
    'Paper withdrawn.',
    'Reviewer invitation declined.',
    'Author response submitted.',
  ];
  let items: InboxItem[] = options.empty
    ? []
    : messages.map((title, i) => ({
        id: uuid(10 + i),
        kind: 'CONFERENCE',
        version: 0,
        title,
        eventType: [
          'PAPER_SUBMITTED',
          'INVITATION_ACCEPTED',
          'REVIEW_SUBMITTED',
          'PAPER_WITHDRAWN',
          'INVITATION_DECLINED',
          'REBUTTAL_SUBMITTED',
        ][i],
        subject:
          i === 1
            ? 'Ada Reviewer'
            : i === 4
              ? 'Grace Reviewer'
              : 'SYS-014 · Reliable methods for collaborative research and conference peer review',
        paperId: i === 1 || i === 4 ? null : uuid(100 + i),
        roundId: null,
        href:
          i === 1 || i === 4
            ? `/dashboard/conferences/${id}/reviews/reviewers`
            : `/dashboard/conferences/${id}/submissions/${uuid(100 + i)}`,
        unread: i < 3,
        updatedAt: `2026-10-09T${String(14 - i).padStart(2, '0')}:00:00.000Z`,
      }));
  let fail = options.fail ?? false;
  const writes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null },
      status = 200;
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': 'http://localhost:3006',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
        },
      });
      return;
    }
    if (route.request().method() === 'POST') writes.push(endpoint);
    if (endpoint.endsWith('/get-session'))
      body = {
        session: {
          id: 'session',
          userId: id,
          token: 'fixture',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {
          id,
          name: 'Synthetic Chair',
          email: 'chair@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint === '/auth/me')
      body = { id, name: 'Synthetic Chair', email: 'chair@example.test', twoFactorEnabled: true };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${id}`) body = conference;
    else if (endpoint.endsWith('/inbox/count'))
      body = { unreadCount: items.filter((i) => i.unread).length };
    else if (endpoint.endsWith('/inbox/read-all')) {
      items = items.map((i) => ({ ...i, unread: false }));
      body = { read: true };
    } else if (endpoint.endsWith('/inbox/read')) {
      const input: { sourceId: string } = route.request().postDataJSON();
      items = items.map((i) => (i.id === input.sourceId ? { ...i, unread: false } : i));
      body = { read: true };
    } else if (endpoint.endsWith('/inbox')) {
      if (fail) {
        status = 500;
        body = { detail: 'Unavailable' };
      } else {
        const params = new URL(route.request().url()).searchParams;
        const kind = params.get('kind');
        body = {
          data:
            kind === 'CONFERENCE'
              ? items.filter((item) => !params.has('unread') || item.unread)
              : [],
          nextCursor: null,
          observedAt: '2026-10-09T15:00:00.000Z',
        };
      }
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: {
        'access-control-allow-origin': 'http://localhost:3006',
        'access-control-allow-credentials': 'true',
      },
    });
  });
  return {
    writes,
    recover: () => {
      fail = false;
    },
  };
}
async function capture(page: Page, name: string) {
  mkdirSync(captureDir, { recursive: true });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const saved = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const shell = main.parentElement!.parentElement!;
    const style = shell.getAttribute('style');
    main.scrollTop = 0;
    shell.setAttribute('style', 'position:relative;inset:auto;height:auto;min-height:100vh');
    return style;
  });
  await page.screenshot({ path: `${captureDir}/${name}.png`, fullPage: true });
  await page.evaluate((style) => {
    const shell = document.querySelector('main')!.parentElement!.parentElement!;
    if (style === null) shell.removeAttribute('style');
    else shell.setAttribute('style', style);
  }, saved);
}
test('desktop and mobile presentation', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Updates', exact: true })).toBeVisible();
  await expect(page.getByText('Loading updates…')).not.toBeVisible();
  if (!process.env.CAPTURE_BEFORE)
    await expect(page.getByText('Paper submitted.', { exact: true })).toBeVisible();
  await capture(page, process.env.CAPTURE_BEFORE ? 'before-desktop' : 'desktop');
  await expect(
    page.getByRole('link', { name: 'Updates, 3 new notifications', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(page.locator('aside').first()).toHaveCSS('width', '64px');
  await expect(
    page.getByRole('link', { name: 'Updates, 3 new notifications', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${captureDir}/collapsed-sidebar.png` });
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, process.env.CAPTURE_BEFORE ? 'before-mobile' : 'mobile');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const navigation = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(
    navigation.getByRole('link', { name: 'Updates, 3 new notifications', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${captureDir}/mobile-navigation.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('read controls update the bell and unread feed without email requests', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto(path);
  await expect(page.getByRole('link', { name: 'Updates, 3 unread', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Updates, 3 new notifications', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark read', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Updates, 2 unread', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Updates, 2 new notifications', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await expect(page.getByText('Paper submitted.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(page.getByText('You’re all caught up.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Updates, 0 unread', exact: true })).toBeVisible();
  const updatesTab = page.getByRole('link', { name: 'Updates, 0 new notifications', exact: true });
  await expect(updatesTab).toBeVisible();
  await expect(updatesTab.locator('span.bg-red-600')).toHaveCount(0);
  expect(api.writes).toHaveLength(2);
  expect(
    api.writes.every((url) => url.endsWith('/inbox/read') || url.endsWith('/inbox/read-all')),
  ).toBe(true);
});

test('authors retain their private review inbox without conference activity', async ({ page }) => {
  await mockApi(page, { role: 'AUTHOR' });
  await page.goto(path);
  await expect(
    page.getByRole('button', { name: 'Reviews of my papers', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Conference activity' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Updates, \d+ unread/ })).toHaveCount(0);
  await expect(page.getByText('Released reviews of your papers will appear here.')).toBeVisible();
});

test('empty activity has an honest empty state', async ({ page }) => {
  await mockApi(page, { empty: true });
  await page.goto(path);
  await expect(page.getByText('No updates yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Updates, 0 unread', exact: true })).toBeVisible();
});

test('initial failure can recover without claiming an empty inbox', async ({ page }) => {
  const api = await mockApi(page, { fail: true });
  await page.goto(path);
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load updates' })).toBeVisible();
  await expect(page.getByText('No updates yet.')).toHaveCount(0);
  api.recover();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Paper submitted.', { exact: true })).toBeVisible();
});
