import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';
function local(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; bot DB tests must not silently skip`);
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/bot_api_test_')
  )
    throw new Error('Only an isolated local bot_api_test_ database is permitted');
  return value;
}
const database = local('BOT_API_TEST_DATABASE_URL');
local('BOT_API_TEST_OWNER_URL');
if (!process.env.BOT_API_TEST_MARKER) throw new Error('Task-owned cluster marker required');
const redis = process.env.BOT_API_TEST_REDIS_URL;
if (!redis || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(redis).hostname))
  throw new Error('Isolated local Redis required');
Object.assign(process.env, {
  SKIP_ENV_FILE: 'true',
  SKIP_DB_ROLE_CHECK: 'false',
  ENFORCE_DB_ROLE_CHECK: 'true',
  NODE_ENV: 'test',
  DATABASE_URL: database,
  REDIS_URL: redis,
  BOT_API_ENABLED: 'true',
  BOT_API_CURSOR_SECRET: '12'.repeat(32),
  S3_ENDPOINT: 'http://127.0.0.1:1',
  S3_ACCESS_KEY: 'unused',
  S3_SECRET_KEY: 'unused',
  S3_BUCKET: 'test',
  BETTER_AUTH_SECRET: 'isolated-test-secret-not-for-real-use-123',
  BETTER_AUTH_URL: 'http://127.0.0.1:1',
  MAIL_FROM: 'test@example.com',
  SENTRY_DSN: '',
});
export default defineConfig({
  plugins: [
    swc.vite({
      configFile: false,
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
    }),
  ],
  test: {
    include: ['src/integrations/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
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
