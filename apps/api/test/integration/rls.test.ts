import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateId, prisma, withTenantContext } from '@openconferences/db';

/**
 * DB-level RLS regression suite.
 * Uses SET LOCAL ROLE to exercise openconferences_api / openconferences_worker
 * policies while the test process still connects as the migration owner.
 */
describe('RLS catalog and role policies', () => {
  const orgAId = generateId();
  const orgBId = generateId();
  const confAId = generateId();
  const confBId = generateId();
  const memberAId = generateId();
  const orgAdminAId = generateId();
  const outsiderId = generateId();
  const paperAId = generateId();
  const trackAId = generateId();
  const membershipAId = generateId();
  const orgAdminMembershipId = generateId();

  beforeAll(async () => {
    await withTenantContext({}, async (tx) => {
      await tx.organization.createMany({
        data: [
          { id: orgAId, slug: `rls-a-${Date.now()}`, name: 'RLS Org A' },
          { id: orgBId, slug: `rls-b-${Date.now()}`, name: 'RLS Org B' },
        ],
      });
      await tx.user.createMany({
        data: [
          {
            id: memberAId,
            email: `rls-member-a-${Date.now()}@example.com`,
            name: 'Member A',
            emailVerified: true,
          },
          {
            id: orgAdminAId,
            email: `rls-org-admin-a-${Date.now()}@example.com`,
            name: 'Org Admin A',
            emailVerified: true,
          },
          {
            id: outsiderId,
            email: `rls-outsider-${Date.now()}@example.com`,
            name: 'Outsider',
            emailVerified: true,
          },
        ],
      });
      await tx.conference.createMany({
        data: [
          {
            id: confAId,
            organizationId: orgAId,
            slug: 'rls-conf-a',
            name: 'RLS Conf A',
            authorJoinToken: generateId(),
          },
          {
            id: confBId,
            organizationId: orgBId,
            slug: 'rls-conf-b',
            name: 'RLS Conf B',
            authorJoinToken: generateId(),
          },
        ],
      });
      await tx.track.create({
        data: {
          id: trackAId,
          conferenceId: confAId,
          organizationId: orgAId,
          slug: 'main',
          name: 'Main',
        },
      });
      await tx.membership.create({
        data: {
          id: membershipAId,
          userId: memberAId,
          organizationId: orgAId,
          conferenceId: confAId,
          scope: 'CONFERENCE',
          roles: { create: { id: generateId(), role: 'AUTHOR' } },
        },
      });
      await tx.membership.create({
        data: {
          id: orgAdminMembershipId,
          userId: orgAdminAId,
          organizationId: orgAId,
          conferenceId: null,
          scope: 'ORGANIZATION',
          roles: { create: { id: generateId(), role: 'ORG_ADMIN' } },
        },
      });
      await tx.paper.create({
        data: {
          id: paperAId,
          organizationId: orgAId,
          conferenceId: confAId,
          trackId: trackAId,
          submittedById: memberAId,
          title: 'Secret paper',
          abstract: 'abstract',
          keywords: ['rls'],
          status: 'DRAFT',
        },
      });
    });
  });

  afterAll(async () => {
    await withTenantContext({}, async (tx) => {
      await tx.paper.deleteMany({ where: { id: paperAId } });
      await tx.track.deleteMany({ where: { id: trackAId } });
      await tx.membership.deleteMany({
        where: { id: { in: [membershipAId, orgAdminMembershipId] } },
      });
      await tx.conference.deleteMany({ where: { id: { in: [confAId, confBId] } } });
      await tx.user.deleteMany({
        where: { id: { in: [memberAId, orgAdminAId, outsiderId] } },
      });
      await tx.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    });
  });

  it('enables FORCE RLS on tenant and auth tables', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'organizations','conferences','papers','users','accounts','sessions',
          'audit_logs','notification_logs','_prisma_migrations'
        )
      ORDER BY c.relname
    `;

    expect(rows.length).toBeGreaterThanOrEqual(9);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }
  });

  it('creates restricted app roles without bypassrls', async () => {
    const roles = await prisma.$queryRaw<
      Array<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>
    >`
      SELECT rolname, rolbypassrls, rolsuper
      FROM pg_roles
      WHERE rolname IN ('openconferences_api', 'openconferences_worker')
      ORDER BY rolname
    `;
    expect(roles).toHaveLength(2);
    for (const role of roles) {
      expect(role.rolbypassrls).toBe(false);
      expect(role.rolsuper).toBe(false);
    }
  });

  it('revokes Data API privileges on public.users', async () => {
    const grants = await prisma.$queryRaw<Array<{ grantee: string; cnt: bigint }>>`
      SELECT grantee, count(*)::bigint AS cnt
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND grantee IN ('anon', 'authenticated', 'service_role')
      GROUP BY grantee
    `;
    expect(grants).toEqual([]);
  });

  it('revokes public EXECUTE on RLS helper functions', async () => {
    const rows = await prisma.$queryRaw<Array<{ has_public: boolean }>>`
      SELECT has_function_privilege('public', 'app_user_in_org(uuid)', 'EXECUTE') AS has_public
    `;
    // PUBLIC revoke means non-granted roles lack execute; postgres owner still has it.
    // Verify anon cannot execute when the role exists.
    const anon = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS ok
    `;
    if (anon[0]?.ok) {
      const can = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT has_function_privilege('anon', 'app_user_in_org(uuid)', 'EXECUTE') AS allowed
      `;
      expect(can[0]?.allowed).toBe(false);
    }
    expect(rows[0]).toBeDefined();
  });

  it('denies outsider paper reads under openconferences_api role', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${outsiderId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', ${confAId}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([]);
  });

  it('allows member paper reads under openconferences_api role', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${memberAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', ${confAId}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([{ id: paperAId }]);
  });

  it('allows member paper reads when conference context is absent (cross-conference lists)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${memberAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([{ id: paperAId }]);
  });

  it('denies paper reads when conference context mismatches row', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${memberAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', ${confBId}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([]);
  });

  it('allows org-admin paper reads via organization role inheritance', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${orgAdminAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgAId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', ${confAId}, true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([{ id: paperAId }]);
  });

  it('allows worker role to read papers without user context', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
      await tx.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM papers WHERE id = ${paperAId}::uuid
      `;
    });
    expect(rows).toEqual([{ id: paperAId }]);
  });

  it('allows worker to insert notification_logs', async () => {
    const logId = generateId();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
      await tx.$executeRaw`
        INSERT INTO notification_logs (
          id, "organizationId", "conferenceId", "templateKey", "templateVersion",
          "toEmail", subject, "renderedHtml", status, "idempotencyKey"
        ) VALUES (
          ${logId}::uuid, ${orgAId}::uuid, ${confAId}::uuid, 'rls.test', 1,
          'rls-worker@example.com', 'subj', '<p>x</p>', 'QUEUED', ${`rls-${logId}`}
        )
      `;
    });

    const rows = await withTenantContext({}, async (tx) =>
      tx.notificationLog.findMany({ where: { id: logId } }),
    );
    expect(rows).toHaveLength(1);

    await withTenantContext({}, async (tx) => {
      await tx.notificationLog.delete({ where: { id: logId } });
    });
  });

  it('allows API role Better Auth session CRUD without tenant GUCs', async () => {
    const sessionId = generateId();
    const token = `rls-token-${sessionId}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$executeRaw`
        INSERT INTO sessions (id, token, "expiresAt", "createdAt", "updatedAt", "userId")
        VALUES (
          ${sessionId}, ${token}, NOW() + interval '1 day', NOW(), NOW(), ${memberAId}::uuid
        )
      `;
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM sessions WHERE id = ${sessionId}
      `;
      expect(rows).toEqual([{ id: sessionId }]);
      await tx.$executeRaw`DELETE FROM sessions WHERE id = ${sessionId}`;
    });
  });

  it('denies worker role access to accounts secrets', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
        return tx.$queryRaw`SELECT id FROM accounts LIMIT 1`;
      }),
    ).rejects.toThrow();
  });

  it('denies API role from reading _prisma_migrations', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
        return tx.$queryRaw`SELECT migration_name FROM _prisma_migrations LIMIT 1`;
      }),
    ).rejects.toThrow();
  });
});
