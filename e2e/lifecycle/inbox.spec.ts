import { test, expect, type Page } from '@playwright/test';

const conferenceId = '00000000-0000-4000-8000-000000000001';
const sourceId = '00000000-0000-4000-8000-000000000002';
const url = `/dashboard/conferences/${conferenceId}/inbox`;

async function fixture(page: Page) {
  const state = {
    version: 1,
    readVersion: 0,
    failList: false,
    failRead: false,
    acknowledgements: [] as unknown[],
  };
  const conference = {
    id: conferenceId,
    name: 'Browser test conference',
    slug: 'browser-test',
    status: 'REVIEWING',
    myRoles: ['AUTHOR', 'REVIEWER'],
  };
  await page.route('**/*', async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin === 'http://127.0.0.1:3100') return route.continue();
    if (target.origin !== 'http://127.0.0.1:3101') return route.abort();
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:3100',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    if (target.pathname.endsWith('/auth/get-session'))
      return respond({
        session: { id: 'test-session', userId: sourceId, expiresAt: '2099-01-01T00:00:00.000Z' },
        user: {
          id: sourceId,
          name: 'Test participant',
          email: 'participant@example.test',
          emailVerified: true,
        },
      });
    if (target.pathname === '/api/v1/conferences')
      return respond({ data: [conference], nextCursor: null });
    if (target.pathname === `/api/v1/conferences/${conferenceId}`) return respond(conference);
    if (target.pathname.endsWith('/inbox/read')) {
      state.acknowledgements.push(request.postDataJSON());
      if (state.failRead) return respond({ detail: 'Test failure' }, 503);
      state.readVersion = request.postDataJSON().version;
      return respond({ read: true });
    }
    if (target.pathname.endsWith('/inbox')) {
      if (state.failList) return respond({ detail: 'Test failure' }, 503);
      const response = target.searchParams.get('kind') === 'REBUTTAL';
      return respond({
        data: [
          {
            id: sourceId,
            kind: response ? 'REBUTTAL' : 'REVIEW',
            version: state.version,
            title: response
              ? 'Response to reviewer feedback'
              : 'A paper with newly released feedback',
            updatedAt: '2026-09-24T09:00:00.000Z',
            unread: state.readVersion < state.version,
            href: response
              ? `/dashboard/conferences/${conferenceId}/reviews/assignments/${sourceId}?section=response`
              : `/dashboard/conferences/${conferenceId}/submissions/${sourceId}?section=reviews&round=${sourceId}`,
          },
        ],
        nextCursor: null,
      });
    }
    return respond({ detail: 'Unconfigured test endpoint' }, 404);
  });
  return state;
}

test('read state survives reload and a newer version becomes unread', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Updates', exact: true })).toBeVisible();
  await expect(page.getByText('1 unread on this page.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open reviews' })).toHaveAttribute(
    'href',
    /section=reviews&round=/,
  );
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toHaveCount(0);
  expect(state.acknowledgements).toEqual([{ kind: 'REVIEW', sourceId, version: 1 }]);
  await page.reload();
  await expect(page.getByText('0 unread on this page.', { exact: false })).toBeVisible();
  state.version = 2;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Author responses', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open response', exact: true })).toHaveAttribute(
    'href',
    /section=response$/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('failed acknowledgement stays unread and can be retried', async ({ page }) => {
  const state = await fixture(page);
  state.failRead = true;
  await page.goto(url);
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not mark this update read' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeEnabled();
  state.failRead = false;
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await expect(page.getByText('0 unread on this page.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not mark this update read' }),
  ).toHaveCount(0);
});

test('load failure is not presented as an empty inbox', async ({ page }) => {
  const state = await fixture(page);
  state.failList = true;
  await page.goto(url);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load your updates' }),
  ).toBeVisible();
  await expect(page.getByText(/No released reviews are/)).toHaveCount(0);
  state.failList = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeVisible();
});
