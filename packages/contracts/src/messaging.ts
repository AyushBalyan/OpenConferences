import { initContract } from '@ts-rest/core';
import {
  notificationLogListSchema,
  notificationLogListQuerySchema,
  notificationTemplateListSchema,
  notificationTemplateSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  notificationTemplateListQuerySchema,
  resendNotificationResponseSchema,
  problemEnvelopeSchema,
  inboxKindSchema,
  inboxItemSchema,
} from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferenceIdParams = z.object({
  id: z.string().uuid(),
});

const templateParams = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
});

const logParams = z.object({
  id: z.string().uuid(),
  logId: z.string().uuid(),
});

export const messagingContract = c.router({
  listInbox: {
    method: 'GET',
    path: '/conferences/:id/inbox',
    pathParams: conferenceIdParams,
    query: z.object({
      kind: inboxKindSchema,
      cursor: z.string().uuid().optional(),
      unread: z.literal('true').optional(),
    }),
    responses: {
      200: z.object({
        data: z.array(inboxItemSchema),
        nextCursor: z.string().uuid().nullable(),
        observedAt: z.string().datetime().optional(),
      }),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
  },
  readInbox: {
    method: 'POST',
    path: '/conferences/:id/inbox/read',
    pathParams: conferenceIdParams,
    body: z.object({
      kind: inboxKindSchema,
      sourceId: z.string().uuid(),
      version: z.number().int().nonnegative(),
    }),
    responses: {
      200: z.object({ read: z.literal(true) }),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
  },
  countConferenceUpdates: {
    method: 'GET',
    path: '/conferences/:id/inbox/count',
    pathParams: conferenceIdParams,
    query: z.object({}),
    responses: {
      200: z.object({ unreadCount: z.number().int().nonnegative() }),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
    },
  },
  readAllConferenceUpdates: {
    method: 'POST',
    path: '/conferences/:id/inbox/read-all',
    pathParams: conferenceIdParams,
    body: z.object({ before: z.string().datetime() }),
    responses: {
      200: z.object({ read: z.literal(true) }),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
    },
  },
  listNotificationLogs: {
    method: 'GET',
    path: '/conferences/:id/notification-logs',
    pathParams: conferenceIdParams,
    query: notificationLogListQuerySchema,
    responses: {
      200: notificationLogListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List notification delivery logs for a conference',
  },
  resendNotification: {
    method: 'POST',
    path: '/conferences/:id/notification-logs/:logId/resend',
    pathParams: logParams,
    body: c.noBody(),
    responses: {
      200: resendNotificationResponseSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Resend a notification from the delivery log',
  },
  listNotificationTemplates: {
    method: 'GET',
    path: '/conferences/:id/notification-templates',
    pathParams: conferenceIdParams,
    query: notificationTemplateListQuerySchema,
    responses: {
      200: notificationTemplateListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List notification templates for a conference organization',
  },
  createNotificationTemplate: {
    method: 'POST',
    path: '/conferences/:id/notification-templates',
    pathParams: conferenceIdParams,
    body: createNotificationTemplateSchema,
    responses: {
      201: notificationTemplateSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Create a new version of a notification template',
  },
  updateNotificationTemplate: {
    method: 'PATCH',
    path: '/conferences/:id/notification-templates/:templateId',
    pathParams: templateParams,
    body: updateNotificationTemplateSchema,
    responses: {
      200: notificationTemplateSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Update an existing notification template version',
  },
});

export type MessagingContract = typeof messagingContract;
