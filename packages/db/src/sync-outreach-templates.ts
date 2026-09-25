import { generateId } from './id.js';
import { PLATFORM_OUTREACH_TEMPLATES } from './outreach-templates.js';
import type { PrismaClient } from '@prisma/client';

type DbClient = Pick<PrismaClient, 'outreachTemplate'>;

const PLATFORM_VERSION = 1;

/** Upsert platform default outreach templates. */
export async function syncPlatformOutreachTemplates(client: DbClient): Promise<void> {
  for (const template of PLATFORM_OUTREACH_TEMPLATES) {
    await client.outreachTemplate.updateMany({
      where: { organizationId: null, conferenceId: null, key: template.key },
      data: { isActive: false },
    });

    const existing = await client.outreachTemplate.findFirst({
      where: {
        organizationId: null,
        conferenceId: null,
        key: template.key,
        version: PLATFORM_VERSION,
      },
    });

    if (existing) {
      await client.outreachTemplate.update({
        where: { id: existing.id },
        data: {
          name: template.name,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
          variables: template.variables,
          isActive: true,
        },
      });
      continue;
    }

    await client.outreachTemplate.create({
      data: {
        id: generateId(),
        organizationId: null,
        conferenceId: null,
        key: template.key,
        name: template.name,
        version: PLATFORM_VERSION,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        variables: template.variables,
        isActive: true,
      },
    });
  }
}
