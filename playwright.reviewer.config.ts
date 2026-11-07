import { defineConfig, devices } from '@playwright/test';
// Browser-only fixtures; never loads API credentials or connects to a database.
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'reviewer-operations.spec.ts',
    'in-app-updates.spec.ts',
    'reviewer-invitations.spec.ts',
    'review-coordination.spec.ts',
  ],
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3008', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'corepack pnpm --filter @openconferences/web exec next dev --port 3008',
    url: 'http://localhost:3008/reviewer-invite/decline',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      SKIP_ENV_FILE: 'true',
      NEXT_DIST_DIR: '.next-reviewer-test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3008/api/v1',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
