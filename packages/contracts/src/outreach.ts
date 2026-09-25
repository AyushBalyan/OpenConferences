import { initContract } from '@ts-rest/core';
import {
  createOutreachCampaignSchema,
  importOutreachRecipientsSchema,
  importOutreachRecipientsResponseSchema,
  outreachCampaignListQuerySchema,
  outreachCampaignListSchema,
  outreachCampaignSchema,
  outreachPreviewQuerySchema,
  outreachPreviewSchema,
  outreachRecipientListQuerySchema,
  outreachRecipientListSchema,
  outreachSenderSchema,
  outreachTemplateListSchema,
  problemEnvelopeSchema,
  selectOutreachTemplateSchema,
  sendOutreachCampaignResponseSchema,
  sendOutreachCampaignSchema,
  outreachWebhookAckSchema,
} from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferenceParams = z.object({
  conferenceId: z.string().uuid(),
});

const campaignParams = z.object({
  conferenceId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export const outreachContract = c.router({
  listCampaigns: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/campaigns',
    pathParams: conferenceParams,
    query: outreachCampaignListQuerySchema,
    responses: {
      200: outreachCampaignListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List academic outreach campaigns for a conference',
  },
  createCampaign: {
    method: 'POST',
    path: '/conferences/:conferenceId/outreach/campaigns',
    pathParams: conferenceParams,
    body: createOutreachCampaignSchema,
    responses: {
      201: outreachCampaignSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Create an academic outreach campaign',
  },
  getCampaign: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId',
    pathParams: campaignParams,
    responses: {
      200: outreachCampaignSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get an outreach campaign',
  },
  importRecipients: {
    method: 'POST',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId/recipients',
    pathParams: campaignParams,
    body: importOutreachRecipientsSchema,
    responses: {
      200: importOutreachRecipientsResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Import and validate outreach recipients',
  },
  listRecipients: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId/recipients',
    pathParams: campaignParams,
    query: outreachRecipientListQuerySchema,
    responses: {
      200: outreachRecipientListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List recipients for an outreach campaign',
  },
  listTemplates: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/templates',
    pathParams: conferenceParams,
    responses: {
      200: outreachTemplateListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List academic outreach templates',
  },
  selectTemplate: {
    method: 'POST',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId/template',
    pathParams: campaignParams,
    body: selectOutreachTemplateSchema,
    responses: {
      200: outreachCampaignSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Select an outreach template and snapshot copy',
  },
  previewCampaign: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId/preview',
    pathParams: campaignParams,
    query: outreachPreviewQuerySchema,
    responses: {
      200: outreachPreviewSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Preview a personalized outreach email',
  },
  sendCampaign: {
    method: 'POST',
    path: '/conferences/:conferenceId/outreach/campaigns/:campaignId/send',
    pathParams: campaignParams,
    body: sendOutreachCampaignSchema,
    responses: {
      200: sendOutreachCampaignResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
      422: problemEnvelopeSchema,
    },
    summary: 'Confirm and enqueue an outreach campaign send',
  },
  getSender: {
    method: 'GET',
    path: '/conferences/:conferenceId/outreach/sender',
    pathParams: conferenceParams,
    responses: {
      200: outreachSenderSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Return the environment-configured outreach sender (no credentials)',
  },
});

export const outreachWebhookContract = c.router({
  resend: {
    method: 'POST',
    path: '/webhooks/resend/outreach',
    body: c.type<{ [key: string]: unknown }>(),
    responses: {
      200: outreachWebhookAckSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'Resend outreach delivery webhook (Svix signed, replay-safe)',
  },
});

export type OutreachContract = typeof outreachContract;
export type OutreachWebhookContract = typeof outreachWebhookContract;
