import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'analytics.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'corepack pnpm --filter @openconferences/web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
