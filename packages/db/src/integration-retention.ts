import { PrismaClient } from '@prisma/client';
import { prisma } from './index.js';

/** Worker role can only see/delete logs older than 30 days; bounded to limit locks. */
export async function pruneIntegrationAccessLogs(client: PrismaClient = prisma): Promise<number> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
    return tx.$executeRaw`
      WITH expired AS (
        SELECT id FROM api_integration_access_logs
        WHERE "observedAt" < now() - interval '30 days'
        ORDER BY "observedAt", id LIMIT 1000
      ) DELETE FROM api_integration_access_logs WHERE id IN (SELECT id FROM expired)
    `;
  });
}
