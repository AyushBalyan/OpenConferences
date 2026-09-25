import { prisma, syncPlatformOutreachTemplates } from '@openconferences/db';

export async function ensureOutreachTemplates(): Promise<void> {
  await syncPlatformOutreachTemplates(prisma);
}
