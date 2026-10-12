import { defineConfig, devices } from '@playwright/test';
// Browser-only fixtures. No API process, .env loader, or database connection.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'bot-integrations.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3007', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'corepack pnpm --filter @openconferences/web exec next dev --port 3007',
    url: 'http://localhost:3007',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      SKIP_ENV_FILE: 'true',
      NEXT_PUBLIC_API_URL: 'http://localhost:3007/api/v1',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
