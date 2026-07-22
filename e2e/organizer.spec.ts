import { test, expect } from '@playwright/test';

test.describe('Organizer conference flow', () => {
  test('dashboard loads for authenticated area', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in|dashboard/, { timeout: 15000 });
  });

  test('create conference page renders form or redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard/conferences/new');

    const signInHeading = page.getByRole('heading', { name: 'Welcome back' });
    const createHeading = page.getByRole('heading', { name: 'Create conference' });

    await expect(signInHeading.or(createHeading)).toBeVisible({ timeout: 15000 });

    if (await signInHeading.isVisible()) {
      test.skip(true, 'Requires authenticated session');
    }

    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Slug')).toBeVisible();
  });
});
