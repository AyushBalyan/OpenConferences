// Explicit owner bootstrap for a newly created disposable integration-test DB.
// Never loads shared .env files and never migrates or resets a database.
import { createRequire } from 'node:module';
import { assertLocalDatabaseUrl, assertTestMarker } from './local-test-target.mjs';
const database = assertLocalDatabaseUrl(process.env.DATABASE_URL);
const marker = assertTestMarker(process.env.LOCAL_TEST_DATABASE_MARKER);
if (process.env.LOCAL_TEST_ALLOW_SETUP !== 'true')
  throw new Error('Explicit LOCAL_TEST_ALLOW_SETUP=true is required for the task-owned database');
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const client = new PrismaClient({ datasourceUrl: database.toString() });
try {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS local_test');
    await tx.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS local_test.task_marker (id text PRIMARY KEY)',
    );
    const rows = await tx.$queryRawUnsafe('SELECT id FROM local_test.task_marker');
    if (rows.length && !(rows.length === 1 && rows[0].id === marker))
      throw new Error('Test database belongs to another task');
    if (!rows.length)
      await tx.$executeRaw`INSERT INTO local_test.task_marker(id) VALUES (${marker})`;
  });
  console.log('Task-owned local integration database marker verified');
} finally {
  await client.$disconnect();
}
