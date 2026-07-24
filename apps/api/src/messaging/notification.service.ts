import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import type { NotificationLog, NotificationStatus } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { NotificationLogListDto, NotificationLogDto } from '@openconferences/schemas';
import { renderTemplate } from './template-renderer';
import { TemplateService } from './template.service';
import { QueueService } from '../queue/queue.service';

export type TestNotificationCapture = {
  to: string;
  subject: string;
  html: string;
  templateKey: string;
  tags?: string[];
};

/** Captures the last enqueued notification in test for integration assertions */
export let lastTestNotification: TestNotificationCapture | null = null;

export function resetLastTestNotification(): void {
  lastTestNotification = null;
}

export type EnqueueNotificationInput = {
  templateKey: string;
  to: string;
  context: Record<string, unknown>;
  organizationId?: string | null;
  conferenceId?: string | null;
  idempotencyKey?: string;
  replyTo?: string;
  tags?: string[];
  relatedEntity?: string;
  relatedEntityId?: string;
};

function mapLog(row: NotificationLog): NotificationLogDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    conferenceId: row.conferenceId,
    templateKey: row.templateKey,
    templateVersion: row.templateVersion,
    toEmail: row.toEmail,
    subject: row.subject,
    status: row.status,
    providerMessageId: row.providerMessageId,
    error: row.error,
    idempotencyKey: row.idempotencyKey,
    queuedAt: row.queuedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    relatedEntity: row.relatedEntity,
    relatedEntityId: row.relatedEntityId,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly templates: TemplateService,
    private readonly queue: QueueService,
  ) {}

  async enqueue(input: EnqueueNotificationInput): Promise<string | null> {
    const normalizedEmail = input.to.trim().toLowerCase();

    const suppressed = await withTenantContext({}, async (tx) =>
      tx.emailSuppression.findUnique({ where: { email: normalizedEmail } }),
    );

    if (suppressed) {
      this.logger.warn({ email: normalizedEmail }, 'Skipping notification — email suppressed');
      return null;
    }

    if (input.idempotencyKey) {
      const existing = await withTenantContext({}, async (tx) =>
        tx.notificationLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
      );

      if (existing) {
        this.logger.debug(
          { idempotencyKey: input.idempotencyKey },
          'Skipping duplicate notification',
        );
        return existing.id;
      }
    }

    const template = await this.templates.resolveActiveTemplate(
      input.organizationId,
      input.templateKey,
    );

    const subject = renderTemplate(template.subject, input.context);
    const html = renderTemplate(template.bodyHtml, input.context);
    const text = template.bodyText ? renderTemplate(template.bodyText, input.context) : undefined;

    if (getConfig().isTest) {
      lastTestNotification = {
        to: normalizedEmail,
        subject,
        html,
        templateKey: input.templateKey,
        tags: input.tags ?? [input.templateKey],
      };
    }

    const logId = generateId();

    await withTenantContext({}, async (tx) =>
      tx.notificationLog.create({
        data: {
          id: logId,
          organizationId: input.organizationId ?? null,
          conferenceId: input.conferenceId ?? null,
          templateKey: input.templateKey,
          templateVersion: template.version,
          toEmail: normalizedEmail,
          subject,
          renderedHtml: html,
          status: 'QUEUED',
          idempotencyKey: input.idempotencyKey ?? null,
          relatedEntity: input.relatedEntity ?? null,
          relatedEntityId: input.relatedEntityId ?? null,
        },
      }),
    );

    return this.queue.sendNotification({
      logId,
      to: normalizedEmail,
      subject,
      html,
      text,
      replyTo: input.replyTo,
      tags: input.tags ?? [input.templateKey],
      idempotencyKey: input.idempotencyKey,
    });
  }

  async listLogs(
    conferenceId: string,
    query: {
      status?: NotificationStatus;
      templateKey?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    },
  ): Promise<NotificationLogListDto> {
    const limit = query.limit ?? 50;

    const logs = await withTenantContext({ conferenceId }, async (tx) =>
      tx.notificationLog.findMany({
        where: {
          conferenceId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.templateKey ? { templateKey: query.templateKey } : {}),
          ...(query.search
            ? {
                OR: [
                  { toEmail: { contains: query.search, mode: 'insensitive' as const } },
                  { subject: { contains: query.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
          ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
    );

    const hasMore = logs.length > limit;
    const page = hasMore ? logs.slice(0, limit) : logs;

    return {
      data: page.map(mapLog),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async resend(conferenceId: string, logId: string): Promise<{ logId: string; message: string }> {
    const original = await withTenantContext({ conferenceId }, async (tx) =>
      tx.notificationLog.findFirst({
        where: { id: logId, conferenceId },
      }),
    );

    if (!original) {
      throw new NotFoundException('Notification log not found');
    }

    if (original.status === 'QUEUED') {
      throw new ConflictException('Notification is still queued');
    }

    const template = await this.templates.resolveActiveTemplate(
      original.organizationId,
      original.templateKey,
    );

    const newLogId = generateId();
    const idempotencyKey = `resend:${original.id}:${Date.now()}`;

    await withTenantContext({}, async (tx) =>
      tx.notificationLog.create({
        data: {
          id: newLogId,
          organizationId: original.organizationId,
          conferenceId: original.conferenceId,
          templateKey: original.templateKey,
          templateVersion: template.version,
          toEmail: original.toEmail,
          subject: original.subject,
          renderedHtml: original.renderedHtml,
          status: 'QUEUED',
          idempotencyKey,
          relatedEntity: original.relatedEntity,
          relatedEntityId: original.relatedEntityId,
        },
      }),
    );

    await this.queue.sendNotification({
      logId: newLogId,
      to: original.toEmail,
      subject: original.subject,
      html: original.renderedHtml ?? template.bodyHtml,
      tags: [original.templateKey, 'resend'],
      idempotencyKey,
    });

    return { logId: newLogId, message: 'Notification queued for resend' };
  }
}
