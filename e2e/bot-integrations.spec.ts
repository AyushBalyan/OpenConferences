import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { ApiIntegrationDto } from '@openconferences/schemas';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const conf = uuid(1),
  base = `/conferences/${conf}/integrations`,
  path = `/dashboard/conferences/${conf}/settings/integrations`;
const now = '2026-10-10T10:00:00.000Z';
async function fixture(page: Page, role = 'CHAIR', fail = false) {
  let items: ApiIntegrationDto[] = [],
    key = 100;
  const conference = {
    id: conf,
    organizationId: conf,
    name: 'Systems & Society 2026',
    slug: 'synthetic',
    status: 'REVIEWING',
    blindingMode: 'DOUBLE',
    version: 1,
    myRoles: [role],
  };
  const writes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      endpoint = url.pathname.replace('/api/v1', '');
    let status = 200;
    let body: unknown = { data: [], nextCursor: null };
    const method = req.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }
    if (method !== 'GET') writes.push(endpoint);
    if (endpoint.endsWith('/get-session'))
      body = {
        session: {
          id: 'fixture',
          userId: conf,
          token: 'fixture',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        user: {
          id: conf,
          name: 'Synthetic Chair',
          email: 'chair@example.test',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
    else if (endpoint.endsWith('/capabilities'))
      body = { scopes: ['papers:read', 'reviewers:read', 'assignments:read'] };
    else if (endpoint === '/auth/me')
      body = {
        id: conf,
        name: 'Synthetic Chair',
        email: 'chair@example.test',
        twoFactorEnabled: true,
      };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${conf}`) body = conference;
    else if (endpoint.endsWith('/inbox/count')) body = { unreadCount: 0 };
    else if (endpoint === base && method === 'GET') {
      body = { data: items, nextCursor: null };
      if (fail) {
        status = 503;
        body = { detail: 'Bot API is not enabled' };
      }
    } else if (endpoint === base && method === 'POST') {
      const input = req.postDataJSON();
      const g = {
        ...input,
        id: uuid(10),
        conferenceId: conf,
        status: 'ACTIVE',
        version: 0,
        authorizedByUserId: conf,
        authorizerName: 'Synthetic Chair',
        createdAt: now,
        updatedAt: now,
        purpose: input.purpose ?? null,
        keys: [],
      };
      items = [g];
      body = g;
      status = 201;
    } else if (endpoint.startsWith(base + '/')) {
      const g = items[0]!;
      if (endpoint.endsWith('/access')) body = { data: [], nextCursor: null };
      else if (endpoint.endsWith('/keys') && method === 'POST') {
        const input = req.postDataJSON();
        const k = {
          id: uuid(key++),
          label: input.label,
          scopes: input.scopes,
          createdAt: now,
          expiresAt: '2099-01-01T00:00:00.000Z',
          revokedAt: null,
          lastUsedAt: null,
        };
        g.keys.push(k);
        body = { key: k, token: `ocbot_v1.${k.id}.SYNTHETIC_SECRET_ONLY_NOT_A_VALID_CREDENTIAL` };
        status = 201;
      } else if (endpoint.includes('/keys/') && endpoint.endsWith('/revoke')) {
        g.keys.find((k) => endpoint.includes(k.id))!.revokedAt = now;
        body = g;
      } else if (endpoint.endsWith('/reauthorize')) {
        g.version++;
        g.keys.forEach((k) => (k.revokedAt = now));
        body = g;
      } else if (endpoint.endsWith('/revoke')) {
        g.version++;
        g.status = 'REVOKED';
        g.keys.forEach((k) => (k.revokedAt = now));
        body = g;
      } else if (method === 'PATCH') {
        if (req.postDataJSON().version !== g.version) {
          status = 409;
          body = { detail: 'Integration changed. Refresh and retry.' };
        } else {
          Object.assign(g, req.postDataJSON(), { version: g.version + 1 });
          body = g;
        }
      } else body = g;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return {
    writes,
    recover: () => (fail = false),
    externalChange: () => {
      items[0]!.version++;
    },
  };
}
async function create(page: Page) {
  await page.getByRole('button', { name: 'New integration', exact: true }).click();
  await page.getByLabel('Integration name').fill('Conference assistant');
  await page.getByLabel('Assignments & deadlines').check();
  await page.getByRole('button', { name: 'Create integration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conference assistant' })).toBeVisible();
}
async function issue(page: Page) {
  await page.getByRole('button', { name: 'Issue key', exact: true }).click();
  if (page.viewportSize()!.width > 390) await capture(page, 'desktop-issuance-default');
  await expect(
    page.getByRole('form', { name: 'Issue API key' }).getByLabel('Reviewer workload (aliases)'),
  ).not.toBeChecked();
  await page
    .getByRole('form', { name: 'Issue API key' })
    .getByLabel('Assignments & deadlines')
    .check();
  await page.getByLabel('Key label').fill('Report service');
  await page.getByLabel('Expires in days').fill('14');
  await page.getByRole('button', { name: 'Create key', exact: true }).click();
  await expect(page.getByLabel('Copy your key now')).toBeVisible();
}
async function capture(page: Page, name: string) {
  mkdirSync('.impeccable/review/bot-integrations', { recursive: true });
  await page.addStyleTag({ content: 'nextjs-portal {display:none !important}' });
  const saved = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const shell = main.parentElement!.parentElement!;
    const style = shell.getAttribute('style');
    main.scrollTop = 0;
    shell.setAttribute('style', 'position:relative;inset:auto;height:auto;min-height:100vh');
    return style;
  });
  await page.screenshot({
    path: `.impeccable/review/bot-integrations/${name}.png`,
    fullPage: true,
  });
  await page.evaluate((style) => {
    const shell = document.querySelector('main')!.parentElement!.parentElement!;
    if (style === null) shell.removeAttribute('style');
    else shell.setAttribute('style', style);
  }, saved);
}
test('chair creates scoped bot access, sees key once, rotates and revokes', async ({ page }) => {
  const fixtureState = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await expect(page.getByText('No bots connected')).toBeVisible();
  await create(page);
  await expect(page.getByRole('list', { name: 'Granted permissions' })).toContainText(
    'Paper metadata',
  );
  await expect(page.getByRole('list', { name: 'Granted permissions' })).toContainText(
    'Reviewer workload',
  );
  await issue(page);
  await page.getByRole('button', { name: 'Test access', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Access confirmed' })).toBeVisible();
  await capture(page, 'desktop-key');
  await page.getByRole('button', { name: 'I have saved it' }).click();
  await expect(page.getByLabel('Copy your key now')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /Conference assistant/ }).click();
  await expect(page.getByLabel('Copy your key now')).toHaveCount(0);
  await issue(page);
  await page.getByRole('button', { name: 'I have saved it' }).click();
  await expect(page.getByRole('button', { name: 'Issue key', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Revoke key', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirm revocation' }).click();
  await expect(page.getByRole('button', { name: 'Issue key', exact: true })).toBeEnabled();
  fixtureState.externalChange();
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Integration changed' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Issue key', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Edit access' }).click();
  await page.getByLabel('Author email addresses').check();
  await page.getByRole('button', { name: 'Save access' }).click();
  await expect(page.getByRole('list', { name: 'Granted permissions' })).toContainText(
    'Author email addresses',
  );
  await page.getByRole('button', { name: 'Load access log' }).click();
  await expect(page.getByText('No API requests recorded yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Authorize under my account' }).click();
  await page.getByRole('button', { name: 'Confirm authorization' }).click();
  await expect(page.getByRole('button', { name: 'Revoke key', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revoke integration', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm revocation' }).click();
  await expect(page.getByRole('button', { name: 'Issue key', exact: true })).toBeDisabled();
});
test('mobile access form fits and keyboard controls work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto(path);
  await create(page);
  await issue(page);
  await capture(page, 'mobile-key');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('Copy your key now').press('Tab');
  await expect(page.getByRole('button', { name: 'Copy key', exact: true })).toBeFocused();
});
test('reviewer is denied management and disabled feature recovers', async ({ page }) => {
  const data = await fixture(page, 'REVIEWER');
  await page.goto(path);
  await expect(page.getByText('Only organizers and chairs can manage bot access.')).toBeVisible();
  expect(data.writes).toHaveLength(0);
});
test('feature unavailable state has a working refresh', async ({ page }) => {
  const data = await fixture(page, 'ORGANIZER', true);
  await page.goto(path);
  await expect(page.getByRole('alert').filter({ hasText: 'Bot API is not enabled' })).toContainText(
    'Bot API is not enabled',
  );
  data.recover();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('No bots connected')).toBeVisible();
});
test('assignment writes require explicit grant and key permissions with read dependencies', async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.getByRole('button', { name: 'New integration', exact: true }).click();
  await page.getByLabel('Integration name').fill('Assignment assistant');
  const grant = page.getByRole('form', { name: 'New integration' });
  await expect(grant.getByLabel('Assign papers with a deadline')).not.toBeChecked();
  await grant.getByLabel('Assign papers with a deadline').check();
  for (const label of ['Paper metadata', 'Reviewer workload (aliases)', 'Assignments & deadlines'])
    await expect(grant.getByLabel(label)).toBeChecked();
  await capture(page, 'desktop-write-grant');
  await page.getByRole('button', { name: 'Create integration', exact: true }).click();
  await page.getByRole('button', { name: 'Issue key', exact: true }).click();
  const key = page.getByRole('form', { name: 'Issue API key' });
  await expect(key.getByLabel('Assign papers with a deadline')).not.toBeChecked();
  await key.getByLabel('Assign papers with a deadline').check();
  await key.getByLabel('Key label').fill('Assignment service');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'mobile-write-key');
  await key.getByLabel('Assignments & deadlines').uncheck();
  await expect(key.getByLabel('Assign papers with a deadline')).not.toBeChecked();
  await key.getByLabel('Assign papers with a deadline').check();
  await page.getByRole('button', { name: 'Create key', exact: true }).click();
  await expect(page.getByLabel('Copy your key now')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('organizer explicitly grants invitation access and selects it again for a new key', async ({
  page,
}) => {
  await fixture(page, 'ORGANIZER');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.getByRole('button', { name: 'New integration', exact: true }).click();
  const permission = page.getByLabel('Generate and remove reviewer invitations');
  await expect(permission).not.toBeChecked();
  await expect(page.getByLabel('Read reviewer invitation links')).not.toBeChecked();
  await page.getByLabel('Integration name').fill('Invitation assistant');
  await permission.check();
  for (const label of [
    'Read reviewer invitation links',
    'Reviewer workload (aliases)',
    'Reviewer names',
    'Reviewer email addresses',
  ])
    await expect(page.getByLabel(label)).toBeChecked();
  await capture(page, 'desktop-invitation-grant');
  await page.getByRole('button', { name: 'Create integration', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Granted permissions' })).toContainText(
    'Generate and remove reviewer invitations',
  );
  await page.getByRole('button', { name: 'Issue key', exact: true }).click();
  const key = page.getByRole('form', { name: 'Issue API key' });
  await expect(key.getByLabel('Generate and remove reviewer invitations')).not.toBeChecked();
  await key.getByLabel('Key label').fill('Manual invitation links');
  await key.getByLabel('Generate and remove reviewer invitations').check();
  for (const label of [
    'Read reviewer invitation links',
    'Reviewer workload (aliases)',
    'Reviewer names',
    'Reviewer email addresses',
  ])
    await expect(key.getByLabel(label)).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'mobile-invitation-key');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Create key', exact: true }).click();
  await expect(page.getByLabel('Copy your key now')).toBeVisible();
});
test('chair cannot select reviewer invitation link permissions', async ({ page }) => {
  await fixture(page, 'CHAIR');
  await page.goto(path);
  await page.getByRole('button', { name: 'New integration', exact: true }).click();
  await expect(page.getByLabel('Generate and remove reviewer invitations')).toHaveCount(0);
  await expect(page.getByLabel('Read reviewer invitation links')).toHaveCount(0);
});
