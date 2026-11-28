import baseConfig from './packages/config/eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: [
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
      'apps/web-v2/.next/**',
      'apps/web-v2/next-env.d.ts',
      'packages/db/prisma/**',
    ],
  },
];
