import { z } from 'zod';

export const notificationStatusSchema = z.enum(['QUEUED', 'SENT', 'FAILED', 'BOUNCED']);

export const notificationLogSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  conferenceId: z.string().uuid().nullable(),
  templateKey: z.string(),
  templateVersion: z.number().int().nullable(),
  toEmail: z.string().email(),
  subject: z.string(),
  status: notificationStatusSchema,
  providerMessageId: z.string().nullable(),
  error: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  queuedAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  relatedEntity: z.string().nullable(),
  relatedEntityId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const notificationLogListQuerySchema = z.object({
  status: notificationStatusSchema.optional(),
  templateKey: z.string().optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const notificationLogListSchema = z.object({
  data: z.array(notificationLogSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const notificationTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  key: z.string().min(1).max(128),
  version: z.number().int().positive(),
  locale: z.string().min(2).max(10),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().nullable(),
  variables: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const notificationTemplateListSchema = z.object({
  data: z.array(notificationTemplateSchema),
});

export const createNotificationTemplateSchema = z.object({
  key: z.string().min(1).max(128),
  locale: z.string().min(2).max(10).default('en'),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updateNotificationTemplateSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().nullable().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const resendNotificationResponseSchema = z.object({
  logId: z.string().uuid(),
  message: z.string(),
});

export const notificationJobPayloadSchema = z.object({
  logId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  replyTo: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});

export const NOTIFICATION_SEND_JOB_NAME = 'notification.send' as const;

export const REMINDER_SWEEP_JOB_NAME = 'notification.reminder_sweep' as const;

export const reminderSweepJobPayloadSchema = z.object({
  kind: z
    .enum([
      'review.reminder',
      'cameraready.reminder',
      'registration.early_bird_ending',
      'registration.deadline_reminder',
    ])
    .optional(),
  conferenceId: z.string().uuid().optional(),
});

export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type NotificationLogDto = z.infer<typeof notificationLogSchema>;
export type NotificationLogListDto = z.infer<typeof notificationLogListSchema>;
export type NotificationTemplateDto = z.infer<typeof notificationTemplateSchema>;
export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;
export type NotificationJobPayload = z.infer<typeof notificationJobPayloadSchema>;
export type ReminderSweepJobPayload = z.infer<typeof reminderSweepJobPayloadSchema>;
