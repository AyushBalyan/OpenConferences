import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @openconferences/api dev',
      url: 'http://localhost:3001/api/v1/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        TURNSTILE_SECRET_KEY: '',
      },
    },
    {
      command: 'pnpm --filter @openconferences/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      },
    },
  ],
});
