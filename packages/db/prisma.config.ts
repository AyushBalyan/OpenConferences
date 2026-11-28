import { defineConfig } from 'prisma/config';
import { assertLocalDatabaseUrlIfSet } from '../config/src/env/local-only';

// Redesign guard: every Prisma CLI command run from this package (migrate,
// db execute, studio, ...) stops here when DATABASE_URL is not local.
// The source file is imported directly so the check works before any
// workspace package has been built. Commands that need no database, such as
// `prisma generate`, run without the variable.
assertLocalDatabaseUrlIfSet(process.env.DATABASE_URL);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
