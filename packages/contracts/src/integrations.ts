import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  integrationCreateSchema,
  integrationUpdateSchema,
  integrationVersionSchema,
  integrationIssueSchema,
  integrationSchema,
  integrationKeySchema,
  botQuerySchema,
  botPaperSchema,
  botAuthorSchema,
  botReviewerSchema,
  botAssignmentSchema,
  botSummarySchema,
  botCapabilitiesSchema,
  botReviewerInvitationSchema,
  botCreateAssignmentSchema,
  botCreateAssignmentResponseSchema,
  botListSchema,
  botDetailSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';
const c = initContract();
const conference = z.object({ conferenceId: z.string().uuid() });
const integration = conference.extend({ integrationId: z.string().uuid() });
const common = {
  400: problemEnvelopeSchema,
  401: problemEnvelopeSchema,
  403: problemEnvelopeSchema,
  404: problemEnvelopeSchema,
  409: problemEnvelopeSchema,
  429: problemEnvelopeSchema,
  503: problemEnvelopeSchema,
};
const base = '/conferences/:conferenceId/integrations';
export const integrationManagementContract = c.router({
  list: {
    method: 'GET',
    path: base,
    pathParams: conference,
    query: z.object({
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    responses: {
      200: z.object({ data: z.array(integrationSchema), nextCursor: z.string().nullable() }),
      ...common,
    },
  },
  create: {
    method: 'POST',
    path: base,
    pathParams: conference,
    body: integrationCreateSchema,
    responses: { 201: integrationSchema, ...common },
  },
  get: {
    method: 'GET',
    path: base + '/:integrationId',
    pathParams: integration,
    responses: { 200: integrationSchema, ...common },
  },
  update: {
    method: 'PATCH',
    path: base + '/:integrationId',
    pathParams: integration,
    body: integrationUpdateSchema,
    responses: { 200: integrationSchema, ...common },
  },
  revoke: {
    method: 'POST',
    path: base + '/:integrationId/revoke',
    pathParams: integration,
    body: integrationVersionSchema,
    responses: { 200: integrationSchema, ...common },
  },
  reauthorize: {
    method: 'POST',
    path: base + '/:integrationId/reauthorize',
    pathParams: integration,
    body: integrationVersionSchema,
    responses: { 200: integrationSchema, ...common },
  },
  issueKey: {
    method: 'POST',
    path: base + '/:integrationId/keys',
    pathParams: integration,
    body: integrationIssueSchema,
    responses: { 201: z.object({ key: integrationKeySchema, token: z.string() }), ...common },
  },
  revokeKey: {
    method: 'POST',
    path: base + '/:integrationId/keys/:keyId/revoke',
    pathParams: integration.extend({ keyId: z.string().uuid() }),
    body: z.object({}),
    responses: { 200: integrationSchema, ...common },
  },
  access: {
    method: 'GET',
    path: base + '/:integrationId/access',
    pathParams: integration,
    query: z.object({
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    responses: {
      200: z.object({
        data: z.array(
          z.object({
            id: z.string().uuid(),
            requestId: z.string().uuid(),
            route: z.string(),
            method: z.string(),
            status: z.number(),
            resultCount: z.number(),
            durationMs: z.number(),
            observedAt: z.string().datetime(),
          }),
        ),
        nextCursor: z.string().nullable(),
      }),
      ...common,
    },
  },
});
const bot = '/integrations/v1/conferences/:conferenceId';
export const botReadContract = c.router({
  capabilities: {
    method: 'GET',
    path: bot + '/capabilities',
    pathParams: conference,
    query: z.object({}).strict(),
    responses: { 200: botCapabilitiesSchema, ...common },
  },
  papers: {
    method: 'GET',
    path: bot + '/papers',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botListSchema(botPaperSchema), ...common },
  },
  paper: {
    method: 'GET',
    path: bot + '/papers/:paperId',
    pathParams: conference.extend({ paperId: z.string().uuid() }),
    query: botQuerySchema,
    responses: { 200: botDetailSchema(botPaperSchema), ...common },
  },
  authors: {
    method: 'GET',
    path: bot + '/authors',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botListSchema(botAuthorSchema), ...common },
  },
  paperAuthors: {
    method: 'GET',
    path: bot + '/papers/:paperId/authors',
    pathParams: conference.extend({ paperId: z.string().uuid() }),
    query: botQuerySchema,
    responses: { 200: botListSchema(botAuthorSchema), ...common },
  },
  reviewers: {
    method: 'GET',
    path: bot + '/reviewers',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botListSchema(botReviewerSchema), ...common },
  },
  reviewerInvitations: {
    method: 'GET',
    path: bot + '/reviewer-invitations',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botListSchema(botReviewerInvitationSchema), ...common },
  },
  reviewer: {
    method: 'GET',
    path: bot + '/reviewers/:reviewerId',
    pathParams: conference.extend({ reviewerId: z.string().uuid() }),
    query: botQuerySchema,
    responses: { 200: botDetailSchema(botReviewerSchema), ...common },
  },
  assignments: {
    method: 'GET',
    path: bot + '/assignments',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botListSchema(botAssignmentSchema), ...common },
  },
  assignment: {
    method: 'GET',
    path: bot + '/assignments/:assignmentId',
    pathParams: conference.extend({ assignmentId: z.string().uuid() }),
    query: botQuerySchema,
    responses: { 200: botDetailSchema(botAssignmentSchema), ...common },
  },
  summary: {
    method: 'GET',
    path: bot + '/summary',
    pathParams: conference,
    query: botQuerySchema,
    responses: { 200: botDetailSchema(botSummarySchema), ...common },
  },
});
export const botWriteContract = c.router({
  createAssignment: {
    method: 'POST',
    path: bot + '/assignments',
    pathParams: conference,
    body: botCreateAssignmentSchema,
    responses: { 201: botCreateAssignmentResponseSchema, ...common },
  },
});
export const botApiContract = c.router({ ...botReadContract, ...botWriteContract });
