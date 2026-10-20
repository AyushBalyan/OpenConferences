import { generateOpenApi } from '@ts-rest/open-api';
import { botApiContract } from '../dist/index.js';
import { writeFileSync, readFileSync } from 'node:fs';
const details = {
  capabilities: ['No additional scope', 'No filters. Reports effective scopes and limits.'],
  papers: [
    'papers:read',
    'trackId, status, includeWithdrawn, q. Draft papers are always excluded.',
  ],
  paper: ['papers:read', 'includeWithdrawn. Draft papers are always excluded.'],
  authors: [
    'authors:read + papers:read',
    'paperId, trackId, status, includeWithdrawn, q, email (requires authors:contacts:read).',
  ],
  paperAuthors: [
    'authors:read + papers:read',
    'trackId, status, includeWithdrawn, q, email (requires authors:contacts:read).',
  ],
  reviewers: [
    'reviewers:read',
    'trackId, paperId, history, cycleNumber, attention, q (requires reviewers:identity:read), email (requires reviewers:contacts:read).',
  ],
  reviewer: [
    'reviewers:read',
    'trackId, paperId, history, cycleNumber. IDs are integration-specific opaque references.',
  ],
  reviewerInvitations: [
    'reviewers:read',
    'invitationStatus (PENDING, ACCEPTED, DECLINED, EXPIRED), email (requires reviewers:contacts:read). Pending invitations have no assignable reviewerId. This list never includes invitation links. Use the separately scoped invitation-link endpoint.',
  ],
  invitationLink: [
    'invitations:read + reviewers:read + reviewers:identity:read + reviewers:contacts:read',
    'No filters. Returns the shareable link for an unexpired pending invitation. Requires an organizer or organization-admin authorizer. Consumed/expired invitations return 409; removed/foreign IDs return 404. Sign-in as the invited email is still required.',
  ],
  generateInvitations: [
    'invitations:write + invitations:read + reviewers:read + reviewers:identity:read + reviewers:contacts:read',
    'JSON body: requestId (UUID stable for retries), emails (1–25 valid email addresses, normalized and deduplicated). Reuses live pending invitations; otherwise creates normal seven-day pending invitations and returns their invitationUrl. No email is sent. Requires an organizer or organization-admin authorizer. Same requestId and normalized email set replay the original invitation IDs; links are returned only while still pending and unexpired. Removed/consumed links are null on replay and are never recreated. Reusing requestId with different operation details returns 409.',
  ],
  removeInvitation: [
    'invitations:write + invitations:read + reviewers:read + reviewers:identity:read + reviewers:contacts:read',
    'JSON body: requestId (UUID stable for retries). Removes only a pending invitation (including expired pending rows) and invalidates its link. Accepted/declined/expired status records return 409 and retain membership/history. Same requestId and invitation ID replay the successful removal. Foreign/missing IDs return 404 for a new request. No email is sent. Requires an organizer or organization-admin authorizer.',
  ],
  createAssignment: [
    'assignments:write + assignments:read + papers:read + reviewers:read',
    'JSON body: requestId (UUID, stable for retries), paperId, integration-specific reviewerId, dueAt (required future ISO timestamp with UTC/offset), optional current cycleId. Only accepted conference reviewers and open current paper cycles. Same requestId and payload replay the original assignment; reuse with different payload returns 409. Normal assignment email uses this deadline; notificationWarning reports a queue failure without undoing the saved assignment. Replays do not send another email.',
  ],
  assignments: [
    'assignments:read + papers:read + reviewers:read',
    'trackId, paperId, reviewerId, history, cycleId, cycleNumber, progress, overdue.',
  ],
  assignment: [
    'assignments:read + papers:read + reviewers:read',
    'history. Retired assignments appear only with history=ALL or HISTORICAL.',
  ],
  summary: [
    'analytics:read',
    'trackId only. Current-cycle totals; drafts and withdrawals do not inflate active counts. No pagination.',
  ],
};
const doc = generateOpenApi(
  botApiContract,
  {
    info: {
      title: 'OpenConferences Bot API',
      version: '1.2.0',
      description:
        'Conference-scoped reads, explicitly granted paper assignments with deadlines, and link-only reviewer invitations. Existing keys retain their original permissions. All response timestamps are UTC. Names and contacts are omitted without explicit identity/contact scopes. Review content, scores, conflict details, payments, files and other mutations are excluded. Invitation tokens appear only inside shareable invitation URLs, which require explicit invitation scopes and organizer authorization. Each read page is a consistent snapshot; different pages may observe concurrent updates. A missing historical submittedAt is null, not an estimate. Bearer credentials are shown only once by the human management API.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        BotKey: {
          type: 'http',
          scheme: 'bearer',
          description:
            'ocbot_v1.<public-key-id>.<secret>; expires in at most 90 days. One conference per key. Never pass keys in query strings.',
        },
      },
    },
    security: [{ BotKey: [] }],
  },
  {
    setOperationId: true,
    operationMapper: (op, route) => {
      const key = Object.entries(botApiContract).find(
        ([, r]) => r.path === route.path && r.method === route.method,
      )?.[0];
      const [scopes, filters] = details[key];
      op.description = `Required scopes: ${scopes}. ${route.method !== 'GET' ? 'Request' : 'Supported filters'}: ${filters} Unsupported fields/non-default filters return 400. Read lists accept limit (1–100, default 25) and cursor. Cursors are opaque and bound to integration, scope, resource and filters; reuse with unchanged filters. Read history defaults to CURRENT. Defaults may appear in meta.filters even if inapplicable to this endpoint. 401 invalid/expired/revoked credential; 403 missing scope; 404 foreign or hidden resource; 409 operation or invitation-state conflict; 429 rate/concurrency limit with Retry-After; 503 controls or access auditing unavailable. Responses use Cache-Control: no-store. Limits: 60 requests/key/minute, 300/conference/minute; 2 concurrent/key, 10/conference. Pre-authentication abuse limit: 60/IP/minute.`;
      op.responses['429'].headers = {
        'Retry-After': {
          description: 'Seconds before retry',
          schema: { type: 'integer', example: 60 },
        },
      };
      return op;
    },
  },
);
const output = JSON.stringify(doc, null, 2) + '\n';
const target = new URL('../../../docs/api/bot-v1.openapi.json', import.meta.url);
if (process.argv.includes('--check')) {
  // Repository formatting hooks may reflow arrays without changing the contract.
  if (JSON.stringify(JSON.parse(readFileSync(target, 'utf8'))) !== JSON.stringify(doc))
    throw new Error('Bot OpenAPI drift: run pnpm --filter @openconferences/contracts openapi:bot');
} else writeFileSync(target, output);
