import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  reviewerInvitationSchema,
  invitationOperationSchema,
  invitationOperationsQuerySchema,
  invitationLifetimeSchema,
  bulkInvitationInputSchema,
  botAssignmentInterventionSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';
const c = initContract();
const base = '/integrations/v1/conferences/:conferenceId/reviewer-operations';
const conference = z.object({ conferenceId: z.string().uuid() });
const resource = conference.extend({ id: z.string().uuid() });
const common = {
  400: problemEnvelopeSchema,
  401: problemEnvelopeSchema,
  403: problemEnvelopeSchema,
  404: problemEnvelopeSchema,
  409: problemEnvelopeSchema,
  429: problemEnvelopeSchema,
  503: problemEnvelopeSchema,
};
const date = z.string().datetime(),
  count = z.number().int().nonnegative();
const operational = reviewerInvitationSchema.omit({
  invitedUserId: true,
  organizationId: true,
  roleNote: true,
});
const invitationRead = operational.extend({
  externalReference: z.string().nullable(),
  declineReason: z.string().nullable().optional(),
});
const jobState = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED']);
const invitationReadScopes =
  'invitations:read + reviewers:read + reviewers:identity:read + reviewers:contacts:read';
const invitationWriteScopes = 'invitations:write + ' + invitationReadScopes;
const counts = z.object({
  PENDING: count,
  SENT: count,
  ACCEPTED: count,
  DECLINED: count,
  EXPIRED: count,
  REVOKED: count,
});
const resultRow = z.object({
  row: count,
  rowId: z.string().nullable(),
  outcome: z.enum([
    'CREATED',
    'EXISTING',
    'SKIPPED_REVIEWER',
    'SKIPPED_AUTHOR',
    'DUPLICATE_IN_BATCH',
    'CLOSED_INVITATION',
    'INVALID',
  ]),
  message: z.string(),
  invitationId: z.string().uuid().optional(),
  input: z.unknown().optional(),
  invitationUrl: z.string().url().nullable(),
  declineUrl: z.string().url().nullable(),
});
export const reviewerOperationsContract = c.router({
  operationsInvitations: {
    method: 'GET',
    path: base + '/invitations',
    pathParams: conference,
    query: invitationOperationsQuerySchema,
    responses: {
      200: z.object({
        data: z.array(invitationRead),
        counts,
        nextCursor: z.string().uuid().nullable(),
        observedAt: date,
      }),
      ...common,
    },
    summary: 'Filtered invitation lifecycle ledger with status counts',
    description: `Required scopes: ${invitationReadScopes}. Private declineReason is present only with a currently valid invitations:responses:read scope. Cursor is a stable UUID; counts follow email/field/time filters before lifecycle and cursor pagination. No action secrets or internal account IDs are returned.`,
  },
  operationsInvitationChanges: {
    method: 'GET',
    path: base + '/invitation-changes',
    pathParams: conference,
    query: invitationOperationsQuerySchema.pick({ limit: true, cursor: true }).strict(),
    responses: {
      200: z.object({
        data: z.array(
          z.object({
            cursor: z.string(),
            invitationId: z.string().uuid(),
            action: z.string(),
            version: count,
            recordedAt: date,
          }),
        ),
        nextCursor: z.string(),
        hasMore: z.boolean(),
      }),
      ...common,
    },
    summary: 'Incremental invitation transitions, including worker-recorded expiry',
    description: `Required scopes: ${invitationReadScopes}. Use a decimal sequence cursor from 0 through the signed 64-bit maximum, not a UUID cursor. Follow hasMore and persist nextCursor after processing the page.`,
  },
  operationsInvitationAction: {
    method: 'POST',
    path: base + '/invitations/:id/actions',
    pathParams: resource,
    body: invitationOperationSchema,
    responses: {
      200: z.object({
        invitation: operational,
        invitationUrl: z.string().url().optional(),
        declineUrl: z.string().url().optional(),
        replayed: z.boolean(),
      }),
      ...common,
    },
    summary: 'Versioned expiry extension, reissue, revocation or explicit reinvitation',
    description: `Required scopes: ${invitationWriteScopes}. Stable requestId makes retries safe. EXTEND preserves links; REISSUE invalidates both old action links and marks Sent; REINVITE creates a new identity for a declined/revoked invitation. lifetimeDays means days from now (1–30). No email is sent. State change, idempotency ledger and access audit commit together.`,
  },
  operationsInvitationExtensions: {
    method: 'POST',
    path: base + '/invitation-extensions',
    pathParams: conference,
    body: z
      .object({
        operations: z
          .array(
            invitationOperationSchema.extend({
              invitationId: z.string().uuid(),
              action: z.literal('EXTEND'),
            }),
          )
          .min(1)
          .max(100),
      })
      .strict(),
    responses: {
      200: z.object({
        data: z.array(
          z.discriminatedUnion('success', [
            z.object({
              invitationId: z.string().uuid(),
              success: z.literal(true),
              invitation: operational,
            }),
            z.object({
              invitationId: z.string().uuid(),
              success: z.literal(false),
              status: z.number().int(),
              message: z.string(),
            }),
          ]),
        ),
      }),
      ...common,
    },
    summary: 'Extend up to 100 invitations with independent audited outcomes',
    description: `Required scopes: ${invitationWriteScopes}. Each row commits independently; reuse each row requestId after partial failure. New work stops after a 30-second request budget; remaining rows report 503 without being changed.`,
  },
  operationsInvitationBatch: {
    method: 'POST',
    path: base + '/invitation-batches',
    pathParams: conference,
    body: bulkInvitationInputSchema,
    responses: {
      202: z.object({
        id: z.string().uuid(),
        status: jobState,
        total: count,
        replayed: z.boolean(),
      }),
      413: problemEnvelopeSchema,
      ...common,
    },
    summary: 'Queue up to 1,000 structured personal invitations without sending email',
    description: `Required scopes: ${invitationWriteScopes}. Row schema: optional rowId (<=200), name, email, affiliation, researchFields and optional externalReference. Validation happens per row; malformed text is INVALID and does not abort valid peers. Submission, queue reference and access audit are atomic. 5 submissions/key/minute and a 2 MB JSON limit, within shared rate/concurrency limits.`,
  },
  operationsInvitationBatchStatus: {
    method: 'GET',
    path: base + '/invitation-batches/:id',
    pathParams: resource,
    responses: {
      200: z.object({
        id: z.string().uuid(),
        status: jobState,
        total: count,
        processed: count,
        createdAt: date,
        resultsExpireAt: date,
      }),
      ...common,
    },
    summary: 'Read resumable invitation job progress',
    description: `Required scopes: ${invitationReadScopes}. Job must belong to this integration and conference. Processed rows commit in chunks of 25. 60 progress reads/key/minute within the shared limits.`,
  },
  operationsInvitationBatchResults: {
    method: 'GET',
    path: base + '/invitation-batches/:id/results',
    pathParams: resource,
    query: z
      .object({
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .strict(),
    responses: {
      200: z.object({
        id: z.string().uuid(),
        status: jobState,
        total: count,
        processed: count,
        resultsExpired: z.boolean(),
        nextOffset: count.nullable(),
        data: z.array(resultRow),
      }),
      ...common,
    },
    summary: 'Read protected per-row outcomes and current-generation action links',
    description: `Required scopes: ${invitationReadScopes}. Job must belong to this integration and conference. Input and CREATED-row links expire after seven days; consumed, expired, revoked or replaced generations never yield live links. No generation hashes are returned. Uses offset pagination, not a cursor. 20 result reads/key/minute within shared limits.`,
  },
  operationsAssignmentAction: {
    method: 'POST',
    path: base + '/assignments/:id/actions',
    pathParams: resource,
    body: botAssignmentInterventionSchema,
    responses: {
      200: z.object({
        assignmentId: z.string().uuid(),
        message: z.string(),
        replayed: z.boolean(),
        notificationWarning: z.string().optional(),
      }),
      ...common,
    },
    summary: 'Release, atomically replace or extend unfinished reviewer work',
    description:
      'Required scopes: assignments:write + assignments:read + papers:read + reviewers:read. Reason, version and stable requestId are required. Replacement uses an integration-specific reviewerId and rejects deleted accounts, existing assignments and conflicts. Only current open cycles may change. Release retains drafts/history and removes active coverage. The mutation and access audit commit together.',
  },
  operationsCoverage: {
    method: 'GET',
    path: base + '/coverage',
    pathParams: conference,
    query: z
      .object({
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .strict(),
    responses: {
      200: z.object({
        observedAt: date,
        definitionVersion: z.literal('1'),
        eligiblePapers: count,
        zeroActive: count,
        oneActive: count,
        twoOrMoreActive: count,
        overdueOnly: count,
        operationallyUncovered: count,
        nextCursor: z.string().uuid().nullable(),
        data: z.array(
          z.object({
            paperId: z.string().uuid(),
            submissionNumber: z.string().nullable(),
            cycleId: z.string().uuid().nullable(),
            activeReviewers: count,
            submittedReviews: count,
            overdueAssignments: count,
            inconsistentAssignments: count,
            overdueOnly: z.boolean(),
          }),
        ),
      }),
      ...common,
    },
    summary: 'Named assignment coverage for current open review cycles',
    description:
      'Required scopes: analytics:read + assignments:read + papers:read + reviewers:read. UUID cursor pagination. Operationally uncovered = zero-active + overdue-only. Existing submitted-review shortfall metrics keep their meanings. Overdue never triggers automatic release.',
  },
  operationsInvitationSettings: {
    method: 'PATCH',
    path: base + '/invitation-settings',
    pathParams: conference,
    body: z.object({ lifetimeDays: invitationLifetimeSchema }).strict(),
    responses: { 200: z.object({ lifetimeDays: invitationLifetimeSchema }), ...common },
    summary: 'Set the conference default invitation lifetime',
    description: `Required scopes: ${invitationWriteScopes}. Range 1–30 days; initially 7. Existing invitations retain their expiry. Update and access audit commit together.`,
  },
});
