import { defineConfig, devices } from '@playwright/test';
const port = process.env.IN_APP_UPDATES_WEB_PORT ?? '3006';
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: './e2e',
  testMatch: 'in-app-updates.spec.ts',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL, ...devices['Desktop Chrome'] },
  webServer: {
    command: `corepack pnpm --filter @openconferences/web exec next dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_DIST_DIR: '.next-browser-tests',
      DATABASE_URL: 'postgresql://unused@127.0.0.1:1/in_app_updates_test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3007/api/v1',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
