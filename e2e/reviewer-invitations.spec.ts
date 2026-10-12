import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const conferenceId = id(1);
const path = `/dashboard/conferences/${conferenceId}/reviews/assignments/invites`;
const base = `/conferences/${conferenceId}/reviewer-invitations`;
const invitationUrl = `http://localhost:3007/sign-in?reviewerInvite=${'a'.repeat(64)}`;
const captures = '.impeccable/review/reviewer-invitations';

async function fixture(page: Page) {
  const invitations: Array<Record<string, unknown>> = [];
  const deliveries: string[] = [];
  const sends: string[] = [];
  const conference = {
    id: conferenceId,
    organizationId: conferenceId,
    name: 'Synthetic Conference',
    slug: 'synthetic',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: ['ORGANIZER', 'CHAIR'],
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace('/api/v1', '');
    let status = 200;
    let body: unknown = { data: [], nextCursor: null };
    if (endpoint.endsWith('/get-session')) {
      body = {
        session: {
          id: 'synthetic',
          userId: id(2),
          token: 'synthetic',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        user: {
          id: id(2),
          name: 'Synthetic Organizer',
          email: 'organizer@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    } else if (endpoint === '/auth/me') {
      body = {
        id: id(2),
        name: 'Synthetic Organizer',
        email: 'organizer@example.test',
        twoFactorEnabled: true,
      };
    } else if (endpoint === '/conferences') {
      body = { data: [conference], nextCursor: null };
    } else if (endpoint === `/conferences/${conferenceId}`) {
      body = conference;
    } else if (endpoint.endsWith('/inbox/count')) {
      body = { unreadCount: 0 };
    } else if (endpoint === base && req.method() === 'GET') {
      body = { data: invitations, nextCursor: null };
    } else if (endpoint === base && req.method() === 'POST') {
      const input = req.postDataJSON();
      deliveries.push(input.delivery);
      if (invitations.some((item) => item.email === input.email)) {
        status = 409;
        body = { detail: 'A pending invitation already exists for this email' };
      } else {
        const row = {
          id: id(10 + invitations.length),
          organizationId: conferenceId,
          conferenceId,
          email: input.email,
          invitedUserId: null,
          status: 'PENDING',
          roleNote: null,
          expiresAt: '2099-01-01T00:00:00.000Z',
          createdAt: '2026-10-12T10:00:00.000Z',
          updatedAt: '2026-10-12T10:00:00.000Z',
        };
        invitations.push(row);
        status = 201;
        body = { ...row, invitationUrl };
      }
    } else if (endpoint.startsWith(`${base}/`) && endpoint.endsWith('/link')) {
      body = { invitationUrl, email: invitations[0]?.email, expiresAt: '2099-01-01T00:00:00.000Z' };
    } else if (endpoint.startsWith(`${base}/`) && endpoint.endsWith('/resend')) {
      sends.push(endpoint);
      body = { invitation: invitations[0], message: 'Reviewer invitation email resent' };
    } else if (endpoint.startsWith(`${base}/`) && req.method() === 'DELETE') {
      invitations.splice(0, 1);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  return { deliveries, sends };
}

test('generates a pending invitation without email and can copy after reload or send later', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(path);
  await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test');
  await page.getByRole('button', { name: 'Generate link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No email was sent');
  await expect(page.getByLabel('Invitation link for reviewer@example.test')).toHaveValue(
    invitationUrl,
  );
  expect(state.deliveries).toEqual(['LINK_ONLY']);
  expect(state.sends).toHaveLength(0);
  await expect(page.getByRole('row').filter({ hasText: 'reviewer@example.test' })).toContainText(
    'PENDING',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Invitation link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(invitationUrl);
  await page.getByRole('button', { name: 'Send email', exact: true }).click();
  expect(state.sends).toHaveLength(1);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('No reviewer invitations yet.')).toBeVisible();
  await expect(page.getByLabel('Invitation link for reviewer@example.test')).toHaveCount(0);
});

test('sends email explicitly and reports duplicate invitations', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(path);
  await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test');
  await page.getByRole('button', { name: 'Send invitation email', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Invitation email sent to reviewer@example.test',
  );
  expect(state.deliveries).toEqual(['EMAIL']);
  await expect(page.getByLabel('Invitation link for reviewer@example.test')).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test');
  await page.getByRole('button', { name: 'Generate link', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'A pending invitation already exists' }),
  ).toBeVisible();
});

test('shows a selectable link if clipboard access fails and fits desktop and mobile', async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async () => {
        throw new Error('Clipboard unavailable');
      },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test');
  await page.getByRole('button', { name: 'Generate link', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Select and copy' })).toBeVisible();
  await expect(page.getByLabel('Invitation link for reviewer@example.test')).toHaveValue(
    invitationUrl,
  );
  await page.getByLabel('Invitation link for reviewer@example.test').focus();
  await expect(page.getByLabel('Invitation link for reviewer@example.test')).toBeFocused();
  mkdirSync(captures, { recursive: true });
  // The application scrolls within a fixed shell. Expand it only for full-content
  // evidence so mobile captures include the whole invitation ledger.
  await page.evaluate(() => {
    const main = document.querySelector('main');
    const shell = main?.closest('.fixed') as HTMLElement | null;
    if (shell) {
      shell.style.position = 'relative';
      shell.style.height = 'auto';
      shell.style.minHeight = '100dvh';
      shell.style.overflow = 'visible';
    }
    if (main) {
      main.scrollTop = 0;
      main.style.overflow = 'visible';
    }
  });
  await page.screenshot({ path: `${captures}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(page.getByRole('button', { name: 'Generate link', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `${captures}/mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Send email', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Send email', exact: true })).toBeVisible();
  await page.screenshot({ path: `${captures}/mobile-actions.png`, fullPage: true });
});
