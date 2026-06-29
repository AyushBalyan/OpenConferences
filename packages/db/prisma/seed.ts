import { prisma, withTenantContext, generateId } from '../src/index.js';

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@openconf.local';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';

async function hashPassword(password: string): Promise<string> {
  const { hashPassword: hash } = await import('better-auth/crypto');
  return hash(password);
}

async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;

  const existingAdmin = await prisma.user.findFirst({
    where: { email: SEED_ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log('Seed data already present (admin user exists). Skipping.');
    return;
  }

  const orgId = generateId();
  const conferenceId = generateId();
  const trackId = generateId();
  const adminUserId = generateId();
  const orgMembershipId = generateId();
  const confMembershipId = generateId();

  await withTenantContext({ bypass: true }, async (tx) => {
    await tx.organization.create({
      data: {
        id: orgId,
        slug: 'demo-org',
        name: 'Demo Organization',
      },
    });

    await tx.conference.create({
      data: {
        id: conferenceId,
        organizationId: orgId,
        slug: 'demo-conf-2026',
        name: 'Demo Conference 2026',
        status: 'DRAFT',
        blindingMode: 'DOUBLE',
        reviewConfig: {
          scoreDimensions: ['originality', 'clarity', 'significance'],
          recommendationRequired: true,
        },
        feeSchedule: {
          currency: 'INR',
          matrix: {
            REGULAR: { EARLY: 500000, REGULAR: 750000 },
            STUDENT: { EARLY: 250000, REGULAR: 400000 },
          },
        },
      },
    });

    await tx.track.create({
      data: {
        id: trackId,
        conferenceId,
        organizationId: orgId,
        slug: 'main',
        name: 'Main Track',
        description: 'Default track for demo conference',
      },
    });

    const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);

    await tx.user.create({
      data: {
        id: adminUserId,
        email: SEED_ADMIN_EMAIL,
        name: SEED_ADMIN_NAME,
        emailVerified: true,
        organizationId: orgId,
        accounts: {
          create: {
            id: generateId(),
            accountId: SEED_ADMIN_EMAIL,
            providerId: 'credential',
            password: passwordHash,
          },
        },
      },
    });

    await tx.membership.create({
      data: {
        id: orgMembershipId,
        userId: adminUserId,
        organizationId: orgId,
        scope: 'ORGANIZATION',
        roles: {
          create: {
            id: generateId(),
            role: 'PLATFORM_ADMIN',
          },
        },
      },
    });

    await tx.membership.create({
      data: {
        id: confMembershipId,
        userId: adminUserId,
        organizationId: orgId,
        conferenceId,
        scope: 'CONFERENCE',
        roles: {
          create: [
            { id: generateId(), role: 'ORG_ADMIN' },
            { id: generateId(), role: 'ORGANIZER' },
          ],
        },
      },
    });
  });

  console.log('Database seed complete.');
  console.log(`  Organization: demo-org (${orgId})`);
  console.log(`  Conference:   demo-conf-2026 (${conferenceId})`);
  console.log(`  Admin login:  ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
