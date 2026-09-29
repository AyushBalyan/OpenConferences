import { Prisma } from '@prisma/client';
import { prisma } from './index.js';
import { generateSubmissionNumber } from './submission-number.js';

const dryRun = process.argv.includes('--dry-run');
const attemptsPerPaper = 5;

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function main(): Promise<void> {
  const papers = await prisma.paper.findMany({
    where: { status: { not: 'DRAFT' }, submissionNumber: null },
    select: {
      id: true,
      conference: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Non-draft papers missing a submission number: ${papers.length}`);
  if (dryRun) {
    return;
  }

  let assigned = 0;
  for (const paper of papers) {
    let stored = false;
    for (let attempt = 0; attempt < attemptsPerPaper; attempt++) {
      const submissionNumber = generateSubmissionNumber(paper.conference.slug);
      try {
        const result = await prisma.paper.updateMany({
          where: {
            id: paper.id,
            submissionNumber: null,
            status: { not: 'DRAFT' },
          },
          data: { submissionNumber },
        });
        if (result.count === 1) {
          assigned += 1;
        }
        stored = true;
        break;
      } catch (error) {
        if (isUniqueConflict(error) && attempt < attemptsPerPaper - 1) {
          continue;
        }
        throw error;
      }
    }
    if (!stored) {
      throw new Error(`Could not assign a unique submission number for paper ${paper.id}`);
    }
  }

  console.log(`Assigned submission numbers: ${assigned}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Backfill failed';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
