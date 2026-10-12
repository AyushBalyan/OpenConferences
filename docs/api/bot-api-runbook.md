# Bot API v1 — development and operations

This release adds a conference-scoped, read-only REST API and human credential controls under **Settings → Integrations**. It does not connect to Grok or any other third-party bot automatically. Give an issued key to a server-side bot or adapter that supports HTTP bearer authentication. Do not put keys in public prompts, browser bundles, or URL parameters.

## Enable and disable

The API is disabled by default. Deploy the additive migration `20261010120000_bot_integrations` using the existing migration owner. Keep the API on `openconferences_api` and the worker on `openconferences_worker`, both `NOBYPASSRLS`. Then configure:

```text
BOT_API_ENABLED=true
BOT_API_CURSOR_SECRET=<64 hexadecimal characters from 32 cryptographically random bytes>
```

Generate the cursor secret with `openssl rand -hex 32` and store it in the deployment secret manager. Use the same value on every API replica. Rotating it invalidates pagination cursors; clients restart pagination. It does not change issued bearer credentials. `BOT_API_ENABLED=false` stops human credential management and bot reads without changing the existing conference UI or business records. Keep existing worker scheduling enabled for retention.

Roll out to one synthetic/staging conference first. Verify capabilities, paper exclusions, limited reviewer identities, scope errors, expiry, revoke, Redis outage and audit outage before enabling real grants. This development change has not enabled the API in production or applied a production migration.

## Issue and rotate a credential

An organizer, chair, or organization admin with two-factor authentication can create an integration for one conference. Start with paper metadata or anonymous reviewer workloads. Author contacts, reviewer identity, and reviewer contacts require separate explicit grants. Dependency permissions are selected together. Review content and scores remain excluded regardless of scope.

Issue a key with a label, a subset of granted scopes, and a lifetime of 1–90 days (default 30). Copy the key once to the bot's secret manager. The server stores its SHA-256 digest, never the raw token. The UI holds the token only in memory. **Test access** calls this application's capabilities endpoint with that key; it sends nothing to the bot provider.

For rotation, issue a second key, update the bot's secret, verify access, then revoke the old key. Maximum two active keys per integration. Lost issue responses cannot be replayed to recover a token: inspect metadata, revoke the uncertain key, and issue a fresh one. Reauthorization under a different eligible human revokes existing keys. Revoking an integration is permanent; suspension is reversible.

Every bot request checks that its authorizer still has an eligible role, MFA, and an active user/conference/organization. Losing any of those blocks subsequent requests. A request already admitted may finish its bounded read. Existing keys cannot gain newly added grant scopes; issue a new key for expanded access.

## Contract and behavior

Generated contract: [bot-v1.openapi.json](bot-v1.openapi.json). Regenerate with `corepack pnpm --filter @openconferences/contracts openapi:bot`; CI checks for drift.

Effective URL prefix: `/api/v1/integrations/v1/conferences/{conferenceId}`. All endpoints are GET: capabilities, papers (list/detail), authors, paper authors, reviewers (list/detail), assignments (list/detail), summary. The additional integration version preserves the existing application API prefix.

Lists use opaque keyset cursors, default 25 and maximum 100 items. Keep filters unchanged between pages. Reviewer IDs are random references scoped to the integration, not user IDs. Each response represents its own repeatable-read snapshot; pages are not a frozen export. Timestamps and deadline comparisons are UTC. `submittedAt` on papers is null because legacy records do not store a reliable submission timestamp.

Draft papers are never exposed. Paper/author lists omit withdrawals by default; `includeWithdrawn=true` or an explicit withdrawal status includes them. Active summaries exclude both withdrawal statuses and drafts. Assignment/reviewer history defaults to CURRENT; ALL and HISTORICAL preserve prior review cycles and retired records. Submitted work requires an actual submitted review, not assignment status alone. Deadline precedence: individual, cycle, conference, assignment creation + 7 days. Due soon means the next 72 hours. Closed, retired, and inconsistent assignments do not count as overdue actionable work.

Names/emails are omitted when unscoped. Identity/contact search is rejected with 403 without its corresponding permission. Unsupported filters return 400. Foreign or hidden resource IDs return 404. No routes return PDFs, storage keys, review text, scores, conflicts, invitation tokens, billing data, or authorizer sessions.

Limits are shared through Redis: 60 requests/key/minute, 300/conference/minute, 2 concurrent requests/key and 10/conference. Pre-authentication abuse limit is 60/IP/minute. A 429 includes `Retry-After: 60`. Configure trusted proxies appropriately in the existing API deployment so clients cannot supply arbitrary source IPs. Business reads run in READ ONLY transactions, with a 3-second statement timeout and a 5-second interactive transaction timeout. Redis or durable access-recording failure produces 503 and no data response. Paginate and back off; do not continuously retry errors.

## Logs and retention

Settings shows active keys plus recent key metadata, authorizer, grant status, permissions, expiry/approximate last use, and paginated request metadata. No key secret can be retrieved later. Access history is ordered newest first using timestamp/ID keyset pagination; an expired or removed cursor requires refreshing the log. The integration access log stores route templates, status, result count, request ID, duration and timestamp. It stores no query values, IPs, request/response bodies or secrets. Ordinary API code cannot update or delete it. Unauthenticated failures are rate-limited but are not written as integration-attributed events.

Pino strips identifiers and query strings for integration URLs; Sentry integration events are dropped. SQL query logging is disabled to avoid credential digest exposure. Management changes are audited in the same transaction as the change. A separate worker retention queue runs every 15 minutes, deleting up to 1,000 access records older than 30 days per run. Under heavy volume, monitor backlog and schedule more bounded runs. Worker RLS forbids access to new credential tables and deletion of recent log records.

## Safe local testing

Use a disposable **local PostgreSQL cluster**, a database named `bot_api_test_*`, and task-owned local Redis. Never use the repository `.env` for bot test setup. The dedicated config rejects remote URLs and requires a marker in a separate `bot_test` schema. API/worker runtime users must be restricted roles; only the migration/fixture owner uses elevated privileges.

Provision the empty local DB and owner role first. Historical migrations expect the owner/provisioning role `openconferences` to exist; create it in that disposable cluster if using a differently named owner. Then explicitly set these shell variables (substitute your local port and credentials):

```sh
export BOT_API_TEST_OWNER_URL='postgresql://test_owner@127.0.0.1:55438/bot_api_test_local'
export BOT_API_TEST_DATABASE_URL='postgresql://openconferences_api@127.0.0.1:55438/bot_api_test_local'
export BOT_API_TEST_REDIS_URL='redis://127.0.0.1:56388/15'
export BOT_API_TEST_MARKER='my-disposable-bot-api-cluster'
BOT_API_TEST_ALLOW_MIGRATIONS=true corepack pnpm db:prepare:bot
```

Provision `LOGIN` and local-only passwords for `openconferences_api` and `openconferences_worker` using the owner on **that cluster only**. The worker test derives the worker username from the validated runtime URL, using the same local password. The migration helper never resets/drops a DB or provisions passwords. It checks locality, database prefix, owner/runtime target equality and marker ownership before migrations.

```sh
ENFORCE_DB_ROLE_CHECK=true corepack pnpm test:bot
corepack pnpm test:e2e:bot
```

The dedicated backend tests exercise actual HTTP controllers, PostgreSQL RLS, Redis, read-only transactions and retention. Human sessions are synthetic test stubs; membership and MFA checks use real fixtures. Browser tests start only a local Next.js server on port 3007 and intercept API requests with synthetic fixtures, covering management actions and responsive behavior. They do not start an API server or connect to any database. These tests are wired into CI alongside existing release gates. Stop and remove only your task-owned local services after testing; never run global cleanup commands against shared services.

## Client example

[bot-client.mjs](bot-client.mjs) lists paper metadata without logging response bodies. Supply `BOT_API_BASE_URL`, `BOT_CONFERENCE_ID` and `BOT_API_KEY` from private server-side environment variables. To use a model bot, build the adapter on its server/tool side and restrict the data it forwards according to your conference policy. OAuth, MCP, direct provider integrations, file downloads, writes and webhooks are outside v1.
