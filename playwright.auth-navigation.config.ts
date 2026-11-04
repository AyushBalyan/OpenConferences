import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.bot.config';

export default defineConfig({ ...browserConfig, testMatch: 'auth-navigation.spec.ts' });
