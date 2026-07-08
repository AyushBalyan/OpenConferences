import { prisma, syncPlatformNotificationTemplates } from '@openconferences/db';

export async function ensureNotificationTemplates(): Promise<void> {
  try {
    await syncPlatformNotificationTemplates(prisma);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('notification_templates')) {
      throw new Error(
        'Notification tables are missing. Run: pnpm --filter @openconferences/db exec prisma migrate deploy',
      );
    }
    throw err;
  }
}
