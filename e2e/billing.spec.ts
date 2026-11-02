import { expect, test, type Page } from '@playwright/test';

const conferenceId = '00000000-0000-4000-8000-000000000001';
const paperId = '00000000-0000-4000-8000-000000000002';
const userId = '00000000-0000-4000-8000-000000000003';
const path = `/dashboard/conferences/${conferenceId}/submissions/${paperId}?section=registration`;

async function fixture(
  page: Page,
  mode: 'success' | 'cancel' | 'failure' | 'pending' | 'invalid' = 'success',
) {
  const verificationBodies: unknown[] = [];
  let orders = 0;
  const quote = {
    amountMinor: 5000,
    regularAmountMinor: 5000,
    currency: 'USD',
    timing: 'EARLY',
    isAdditionalPaper: true,
  };
  const registration = {
    id: paperId,
    paperId,
    conferenceId,
    userId,
    audience: 'REGULAR',
    billingCountry: 'US',
    billingAffiliation: 'Test University',
    status: 'PENDING',
    amountDueMinor: 0,
    currency: 'USD',
    lockedTiming: null as string | null,
    deadlineAt: '2099-11-25T12:00:00Z',
    isAdditionalPaper: false,
    paymentQuote: quote as typeof quote | null,
    earlyBirdEndsAt: '2026-11-19T18:30:00Z',
  };
  const conference = {
    id: conferenceId,
    name: 'Registration test conference',
    myRoles: ['AUTHOR'],
    status: 'FINALIZATION',
  };
  await page.route('https://checkout.razorpay.com/v1/checkout.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
      window.Razorpay = class {
        constructor(options) { this.options = options; }
        on(event, handler) { this.failed = handler; }
        open() {
          if (${JSON.stringify(mode)} === 'cancel') this.options.modal.ondismiss();
          else if (${JSON.stringify(mode)} === 'failure') { this.failed(); this.options.modal.ondismiss(); }
          else this.options.handler({ razorpay_order_id: 'order_Test123', razorpay_payment_id: 'pay_Test123', razorpay_signature: '${'a'.repeat(64)}' });
        }
      };
    `,
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = { data: [], nextCursor: null };
    let status = 200;
    if (endpoint.endsWith('/get-session'))
      body = {
        session: { id: 'session', userId, token: 'test', expiresAt: '2099-01-01T00:00:00Z' },
        user: {
          id: userId,
          name: 'Test Author',
          email: 'author@example.test',
          emailVerified: true,
        },
      };
    else if (endpoint === '/auth/me')
      body = { id: userId, name: 'Test Author', email: 'author@example.test' };
    else if (endpoint === '/conferences') body = { data: [conference], nextCursor: null };
    else if (endpoint === `/conferences/${conferenceId}`) body = conference;
    else if (endpoint.endsWith(`/papers/${paperId}`))
      body = {
        id: paperId,
        title: 'Reliable conference workflows',
        submittedById: userId,
        status: 'DECISION_MADE',
        keywords: [],
        authorships: [],
        currentVersion: { fileAsset: { scanStatus: 'CLEAN' } },
      };
    else if (endpoint.endsWith('/decision'))
      body = { outcome: 'ACCEPT', rationale: 'Accepted.', notifiedAt: '2026-11-01T00:00:00Z' };
    else if (endpoint.endsWith('/rebuttal')) {
      status = 404;
      body = {};
    } else if (endpoint.endsWith('/registration/payment/verify')) {
      verificationBodies.push(route.request().postDataJSON());
      if (mode === 'invalid') {
        status = 400;
        body = { detail: 'Invalid signature' };
      } else {
        if (mode !== 'pending') registration.status = 'PAID';
        body = { verified: true, captured: mode !== 'pending', registration };
      }
    } else if (endpoint.endsWith('/registration/payment')) {
      orders += 1;
      Object.assign(registration, {
        amountDueMinor: 5000,
        lockedTiming: 'EARLY',
        isAdditionalPaper: true,
        paymentQuote: null,
      });
      body = {
        paymentId: paperId,
        provider: 'razorpay',
        keyId: 'test-public-key',
        orderId: 'order_Test123',
        amountMinor: 5000,
        currency: 'USD',
        registration,
      };
    } else if (endpoint.endsWith('/registration')) {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON();
        Object.assign(registration, input);
        status = 201;
        registration.paymentQuote = {
          ...quote,
          amountMinor: input.billingCountry === 'IN' ? 400000 : 5000,
          currency: input.billingCountry === 'IN' ? 'INR' : 'USD',
        };
      }
      body = registration;
    }
    await route.fulfill({ status, json: body });
  });
  return { verificationBodies, orders: () => orders };
}

test('verifies the checkout result before showing the paper as paid', async ({ page }) => {
  const api = await fixture(page);
  await page.goto(path);
  await expect(page.getByText('5,000.00 USD')).toHaveCount(0);
  await expect(page.getByText('50.00 USD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();
  await expect(page.getByText('Registration complete.', { exact: true })).toBeVisible();
  expect(api.verificationBodies).toEqual([
    {
      razorpay_order_id: 'order_Test123',
      razorpay_payment_id: 'pay_Test123',
      razorpay_signature: 'a'.repeat(64),
    },
  ]);
  expect(api.orders()).toBe(1);
});

test('requires saving a country change and displays the INR quote', async ({ page }) => {
  await fixture(page);
  await page.goto(path);
  await page.getByLabel('Billing country').selectOption('IN');
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save registration details' }).click();
  await expect(page.getByText('4,000.00 INR', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toBeEnabled();
});

for (const mode of ['cancel', 'failure', 'pending', 'invalid'] as const) {
  test(`handles ${mode} without claiming registration is paid`, async ({ page }) => {
    const api = await fixture(page, mode);
    await page.goto(path);
    await page.getByRole('button', { name: 'Pay now', exact: true }).click();
    await expect(page.getByText('Registration complete.', { exact: true })).toHaveCount(0);
    if (mode === 'cancel') await expect(page.getByText(/Checkout closed/)).toBeVisible();
    if (mode === 'failure')
      await expect(page.getByRole('alert').filter({ hasText: 'Payment failed' })).toContainText(
        'Payment failed',
      );
    if (mode === 'pending') await expect(page.getByText(/Confirmation is pending/)).toBeVisible();
    if (mode === 'invalid')
      await expect(
        page.getByRole('alert').filter({ hasText: 'could not be confirmed' }),
      ).toContainText('could not be confirmed');
    expect(api.verificationBodies).toHaveLength(mode === 'cancel' || mode === 'failure' ? 0 : 1);
  });
}

test('registration remains readable at desktop and mobile widths', async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto(path);
  await expect(page.getByLabel('Billing country')).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByText('50.00 USD', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`registration-${width}.png`),
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole('button', { name: 'Pay now', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath('registration-mobile-payment.png'),
      });
    }
  }
});

test('organizers can apply the fee preset and save the conversion rate and cutoff', async ({
  page,
}, testInfo) => {
  await fixture(page);
  const conference = {
    id: conferenceId,
    organizationId: conferenceId,
    name: 'Registration test conference',
    myRoles: ['ORGANIZER'],
    status: 'FINALIZATION',
    blindingMode: 'DOUBLE',
    version: 1,
    feeSchedule: {
      currency: 'INR',
      matrix: { REGULAR: { EARLY: 0, REGULAR: 0 }, STUDENT: { EARLY: 0, REGULAR: 0 } },
    },
  };
  let saved: { feeSchedule: Record<string, unknown> } | null = null;
  await page.route(`**/api/v1/conferences/${conferenceId}`, (route) =>
    route.fulfill({ json: conference }),
  );
  await page.route(`**/api/v1/conferences/${conferenceId}/settings`, async (route) => {
    saved = route.request().postDataJSON();
    Object.assign(conference, saved);
    await route.fulfill({ json: conference });
  });
  await page.goto(`/dashboard/conferences/${conferenceId}/settings/fees`);
  await page.getByRole('button', { name: 'Use November 2026 USD fees' }).click();
  await page.getByLabel('INR per USD for Indian authors').fill('83.27');
  await page.getByRole('button', { name: 'Save fees', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  expect(saved).toMatchObject({
    feeSchedule: {
      currency: 'USD',
      additionalPaperMinor: 5000,
      domesticInrPerUsd: 83.27,
      earlyBirdEndsAt: '2026-11-19T18:30:00.000Z',
      matrix: {
        REGULAR: { EARLY: 12500, REGULAR: 15000 },
        STUDENT: { EARLY: 7500, REGULAR: 10000 },
      },
    },
  });
  await expect(page.getByLabel('INR per USD for Indian authors')).toHaveValue('83.27');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel('INR per USD for Indian authors').scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`fee-settings-${width}.png`) });
  }
});
