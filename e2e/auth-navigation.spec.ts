import { expect, test, type Page } from '@playwright/test';

const conferenceId = '00000000-0000-4000-8000-000000000001';
const paperId = '00000000-0000-4000-8000-000000000002';
const userId = '00000000-0000-4000-8000-000000000003';
const destination = `/dashboard/conferences/${conferenceId}/submissions/${paperId}?section=registration`;

async function fixture(page: Page, mfa: boolean) {
  let authenticated = false;
  let invitationAccepts = 0;
  const user = {
    id: userId,
    name: 'Test Author',
    email: 'author@example.test',
    emailVerified: true,
    twoFactorEnabled: mfa,
  };
  const conference = {
    id: conferenceId,
    name: 'Test Conference',
    myRoles: ['AUTHOR'],
    status: 'FINALIZATION',
  };
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null };
    let status = 200;
    if (endpoint.endsWith('/get-session'))
      body = authenticated
        ? {
            session: { id: 'session', userId, token: 'test', expiresAt: '2099-01-01T00:00:00Z' },
            user,
          }
        : null;
    else if (endpoint.endsWith('/sign-in/email')) {
      authenticated = !mfa;
      body = mfa ? { twoFactorRedirect: true } : { redirect: false, token: 'test', user };
    } else if (endpoint.endsWith('/two-factor/send-otp')) body = { status: true };
    else if (endpoint.endsWith('/two-factor/verify-otp')) {
      authenticated = true;
      body = { token: 'test', user };
    } else if (endpoint.includes('accept-pending')) {
      invitationAccepts++;
      body = { data: [{ conferenceId: 'other-conference' }] };
    } else if (endpoint === '/auth/me') body = user;
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint.endsWith(`/papers/${paperId}`))
      body = {
        id: paperId,
        title: 'Accepted paper',
        submittedById: userId,
        status: 'DECISION_MADE',
        keywords: [],
        authorships: [],
        currentVersion: { fileAsset: { scanStatus: 'CLEAN' } },
      };
    else if (endpoint.endsWith('/decision'))
      body = { outcome: 'ACCEPT', notifiedAt: '2026-11-01T00:00:00Z' };
    else if (endpoint.endsWith('/rebuttal')) {
      status = 404;
      body = {};
    } else if (endpoint.endsWith('/registration'))
      body = {
        id: paperId,
        paperId,
        conferenceId,
        userId,
        audience: 'REGULAR',
        status: 'PENDING',
        lockedTiming: 'EARLY',
        billingName: 'Test Author',
        billingAddress: '12 Research Road',
        billingAffiliation: 'Test University',
        billingCountry: 'IN',
        amountDueMinor: 10000,
        currency: 'INR',
        deadlineAt: '2099-01-01T00:00:00Z',
      };
    await route.fulfill({ status, json: body });
  });
  return { invitationAccepts: () => invitationAccepts };
}

for (const mfa of [false, true]) {
  test(`registration email destination survives ${mfa ? 'two-factor' : 'password'} sign-in`, async ({
    page,
  }) => {
    const api = await fixture(page, mfa);
    await page.goto(destination);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get('next')).toBe(destination);
    await page.reload();
    await page.getByLabel('Email', { exact: true }).fill('author@example.test');
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    if (mfa) {
      await expect(page).toHaveURL(/\/mfa\/challenge\?next=/);
      expect(new URL(page.url()).searchParams.get('next')).toBe(destination);
      await page.reload();
      await page.getByLabel('Verification code').fill('123456');
      await page.getByRole('button', { name: 'Verify', exact: true }).click();
    }
    await expect(page).toHaveURL(`http://localhost:3007${destination}`);
    await expect(
      page.getByRole('heading', { name: 'Conference registration', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Saved registration details')).toContainText('Test University');
    expect(api.invitationAccepts()).toBe(0);
  });
}

test('sign-up and verification links preserve the registration destination', async ({ page }) => {
  await fixture(page, false);
  await page.goto(`/sign-in?next=${encodeURIComponent(destination)}`);
  await page.getByRole('link', { name: 'Sign up', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('next')).toBe(destination);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
    'href',
    `/sign-in?next=${encodeURIComponent(destination)}`,
  );
  await page.goto(`/verify-email?next=${encodeURIComponent(destination)}`);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
    'href',
    `/sign-in?next=${encodeURIComponent(destination)}`,
  );
});
