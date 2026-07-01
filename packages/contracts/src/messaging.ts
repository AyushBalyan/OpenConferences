import { initContract } from '@ts-rest/core';
import {
  notificationLogListSchema,
  notificationLogListQuerySchema,
  notificationTemplateListSchema,
  notificationTemplateSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  resendNotificationResponseSchema,
  problemEnvelopeSchema,
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
