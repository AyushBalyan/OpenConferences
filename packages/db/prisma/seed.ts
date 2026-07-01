import { prisma, withTenantContext, generateId } from '../src/index.js';

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@openconf.local';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';
const SEED_AUTHOR_EMAIL = process.env.SEED_AUTHOR_EMAIL ?? 'author@openconf.local';
const SEED_AUTHOR_PASSWORD = process.env.SEED_AUTHOR_PASSWORD ?? 'ChangeMe123!';
const SEED_AUTHOR_NAME = process.env.SEED_AUTHOR_NAME ?? 'Demo Author';
const SEED_REVIEWER_EMAIL = process.env.SEED_REVIEWER_EMAIL ?? 'reviewer@openconf.local';
const SEED_REVIEWER_PASSWORD = process.env.SEED_REVIEWER_PASSWORD ?? 'ChangeMe123!';
const SEED_REVIEWER_NAME = process.env.SEED_REVIEWER_NAME ?? 'Demo Reviewer';

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
  const authorUserId = generateId();
  const reviewerUserId = generateId();
  const paperId = generateId();
  const roundId = generateId();
  const orgMembershipId = generateId();
  const confMembershipId = generateId();
  const authorMembershipId = generateId();
  const reviewerMembershipId = generateId();
  const authorshipId = generateId();

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
        status: 'CFP_OPEN',
        blindingMode: 'DOUBLE',
        biddingOpensAt: new Date('2026-01-01T00:00:00Z'),
        biddingClosesAt: new Date('2026-12-31T23:59:59Z'),
        reviewDueAt: new Date('2026-12-31T23:59:59Z'),
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

    const authorPasswordHash = await hashPassword(SEED_AUTHOR_PASSWORD);

    await tx.user.create({
      data: {
        id: authorUserId,
        email: SEED_AUTHOR_EMAIL,
        name: SEED_AUTHOR_NAME,
        emailVerified: true,
        organizationId: orgId,
        accounts: {
          create: {
            id: generateId(),
            accountId: SEED_AUTHOR_EMAIL,
            providerId: 'credential',
            password: authorPasswordHash,
          },
        },
      },
    });

    await tx.membership.create({
      data: {
        id: authorMembershipId,
        userId: authorUserId,
        organizationId: orgId,
        conferenceId,
        scope: 'CONFERENCE',
        roles: {
          create: { id: generateId(), role: 'AUTHOR' },
        },
      },
    });

    await tx.paper.create({
      data: {
        id: paperId,
        organizationId: orgId,
        conferenceId,
        trackId,
        submittedById: authorUserId,
        title: 'Demo Paper Draft',
        abstract: 'This is a seeded draft paper for local development.',
        keywords: ['demo', 'seed'],
        status: 'SUBMITTED',
        authorships: {
          create: {
            id: authorshipId,
            userId: authorUserId,
            order: 1,
            isCorresponding: true,
            fullName: SEED_AUTHOR_NAME,
            email: SEED_AUTHOR_EMAIL,
            affiliation: 'Demo University',
          },
        },
      },
    });

    const reviewerPasswordHash = await hashPassword(SEED_REVIEWER_PASSWORD);

    await tx.user.create({
      data: {
        id: reviewerUserId,
        email: SEED_REVIEWER_EMAIL,
        name: SEED_REVIEWER_NAME,
        emailVerified: true,
        organizationId: orgId,
        accounts: {
          create: {
            id: generateId(),
            accountId: SEED_REVIEWER_EMAIL,
            providerId: 'credential',
            password: reviewerPasswordHash,
          },
        },
      },
    });

    await tx.membership.create({
      data: {
        id: reviewerMembershipId,
        userId: reviewerUserId,
        organizationId: orgId,
        conferenceId,
        scope: 'CONFERENCE',
        roles: {
          create: { id: generateId(), role: 'REVIEWER' },
        },
      },
    });

    await tx.reviewRound.create({
      data: {
        id: roundId,
        organizationId: orgId,
        conferenceId,
        roundNumber: 1,
        status: 'OPEN',
        reviewDueAt: new Date('2026-12-31T23:59:59Z'),
      },
    });
  });

  console.log('Database seed complete.');
  console.log(`  Organization: demo-org (${orgId})`);
  console.log(`  Conference:   demo-conf-2026 (${conferenceId})`);
  console.log(`  Admin login:  ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  console.log(`  Author login: ${SEED_AUTHOR_EMAIL} / ${SEED_AUTHOR_PASSWORD}`);
  console.log(`  Reviewer login: ${SEED_REVIEWER_EMAIL} / ${SEED_REVIEWER_PASSWORD}`);
  console.log(`  Submitted paper:  ${paperId}`);
  console.log(`  Review round 1:   ${roundId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
