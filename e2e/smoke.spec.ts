import { test, expect } from '@playwright/test';

test('home page loads marketing landing', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /One conference/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});
