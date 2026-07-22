import { test, expect } from '@playwright/test';

test('home page loads marketing landing', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OpenConferences' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});
