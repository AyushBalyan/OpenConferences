import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';

export default defineConfig({
  plugins: [swc.vite()],
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
