import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';

/**
 * Ensure required AppConfig keys exist for tests.
 * - Local: usually filled by ../../.env
 * - CI: job env should be passed through Turbo (globalPassThroughEnv); these
 *   defaults match .github/workflows/ci.yml if a key is still missing.
 */
const testEnvDefaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://openconferences:openconferences@localhost:5432/openconferences_test',
  REDIS_URL: 'redis://localhost:6379',
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
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
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
