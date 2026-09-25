import { z } from 'zod';
import { cursorPaginationQuerySchema, paginatedListSchema } from './pagination.js';

export const OUTREACH_MAX_RECIPIENTS = 500;
export const OUTREACH_SEND_JOB_NAME = 'outreach.campaign.send' as const;

export const OUTREACH_TEMPLATE_VARIABLES = ['name', 'topic', 'paper'] as const;

export const outreachCampaignTypeSchema = z.enum([
  'TPC_INVITATION',
  'PAPER_SUBMISSION_INVITATION',
  'GENERAL_OUTREACH',
]);

export const outreachCampaignStatusSchema = z.enum([
  'DRAFT',
  'READY',
  'SENDING',
  'SENT',
  'PARTIAL',
  'FAILED',
]);

export const outreachRecipientStatusSchema = z.enum([
  'PENDING',
  'SKIPPED',
  'QUEUED',
  'SENT',
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
  'SUPPRESSED',
]);

export const outreachMailProviderSchema = z.enum(['log', 'ses', 'resend']);

export const outreachRecipientInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  topic: z.string().trim().min(1).max(300),
  paper: z.string().trim().min(1).max(500),
  rowNumber: z.number().int().positive().optional(),
});

export const outreachRawRecipientRowSchema = z.object({
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  topic: z.string().optional().default(''),
  paper: z.string().optional().default(''),
  rowNumber: z.number().int().positive(),
});

export const outreachInvalidRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  topic: z.string().nullable(),
  paper: z.string().nullable(),
  reason: z.string(),
});

export const outreachRecipientSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  topic: z.string(),
  paper: z.string(),
  status: outreachRecipientStatusSchema,
  providerMessageId: z.string().nullable(),
  error: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const outreachTemplateSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  subject: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string().nullable(),
  variables: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const outreachCampaignSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  name: z.string(),
  type: outreachCampaignTypeSchema,
  status: outreachCampaignStatusSchema,
  templateId: z.string().uuid().nullable(),
  templateKey: z.string().nullable(),
  templateName: z.string().nullable(),
  subject: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  fromName: z.string().nullable(),
  fromEmail: z.string().email().nullable(),
  replyToEmail: z.string().email().nullable(),
  recipientCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  version: z.number().int(),
  confirmedAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const outreachCampaignListQuerySchema = cursorPaginationQuerySchema.extend({
  status: outreachCampaignStatusSchema.optional(),
  type: outreachCampaignTypeSchema.optional(),
});

export const outreachCampaignListSchema = paginatedListSchema(outreachCampaignSchema);

export const outreachRecipientListQuerySchema = cursorPaginationQuerySchema.extend({
  status: outreachRecipientStatusSchema.optional(),
});

export const outreachRecipientListSchema = paginatedListSchema(outreachRecipientSchema);

export const outreachTemplateListSchema = z.object({
  data: z.array(outreachTemplateSchema),
});

export const createOutreachCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: outreachCampaignTypeSchema,
});

export const importOutreachRecipientsSchema = z.object({
  rows: z.array(outreachRawRecipientRowSchema).min(1).max(OUTREACH_MAX_RECIPIENTS),
});

export const importOutreachRecipientsResponseSchema = z.object({
  campaign: outreachCampaignSchema,
  importedCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  invalidRows: z.array(outreachInvalidRowSchema),
});

export const selectOutreachTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export const outreachPreviewQuerySchema = z.object({
  recipientId: z.string().uuid().optional(),
});

export const outreachPreviewSchema = z.object({
  recipientId: z.string().uuid().nullable(),
  recipientName: z.string().nullable(),
  recipientEmail: z.string().email().nullable(),
  subject: z.string(),
  bodyHtml: z.string(),
  fromName: z.string(),
  fromEmail: z.string().email(),
  replyToEmail: z.string().email(),
});

export const sendOutreachCampaignSchema = z.object({
  confirm: z.literal(true),
  version: z.number().int().nonnegative(),
});

export const sendOutreachCampaignResponseSchema = z.object({
  campaign: outreachCampaignSchema,
  message: z.string(),
});

export const outreachSenderSchema = z.object({
  fromName: z.string(),
  fromEmail: z.string().email(),
  replyToEmail: z.string().email(),
  configured: z.boolean(),
  provider: outreachMailProviderSchema,
});

export const outreachSendJobPayloadSchema = z.object({
  campaignId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export type OutreachMailProvider = z.infer<typeof outreachMailProviderSchema>;
export type OutreachCampaignType = z.infer<typeof outreachCampaignTypeSchema>;
export type OutreachCampaignStatus = z.infer<typeof outreachCampaignStatusSchema>;
export type OutreachRecipientStatus = z.infer<typeof outreachRecipientStatusSchema>;
export type OutreachRecipientInput = z.infer<typeof outreachRecipientInputSchema>;
export type OutreachRawRecipientRow = z.infer<typeof outreachRawRecipientRowSchema>;
export type OutreachInvalidRow = z.infer<typeof outreachInvalidRowSchema>;
export type OutreachRecipientDto = z.infer<typeof outreachRecipientSchema>;
export type OutreachTemplateDto = z.infer<typeof outreachTemplateSchema>;
export type OutreachCampaignDto = z.infer<typeof outreachCampaignSchema>;
export type OutreachCampaignListDto = z.infer<typeof outreachCampaignListSchema>;
export type OutreachRecipientListDto = z.infer<typeof outreachRecipientListSchema>;
export type CreateOutreachCampaignInput = z.infer<typeof createOutreachCampaignSchema>;
export type ImportOutreachRecipientsInput = z.infer<typeof importOutreachRecipientsSchema>;
export type SelectOutreachTemplateInput = z.infer<typeof selectOutreachTemplateSchema>;
export type SendOutreachCampaignInput = z.infer<typeof sendOutreachCampaignSchema>;
export type OutreachSenderDto = z.infer<typeof outreachSenderSchema>;
export type OutreachPreviewDto = z.infer<typeof outreachPreviewSchema>;
export type OutreachSendJobPayload = z.infer<typeof outreachSendJobPayloadSchema>;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeOutreachHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const MERGE_ALIASES: Record<string, 'name' | 'topic' | 'paper'> = {
  name: 'name',
  topic: 'topic',
  paper: 'paper',
  papertitle: 'paper',
  'paper title': 'paper',
  paper_title: 'paper',
};

export function normalizeOutreachMergeKey(raw: string): 'name' | 'topic' | 'paper' | string {
  const trimmed = raw.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  return MERGE_ALIASES[trimmed.replace(/ /g, '')] ?? MERGE_ALIASES[trimmed] ?? trimmed;
}

export type OutreachMergeContext = {
  name?: string;
  topic?: string;
  paper?: string;
};

export function renderOutreachTemplate(template: string, context: OutreachMergeContext): string {
  return template.replace(VARIABLE_PATTERN, (_match, rawKey: string) => {
    const key = normalizeOutreachMergeKey(rawKey);
    if (key === 'name' || key === 'topic' || key === 'paper') {
      return escapeOutreachHtml(context[key] ?? '');
    }
    return '';
  });
}

export const SENT_RECIPIENT_STATUSES = ['SENT'] as const;
export const FAILED_RECIPIENT_STATUSES = ['FAILED', 'BOUNCED', 'COMPLAINED'] as const;
export const SKIPPED_RECIPIENT_STATUSES = ['SKIPPED', 'SUPPRESSED'] as const;

export function countsFromRecipientStatuses(statuses: Array<OutreachRecipientStatus | string>): {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
} {
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const status of statuses) {
    if ((SENT_RECIPIENT_STATUSES as readonly string[]).includes(status)) {
      sentCount += 1;
    } else if ((FAILED_RECIPIENT_STATUSES as readonly string[]).includes(status)) {
      failedCount += 1;
    } else if ((SKIPPED_RECIPIENT_STATUSES as readonly string[]).includes(status)) {
      skippedCount += 1;
    }
  }
  return { sentCount, failedCount, skippedCount };
}

export function deriveOutreachCampaignStatus(input: {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}): 'SENT' | 'PARTIAL' | 'FAILED' {
  if (input.sentCount > 0 && input.failedCount === 0) {
    return 'SENT';
  }
  if (input.sentCount > 0 && input.failedCount > 0) {
    return 'PARTIAL';
  }
  if (input.failedCount > 0) {
    return 'FAILED';
  }
  if (input.skippedCount > 0) {
    return 'SENT';
  }
  return 'FAILED';
}

export function outreachCampaignRollup(input: {
  currentStatus: string;
  recipientStatuses: Array<OutreachRecipientStatus | string>;
  finalize?: boolean;
}): {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: 'DRAFT' | 'READY' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED';
} {
  const counts = countsFromRecipientStatuses(input.recipientStatuses);
  if (input.currentStatus === 'SENDING' && !input.finalize) {
    return { ...counts, status: 'SENDING' };
  }
  if (input.currentStatus === 'DRAFT' || input.currentStatus === 'READY') {
    return { ...counts, status: input.currentStatus };
  }
  return { ...counts, status: deriveOutreachCampaignStatus(counts) };
}

export const outreachWebhookAckSchema = z.object({
  received: z.boolean(),
});

export const resendOutreachWebhookEventSchema = z
  .object({
    type: z.string(),
    created_at: z.string().optional(),
    data: z
      .object({
        email_id: z.string().optional(),
        to: z.array(z.string()).optional(),
        tags: z.unknown().optional(),
        bounce: z
          .object({
            message: z.string().optional(),
            type: z.string().optional(),
            subType: z.string().optional(),
          })
          .passthrough()
          .optional(),
        suppressed: z
          .object({
            message: z.string().optional(),
            type: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ResendOutreachWebhookEvent = z.infer<typeof resendOutreachWebhookEventSchema>;

export function normalizeOutreachTags(tags: unknown): Record<string, string> {
  if (!tags) return {};
  if (Array.isArray(tags)) {
    const mapped: Record<string, string> = {};
    for (const tag of tags) {
      if (tag && typeof tag === 'object') {
        const record = tag as { name?: unknown; value?: unknown };
        if (typeof record.name === 'string' && typeof record.value === 'string') {
          mapped[record.name] = record.value;
        }
      }
    }
    return mapped;
  }
  if (typeof tags === 'object') {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
      if (typeof value === 'string') mapped[key] = value;
    }
    return mapped;
  }
  return {};
}
