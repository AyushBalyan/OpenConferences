import { defineConfig } from '@playwright/test';
import browserOnlyConfig from './playwright.bot.config';

// Same isolated browser-only server; all API requests use synthetic fixtures.
export default defineConfig({ ...browserOnlyConfig, testMatch: 'reviewer-invitations.spec.ts' });
