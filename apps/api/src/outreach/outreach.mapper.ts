import type { OutreachCampaign, OutreachRecipient, OutreachTemplate } from '@openconferences/db';
import type {
  OutreachCampaignDto,
  OutreachRecipientDto,
  OutreachTemplateDto,
} from '@openconferences/schemas';

export function mapOutreachCampaign(row: OutreachCampaign): OutreachCampaignDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    conferenceId: row.conferenceId,
    name: row.name,
    type: row.type,
    status: row.status,
    templateId: row.templateId,
    templateKey: row.templateKey,
    templateName: row.templateName,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    fromName: row.fromName,
    fromEmail: row.fromEmail || null,
    replyToEmail: row.replyToEmail || null,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    version: row.version,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapOutreachRecipient(row: OutreachRecipient): OutreachRecipientDto {
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    email: row.email,
    topic: row.topic,
    paper: row.paper,
    status: row.status,
    providerMessageId: row.providerMessageId,
    error: row.error,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapOutreachTemplate(row: OutreachTemplate): OutreachTemplateDto {
  const variables = Array.isArray(row.variables)
    ? row.variables.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    version: row.version,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    variables,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
