import { test, expect } from '@playwright/test';

test('home page loads and shows API health or graceful error', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OpenConferences' })).toBeVisible();
  await expect(page.getByText('API Health')).toBeVisible();
});
