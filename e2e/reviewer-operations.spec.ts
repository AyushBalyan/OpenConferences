import { test, expect } from '@playwright/test';
const token = '11111111-1111-4111-8111-111111111111.' + 'a'.repeat(64);
test('decline is explicit, Go back leaves it unchanged, and tokens never reach tracking', async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  let confirmations = 0;
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/api/v1/reviewer-invitations/public/**', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.token).toBe(token);
    const confirm = route.request().url().endsWith('/decline');
    if (confirm) {
      confirmations++;
      expect(body.reason).toBeUndefined();
    }
    await route.fulfill({
      json: {
        state: confirm ? 'DECLINED' : 'SENT',
        conferenceName: 'Research conference',
        ...(confirm ? { confirmed: true } : {}),
      },
    });
  });
  await page.goto('/reviewer-invite/decline#token=' + token);
  await expect(page.getByText('Decline reviewer invitation?', { exact: true })).toBeVisible();
  expect(confirmations).toBe(0);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByText('Your invitation is unchanged', { exact: true })).toBeVisible();
  expect(confirmations).toBe(0);
  await page.getByRole('button', { name: 'Return to confirmation' }).click();
  await page.getByRole('button', { name: 'Confirm decline', exact: true }).click();
  await expect(page.getByText('Thank you for your time', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Your invitation has been declined. No further action is needed.'),
  ).toBeVisible();
  expect(confirmations).toBe(1);
  expect(requests.filter((url) => /umami|api\/auth/.test(url))).toEqual([]);
  expect(requests.filter((url) => url.includes(token))).toEqual([]);
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
  await page.screenshot({
    path: testInfo.outputPath('reviewer-declined-desktop.png'),
    fullPage: true,
  });
});
test('mobile confirmation remains readable and supports an optional reason', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/reviewer-invitations/public/**', async (route) => {
    const confirm = route.request().url().endsWith('/decline');
    if (confirm) expect(route.request().postDataJSON().reason).toBe('Unavailable this month');
    await route.fulfill({
      json: {
        state: confirm ? 'DECLINED' : 'SENT',
        conferenceName: 'Research conference',
        ...(confirm ? { confirmed: true } : {}),
      },
    });
  });
  await page.goto('/reviewer-invite/decline#token=' + token);
  await page.getByLabel('Reason (optional)').fill('Unavailable this month');
  await expect(page.getByRole('button', { name: 'Confirm decline', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('reviewer-decline-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Confirm decline', exact: true }).click();
  await expect(page.getByText('Thank you for your time', { exact: true })).toBeVisible();
});
for (const [state, message] of [
  ['EXPIRED', 'This invitation has expired.'],
  ['ACCEPTED', 'This invitation has already been accepted.'],
  ['DECLINED', 'This invitation has already been declined.'],
  ['REVOKED', 'This invitation is no longer available.'],
  ['INVALID', 'This invitation link is invalid or has been replaced.'],
] as const) {
  test(`shows a calm ${state.toLowerCase()} state without a confirmation action`, async ({
    page,
  }) => {
    await page.route('**/api/v1/reviewer-invitations/public/status', (route) =>
      route.fulfill({
        json: { state, conferenceName: state === 'INVALID' ? null : 'Research conference' },
      }),
    );
    await page.goto('/reviewer-invite/decline#token=' + token);
    await expect(page.getByRole('status')).toContainText(message);
    await expect(page.getByRole('button', { name: 'Confirm decline' })).toHaveCount(0);
  });
}
test('recovers from a temporary lookup error', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/v1/reviewer-invitations/public/status', (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { state: 'SENT', conferenceName: 'Research conference' } }),
  );
  await page.goto('/reviewer-invite/decline#token=' + token);
  await expect(page.getByRole('alert').filter({ hasText: 'could not be checked' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Confirm decline', exact: true })).toBeVisible();
});
