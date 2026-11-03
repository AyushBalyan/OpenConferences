import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.billing.config';
export default defineConfig({ ...browserConfig, testMatch: 'cfp.spec.ts' });
