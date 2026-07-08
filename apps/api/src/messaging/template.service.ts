import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationTemplate } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CreateNotificationTemplateInput,
  NotificationTemplateDto,
  UpdateNotificationTemplateInput,
} from '@openconferences/schemas';
import {
  paginateItems,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { validateTemplateVariables } from './template-renderer';

function mapTemplate(row: NotificationTemplate): NotificationTemplateDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    version: row.version,
    locale: row.locale,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    variables: Array.isArray(row.variables) ? (row.variables as string[]) : [],
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class TemplateService {
  async listForOrganization(
    organizationId: string,
    options: CursorPaginationOptions = {},
  ): Promise<{ data: NotificationTemplateDto[]; nextCursor: string | null }> {
    const [orgTemplates, platformTemplates] = await withTenantContext(
      { bypass: true },
      async (tx) =>
        Promise.all([
          tx.notificationTemplate.findMany({
            where: { organizationId },
            orderBy: [{ key: 'asc' }, { version: 'desc' }],
          }),
          tx.notificationTemplate.findMany({
            where: { organizationId: null },
            orderBy: [{ key: 'asc' }, { version: 'desc' }],
          }),
        ]),
    );

    const byKey = new Map<string, NotificationTemplate>();

    for (const template of platformTemplates) {
      byKey.set(template.key, template);
    }

    for (const template of orgTemplates) {
      const existing = byKey.get(template.key);
      if (!existing || template.version > existing.version) {
        byKey.set(template.key, template);
      }
    }

    const merged = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
    const limit = resolveLimit(options.limit);

    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = merged.findIndex((template) => template.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const page = paginateItems(
      merged.slice(startIndex, startIndex + limit + 1),
      limit,
      (row) => row.id,
    );

    return {
      data: page.data.map(mapTemplate),
      nextCursor: page.nextCursor,
    };
  }

  async listAllVersions(organizationId: string, key: string): Promise<NotificationTemplateDto[]> {
    const templates = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.findMany({
        where: {
          key,
          OR: [{ organizationId }, { organizationId: null }],
        },
        orderBy: [{ version: 'desc' }],
      }),
    );

    return templates.map(mapTemplate);
  }

  async resolveActiveTemplate(
    organizationId: string | null | undefined,
    key: string,
  ): Promise<NotificationTemplate> {
    const orgTemplate = organizationId
      ? await withTenantContext({ bypass: true }, async (tx) =>
          tx.notificationTemplate.findFirst({
            where: { organizationId, key, isActive: true },
            orderBy: { version: 'desc' },
          }),
        )
      : null;

    if (orgTemplate) {
      return orgTemplate;
    }

    const platformTemplate = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.findFirst({
        where: { organizationId: null, key, isActive: true },
        orderBy: { version: 'desc' },
      }),
    );

    if (!platformTemplate) {
      throw new NotFoundException(`Notification template not found: ${key}`);
    }

    return platformTemplate;
  }

  async createTemplate(
    organizationId: string,
    input: CreateNotificationTemplateInput,
  ): Promise<NotificationTemplateDto> {
    try {
      validateTemplateVariables(input.variables, input.subject, input.bodyHtml);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid template variables',
      );
    }

    const latest = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.findFirst({
        where: { organizationId, key: input.key },
        orderBy: { version: 'desc' },
      }),
    );

    const nextVersion = (latest?.version ?? 0) + 1;

    if (input.isActive) {
      await withTenantContext({ bypass: true }, async (tx) =>
        tx.notificationTemplate.updateMany({
          where: { organizationId, key: input.key, isActive: true },
          data: { isActive: false },
        }),
      );
    }

    const created = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.create({
        data: {
          id: generateId(),
          organizationId,
          key: input.key,
          version: nextVersion,
          locale: input.locale,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText ?? null,
          variables: input.variables,
          isActive: input.isActive,
        },
      }),
    );

    return mapTemplate(created);
  }

  async updateTemplate(
    organizationId: string,
    templateId: string,
    input: UpdateNotificationTemplateInput,
  ): Promise<NotificationTemplateDto> {
    const existing = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.findFirst({
        where: { id: templateId, organizationId },
      }),
    );

    if (!existing) {
      throw new NotFoundException('Notification template not found');
    }

    const subject = input.subject ?? existing.subject;
    const bodyHtml = input.bodyHtml ?? existing.bodyHtml;
    const variables = input.variables ?? (existing.variables as string[]);

    try {
      validateTemplateVariables(variables, subject, bodyHtml);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid template variables',
      );
    }

    if (input.isActive === true) {
      await withTenantContext({ bypass: true }, async (tx) =>
        tx.notificationTemplate.updateMany({
          where: {
            organizationId,
            key: existing.key,
            isActive: true,
            id: { not: templateId },
          },
          data: { isActive: false },
        }),
      );
    }

    const updated = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.update({
        where: { id: templateId },
        data: {
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText,
          variables: input.variables,
          isActive: input.isActive,
        },
      }),
    );

    return mapTemplate(updated);
  }

  async getById(organizationId: string, templateId: string): Promise<NotificationTemplateDto> {
    const template = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationTemplate.findFirst({
        where: {
          id: templateId,
          OR: [{ organizationId }, { organizationId: null }],
        },
      }),
    );

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return mapTemplate(template);
  }
}

export { mapTemplate };
