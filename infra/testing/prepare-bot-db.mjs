// This deliberately never loads repository .env files.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const urls = ['BOT_API_TEST_OWNER_URL', 'BOT_API_TEST_DATABASE_URL'].map((name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/bot_api_test_')
  )
    throw new Error('Only task-owned local bot_api_test_ databases are permitted');
  return url;
});
if (
  urls[0].host !== urls[1].host ||
  urls[0].pathname !== urls[1].pathname ||
  urls[0].username === urls[1].username
)
  throw new Error('Owner and restricted runtime must address the same isolated local DB');
const marker = process.env.BOT_API_TEST_MARKER;
if (!marker || !/^[a-zA-Z0-9:_-]{8,100}$/.test(marker))
  throw new Error('Explicit task-owned marker required');
if (process.env.BOT_API_TEST_ALLOW_MIGRATIONS !== 'true')
  throw new Error('Set BOT_API_TEST_ALLOW_MIGRATIONS=true only for a disposable local database');
const { PrismaClient } = require('@prisma/client');
const owner = new PrismaClient({ datasourceUrl: urls[0].toString() });
try {
  await owner.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS bot_test');
  await owner.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS bot_test.bot_api_test_marker (id text PRIMARY KEY)',
  );
  const existing = await owner.$queryRawUnsafe('SELECT id FROM bot_test.bot_api_test_marker');
  if (existing.length && !(existing.length === 1 && existing[0].id === marker))
    throw new Error('Database belongs to another task');
  if (!existing.length)
    await owner.$executeRaw`INSERT INTO bot_test.bot_api_test_marker(id) VALUES (${marker})`;
  // Match the normal deployment bootstrap: a fresh database needs pgboss
  // before migrations grant permissions on it. Keep the SQL in one place.
  const steps = [
    ['db', 'execute', '--file', 'prisma/predeploy.sql', '--schema', 'prisma/schema.prisma'],
    ['migrate', 'deploy'],
  ];
  for (const args of steps) {
    const result = spawnSync(
      'corepack',
      ['pnpm', '--filter', '@openconferences/db', 'exec', 'prisma', ...args],
      {
        stdio: 'inherit',
        env: { ...process.env, SKIP_ENV_FILE: 'true', DATABASE_URL: urls[0].toString() },
      },
    );
    if (result.status !== 0) throw new Error(`Local bot database setup failed: ${args[0]}`);
  }
  await owner.$executeRawUnsafe('GRANT USAGE ON SCHEMA bot_test TO openconferences_api');
  await owner.$executeRawUnsafe(
    'GRANT SELECT ON bot_test.bot_api_test_marker TO openconferences_api',
  );
  console.log(
    'Isolated bot test database prepared; runtime login credentials must be provisioned separately.',
  );
} finally {
  await owner.$disconnect();
}
