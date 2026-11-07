import { PrismaClient } from '@openconferences/db';
// Runs before test modules (including their cleanup hooks) are loaded.
export default async function verifyLocalDatabase() {
  const urls = new Set(
    [
      process.env.DATABASE_URL,
      process.env.ANALYTICS_TEST_DATABASE_URL,
      process.env.IN_APP_UPDATES_TEST_DATABASE_URL,
      process.env.REVIEW_LOCK_TEST_DATABASE_URL,
      process.env.REVIEWER_OVERVIEW_TEST_DATABASE_URL,
    ].filter((url): url is string => !!url),
  );
  for (const url of urls) {
    const client = new PrismaClient({ datasourceUrl: url });
    try {
      const rows = await client.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM local_test.task_marker`;
      if (rows.length !== 1 || rows[0]?.id !== process.env.LOCAL_TEST_DATABASE_MARKER)
        throw new Error('Local integration database ownership marker mismatch');
    } finally {
      await client.$disconnect();
    }
  }
}
