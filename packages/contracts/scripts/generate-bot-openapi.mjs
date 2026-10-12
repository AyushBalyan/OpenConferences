import { generateOpenApi } from '@ts-rest/open-api';
import { botReadContract } from '../dist/index.js';
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
  botReadContract,
  {
    info: {
      title: 'OpenConferences read-only Bot API',
      version: '1.0.0',
      description:
        'Conference-scoped read access. All timestamps are UTC. Names and contacts are omitted without explicit identity/contact scopes. Review content, scores, conflicts, invitations, payments, files and mutations are excluded. Each page is a consistent read snapshot; different pages may observe concurrent updates. A missing historical submittedAt is null, not an estimate. Secrets are shown only once by the human management API.',
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
      const key = Object.entries(botReadContract).find(([, r]) => r.path === route.path)?.[0];
      const [scopes, filters] = details[key];
      op.description = `Required scopes: ${scopes}. Supported filters: ${filters} Unsupported non-default filters return 400. Lists accept limit (1–100, default 25) and cursor. Cursors are opaque and bound to integration, scope, resource and filters; reuse with unchanged filters. history defaults to CURRENT. Defaults may appear in meta.filters even if inapplicable to this endpoint. 401 invalid/expired/revoked credential; 403 missing scope; 404 foreign or hidden resource; 429 rate/concurrency limit with Retry-After; 503 controls or access auditing unavailable. Responses use Cache-Control: no-store. Limits: 60 requests/key/minute, 300/conference/minute; 2 concurrent/key, 10/conference. Pre-authentication abuse limit: 60/IP/minute.`;
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
  if (readFileSync(target, 'utf8') !== output)
    throw new Error('Bot OpenAPI drift: run pnpm --filter @openconferences/contracts openapi:bot');
} else writeFileSync(target, output);
