import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@openconferences/db';

const owner = new PrismaClient({ datasourceUrl: process.env.BOT_API_TEST_OWNER_URL });

// Roll back the fixtures and any temporary helper overrides on success or failure.
async function rollbackTest(run: (tx: Prisma.TransactionClient) => Promise<void>) {
  const rollback = new Error('Rollback credential lookup regression fixture');
  try {
    await owner.$transaction(
      async (tx) => {
        await run(tx);
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function fixture(tx: Prisma.TransactionClient) {
  const org = randomUUID(),
    conf = randomUUID(),
    user = randomUUID();
  await tx.organization.create({ data: { id: org, name: 'Lookup regression', slug: org } });
  await tx.user.create({ data: { id: user, name: 'Chair', email: `${user}@example.test` } });
  await tx.conference.create({
    data: {
      id: conf,
      organizationId: org,
      name: 'Lookup regression',
      slug: conf,
      authorJoinToken: randomUUID(),
    },
  });
  await tx.membership.create({
    data: {
      id: randomUUID(),
      organizationId: org,
      conferenceId: conf,
      userId: user,
      scope: 'CONFERENCE',
      roles: { create: { id: randomUUID(), role: 'CHAIR' } },
    },
  });
  const integration = await tx.apiIntegration.create({
    data: {
      id: randomUUID(),
      organizationId: org,
      conferenceId: conf,
      name: 'Lookup regression',
      scopes: ['papers:read'],
      authorizedByUserId: user,
      createdByUserId: user,
    },
  });
  const key = await tx.apiIntegrationKey.create({
    data: {
      id: randomUUID(),
      integrationId: integration.id,
      organizationId: org,
      conferenceId: conf,
      label: 'Synthetic',
      scopes: ['papers:read'],
      secretHash: randomUUID().replaceAll('-', '').repeat(2),
      createdByUserId: user,
      requestId: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { org, conf, user, integration, key };
}

async function apiContext(tx: Prisma.TransactionClient, user = '', org = '', conf = '') {
  await tx.$executeRaw`SET LOCAL ROLE openconferences_api`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user}, true),
    set_config('app.current_org_id', ${org}, true),
    set_config('app.current_conference_id', ${conf}, true)`;
}

describe('credential lookup manager-policy short circuit', () => {
  beforeAll(async () => {
    const marker = await owner.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM bot_test.bot_api_test_marker`;
    expect(marker).toEqual([{ id: process.env.BOT_API_TEST_MARKER }]);
  });
  afterAll(() => owner.$disconnect());

  it('looks up only a matching credential without running human manager checks', async () => {
    await rollbackTest(async (tx) => {
      const { org, conf, key } = await fixture(tx);
      // A deterministic trap catches manager-policy evaluation even on tiny CI
      // fixtures, where the production membership scan would otherwise be fast.
      await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION public.app_conference_context_matches(conf_id uuid)
        RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $$
        BEGIN RAISE EXCEPTION 'Human manager check ran during credential-only lookup'; END; $$`);
      await apiContext(tx);
      await tx.$queryRaw`SELECT set_config('app.integration_key_id', ${key.id}, true),
        set_config('app.integration_key_hash', ${key.secretHash}, true)`;
      const manager = await tx.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT public.app_integration_manager(${org}::uuid, ${conf}::uuid) AS allowed`;
      expect(manager).toEqual([{ allowed: false }]);
      const found = await tx.apiIntegrationKey.findFirst({
        where: { id: key.id, secretHash: key.secretHash },
        select: { id: true, integration: { select: { id: true } } },
      });
      expect(found).toEqual({ id: key.id, integration: { id: key.integrationId } });
      await tx.$queryRaw`SELECT set_config('app.integration_key_hash', ${'0'.repeat(64)}, true)`;
      expect(await tx.apiIntegrationKey.count()).toBe(0);
      expect(await tx.apiIntegration.count()).toBe(0);
      await tx.$queryRaw`SELECT set_config('app.integration_key_id', ${randomUUID()}, true),
        set_config('app.integration_key_hash', ${key.secretHash}, true)`;
      expect(await tx.apiIntegrationKey.count()).toBe(0);
      expect(await tx.apiIntegration.count()).toBe(0);
      await tx.$queryRaw`SELECT set_config('app.integration_key_id', '', true),
        set_config('app.integration_key_hash', '', true)`;
      expect(await tx.apiIntegrationKey.count()).toBe(0);
      expect(await tx.apiIntegration.count()).toBe(0);
    });
  });

  it('preserves manager authorization and tenant isolation for signed-in users', async () => {
    await rollbackTest(async (tx) => {
      const { org, conf, user } = await fixture(tx);
      await apiContext(tx, user, org, conf);
      const manager = () => tx.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT public.app_integration_manager(${org}::uuid, ${conf}::uuid) AS allowed`;
      expect(await manager()).toEqual([{ allowed: true }]);
      await tx.$queryRaw`SELECT set_config('app.current_org_id', ${randomUUID()}, true)`;
      expect(await manager()).toEqual([{ allowed: false }]);
      await tx.$queryRaw`SELECT set_config('app.current_org_id', ${org}, true)`;
      await tx.$queryRaw`SELECT set_config('app.current_conference_id', ${randomUUID()}, true)`;
      expect(await manager()).toEqual([{ allowed: false }]);
      await tx.$queryRaw`SELECT set_config('app.current_conference_id', ${conf}, true),
        set_config('app.current_user_id', ${randomUUID()}, true)`;
      expect(await manager()).toEqual([{ allowed: false }]);
    });
  });
});
