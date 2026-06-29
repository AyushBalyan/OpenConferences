import { test, expect } from '@playwright/test';

const testEmail = `e2e-${Date.now()}@example.com`;
const testPassword = 'E2ePassword123!';
const testName = 'E2E Test User';

test.describe('Auth walking skeleton', () => {
  test('signup page loads', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  });

  test('sign-in page loads', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('signup -> verify message -> sign-in navigation', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel('Full name').fill(testName);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL(/verify-email/);
    await expect(page.getByText('We sent a verification link to your email.')).toBeVisible();

    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});
