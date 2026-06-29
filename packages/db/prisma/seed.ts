import { prisma } from '../src/index.js';

async function main(): Promise<void> {
  // Phase 0: no domain seed data. Verify DB connectivity only.
  await prisma.$queryRaw`SELECT 1`;
  console.log('Database seed complete (connectivity verified).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
