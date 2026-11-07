import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';
import {
  assertLocalDatabaseUrl,
  assertLocalRedisUrl,
  assertTestMarker,
} from '../../infra/testing/local-test-target.mjs';

// Destructive integration fixtures must never inherit a developer's shared DB.
assertLocalDatabaseUrl(process.env.DATABASE_URL);
assertLocalRedisUrl(process.env.REDIS_URL);
assertTestMarker(process.env.LOCAL_TEST_DATABASE_MARKER);
for (const name of [
  'ANALYTICS_TEST_DATABASE_URL',
  'IN_APP_UPDATES_TEST_DATABASE_URL',
  'REVIEW_LOCK_TEST_DATABASE_URL',
  'REVIEWER_OVERVIEW_TEST_DATABASE_URL',
]) {
  if (process.env[name]) assertLocalDatabaseUrl(process.env[name]);
}

process.env.SKIP_ENV_FILE = 'true';
process.env.NODE_ENV = 'test';

/** Other service defaults are synthetic; database/Redis targets and ownership
 * are always explicit and validated before any test fixture is imported. */
const testEnvDefaults: Record<string, string> = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_BUCKET: 'openconferences',
  S3_REGION: 'us-east-1',
  S3_FORCE_PATH_STYLE: 'true',
  API_PORT: '3001',
  CORS_ORIGINS: 'http://localhost:3000',
  WEB_URL: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
  BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
  BETTER_AUTH_URL: 'http://localhost:3001',
  MAIL_FROM: 'noreply@example.com',
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

export default defineConfig({
  // Do not load Nest's CommonJS .swcrc — Vitest must stay ESM.
  plugins: [
    swc.vite({
      configFile: false,
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        keepClassNames: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['src/integrations/**/*.integration.test.ts'],
    globalSetup: ['./test/setup/local-database.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@openconferences/config/env': path.resolve(
        __dirname,
        '../../packages/config/src/env/index.ts',
      ),
      '@openconferences/contracts': path.resolve(
        __dirname,
        '../../packages/contracts/src/index.ts',
      ),
      '@openconferences/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@openconferences/schemas': path.resolve(__dirname, '../../packages/schemas/src/index.ts'),
    },
  },
});
