import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.bot.config';

export default defineConfig({
  ...browserConfig,
  testMatch: ['billing.spec.ts', 'camera-ready.spec.ts', 'student-verification.spec.ts'],
  webServer: {
    ...browserConfig.webServer,
    command: 'corepack pnpm --filter @openconferences/web exec next dev --port 3007',
    env: {
      SKIP_ENV_FILE: 'true',
      NEXT_DIST_DIR: '.next-browser-tests',
      NEXT_PUBLIC_API_URL: 'http://localhost:3007/api/v1',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    },
  },
});
