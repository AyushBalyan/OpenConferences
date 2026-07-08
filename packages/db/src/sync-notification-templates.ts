import { generateId } from './id.js';
import { PLATFORM_NOTIFICATION_TEMPLATES } from './notification-templates.js';
import type { PrismaClient } from '@prisma/client';

type DbClient = Pick<PrismaClient, 'notificationTemplate'>;

/** Upsert platform default notification templates (version 2, active). */
export async function syncPlatformNotificationTemplates(client: DbClient): Promise<void> {
  for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
    await client.notificationTemplate.updateMany({
      where: { organizationId: null, key: template.key },
      data: { isActive: false },
    });

    const existing = await client.notificationTemplate.findFirst({
      where: { organizationId: null, key: template.key, version: 2 },
    });

    if (existing) {
      await client.notificationTemplate.update({
        where: { id: existing.id },
        data: {
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
          variables: template.variables,
          isActive: true,
        },
      });
      continue;
    }

    await client.notificationTemplate.create({
      data: {
        id: generateId(),
        organizationId: null,
        key: template.key,
        version: 2,
        locale: 'en',
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        variables: template.variables,
        isActive: true,
      },
    });
  }
}
