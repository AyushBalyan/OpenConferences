import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.bot.config';

export default defineConfig({
  ...browserConfig,
  testMatch: 'decisions.spec.ts',
});
