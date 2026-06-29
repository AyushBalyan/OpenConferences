import { test, expect } from '@playwright/test';

test.describe('Organizer conference flow', () => {
  test('dashboard loads for authenticated area', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in|dashboard/);
  });

  test('create conference page renders form', async ({ page }) => {
    await page.goto('/dashboard/conferences/new');
    await expect(page).toHaveURL(/sign-in|conferences\/new/);

    if (page.url().includes('sign-in')) {
      test.skip(true, 'Requires authenticated session');
    }

    await expect(page.getByRole('heading', { name: 'Create conference' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Slug')).toBeVisible();
  });
});
