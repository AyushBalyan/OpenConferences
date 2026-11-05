import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import PgBoss from 'pg-boss';
import { prisma, prismaQueueAdapter, withTenantContext } from '@openconferences/db';

it('owner provisions the recovery queue; the restricted worker can bootstrap and enqueue without table ownership', async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_test'))
    throw new Error('This test requires an isolated local test database');
  const boss = new PgBoss({ connectionString: url.href });
  await boss.start();
  try {
    await prisma.$executeRawUnsafe("DELETE FROM pgboss.job WHERE name='student.scan-recovery'");
    await boss.deleteQueue('student.scan-recovery');
    // Match production's existing runtime DML grants after pg-boss bootstrap.
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO openconferences_worker',
    );
    await prisma.$executeRawUnsafe('GRANT CREATE ON SCHEMA pgboss TO openconferences_worker');
    await prisma.$executeRawUnsafe('GRANT REFERENCES ON pgboss.queue TO openconferences_worker');
    await expect(
      withTenantContext({}, async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
        await tx.$executeRawUnsafe(
          "SELECT pgboss.create_queue('student.scan-recovery', '{}'::json)",
        );
      }),
    ).rejects.toThrow('must be owner of table job');
    const migration = readFileSync(
      new URL(
        '../../../../packages/db/prisma/migrations/20261105090000_provision_student_scan_recovery_queue/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await prisma.$executeRawUnsafe(migration);
    await prisma.$executeRawUnsafe(migration);
    const job = await withTenantContext({}, async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
      await tx.$executeRawUnsafe("SELECT pgboss.create_queue('student.scan-recovery', '{}'::json)");
      return boss.send('student.scan-recovery', {}, { db: prismaQueueAdapter(tx) });
    });
    expect(job).toBeTruthy();
    const roles = await prisma.$queryRaw<
      Array<{ rolsuper: boolean; rolbypassrls: boolean }>
    >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='openconferences_worker'`;
    expect(roles[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  } finally {
    await boss.stop();
  }
});
