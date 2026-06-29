import baseConfig from './packages/config/eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: ['apps/web/.next/**', 'apps/web/next-env.d.ts', 'packages/db/prisma/**'],
  },
];
