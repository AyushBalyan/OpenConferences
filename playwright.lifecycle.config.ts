import { defineConfig, devices } from '@playwright/test';

// UI contract tests only: all API/auth responses are intercepted by fixtures.
// No API, database, queue, storage service or mail worker is started.
export default defineConfig({
  testDir: './e2e/lifecycle',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'pnpm --filter @openconferences/web exec next dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101/api/v1',
      NEXT_DIST_DIR: '.next-browser-tests',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
