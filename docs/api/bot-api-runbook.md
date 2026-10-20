# Bot API v1 — development and operations

This release adds conference-scoped REST reads, opt-in paper assignments with individual deadlines, link-only reviewer invitations, and human credential controls under **Settings → Integrations**. It does not connect to Grok or any other third-party bot automatically. Give an issued key to a server-side bot or adapter that supports HTTP bearer authentication. Do not put keys in public prompts, browser bundles, or URL parameters.

## Enable and disable

The API is disabled by default. Deploy the additive migrations `20261010120000_bot_integrations`, `20261020090000_bot_assignment_writes`, and `20261020120000_bot_reviewer_invitations` using the existing migration owner. Keep the API on `openconferences_api` and the worker on `openconferences_worker`, both `NOBYPASSRLS`. Then configure:

```text
BOT_API_ENABLED=true
BOT_API_CURSOR_SECRET=<64 hexadecimal characters from 32 cryptographically random bytes>
```

Generate the cursor secret with `openssl rand -hex 32` and store it in the deployment secret manager. Use the same value on every API replica. Rotating it invalidates pagination cursors; clients restart pagination. It does not change issued bearer credentials. `BOT_API_ENABLED=false` stops human credential management, bot reads, assignments, and invitation operations without changing the existing conference UI or business records. Keep existing worker scheduling enabled for retention.

Roll out to one synthetic/staging conference first. Verify capabilities, paper exclusions, limited reviewer identities, scope errors, expiry, revoke, Redis outage and audit outage before enabling real grants. This development change has not enabled the API in production or applied a production migration.

## Issue and rotate a credential

An organizer, chair, or organization admin with two-factor authentication can create an integration for one conference. Start with paper metadata or anonymous reviewer workloads. Author contacts, reviewer identity, and reviewer contacts require separate explicit grants. Dependency permissions are selected together. Review content and scores remain excluded regardless of scope.

Issue a key with a label, a subset of granted scopes, and a lifetime of 1–90 days (default 30). Copy the key once to the bot's secret manager. The server stores its SHA-256 digest, never the raw token. The UI holds the token only in memory. **Test access** calls this application's capabilities endpoint with that key; it sends nothing to the bot provider.

For rotation, issue a second key, update the bot's secret, verify access, then revoke the old key. Maximum two active keys per integration. Lost issue responses cannot be replayed to recover a token: inspect metadata, revoke the uncertain key, and issue a fresh one. Reauthorization under a different eligible human revokes existing keys. Revoking an integration is permanent; suspension is reversible.

Every bot request checks that its authorizer still has an eligible role, MFA, and an active user/conference/organization. Losing any of those blocks subsequent requests. A request already admitted may finish its bounded read. Existing keys cannot gain newly added grant scopes; issue a new key for expanded access.

## Contract and behavior

Generated contract: [bot-v1.openapi.json](bot-v1.openapi.json). Regenerate with `corepack pnpm --filter @openconferences/contracts openapi:bot`; CI checks for drift.

Effective URL prefix: `/api/v1/integrations/v1/conferences/{conferenceId}`. Read endpoints are GET: capabilities, papers (list/detail), authors, paper authors, reviewers (list/detail), reviewer-invitations, assignments (list/detail), summary. Writes are `POST /assignments`, `POST /reviewer-invitations`, and `DELETE /reviewer-invitations/{invitationId}`. Shareable invitation URLs use `GET /reviewer-invitations/{invitationId}/link`. The additional integration version preserves the existing application API prefix.

Lists use opaque keyset cursors, default 25 and maximum 100 items. Keep filters unchanged between pages. Reviewer IDs are random references scoped to the integration, not user IDs. Each response represents its own repeatable-read snapshot; pages are not a frozen export. Timestamps and deadline comparisons are UTC. `submittedAt` on papers is null because legacy records do not store a reliable submission timestamp.

Draft papers are never exposed. Paper/author lists omit withdrawals by default; `includeWithdrawn=true` or an explicit withdrawal status includes them. Active summaries exclude both withdrawal statuses and drafts. Assignment/reviewer history defaults to CURRENT; ALL and HISTORICAL preserve prior review cycles and retired records. Submitted work requires an actual submitted review, not assignment status alone. Deadline precedence: individual, cycle, conference, assignment creation + 7 days. Due soon means the next 72 hours. Closed, retired, and inconsistent assignments do not count as overdue actionable work.

Names/emails are omitted when unscoped. Identity/contact search is rejected with 403 without its corresponding permission. Unsupported filters return 400. Foreign or hidden resource IDs return 404. No routes return PDFs, storage keys, review text, scores, conflict details, billing data, or authorizer sessions. Invitation tokens appear only inside shareable invitation URLs, available only with the explicit invitation permissions described below.

Limits are shared through Redis: 60 requests/key/minute, 300/conference/minute, 2 concurrent requests/key and 10/conference. Pre-authentication abuse limit is 60/IP/minute. A 429 includes `Retry-After: 60`. Configure trusted proxies appropriately in the existing API deployment so clients cannot supply arbitrary source IPs. Business reads run in READ ONLY transactions, with a 3-second statement timeout and a 5-second interactive transaction timeout. Mutations use separate bounded read/write transactions. Redis or durable access-recording failure produces 503; a mutation rolls back if its business audit, idempotency result, or success access record cannot be stored. Paginate and back off; do not continuously retry errors.

## Reviewer status and assignment writes

`GET /reviewers` returns `status: ACCEPTED` for current conference reviewer members, including manually granted membership; historical reviewers whose role was removed return `INACTIVE`. Pending invitees are not conference reviewer members yet. Use `GET /reviewer-invitations?invitationStatus=PENDING` or `ACCEPTED` to see invitation status. This requires `reviewers:read`; names and emails still require the existing identity/contact scopes. The endpoint also supports `DECLINED`, `EXPIRED`, email search with contact permission, and cursor pagination. An expired pending invitation is reported as `EXPIRED` even if its database row has not been updated. `canAssign` and `reviewerId` are populated only when an accepted invitation belongs to a current reviewer member. This status list never exposes invitation URLs; use the separately scoped link endpoint below.

To enable writes, edit the integration in Settings → Integrations and select **Assign papers with a deadline** (`assignments:write`). Its read dependencies are selected together. Issue a new key explicitly selecting the same write permission. Existing keys cannot gain write access merely by expanding the integration grant.

Send `POST /assignments` with a stable UUID `requestId`, `paperId`, integration-specific `reviewerId` from the reviewer reads, and a required future ISO `dueAt` containing UTC or an explicit offset. Optional `cycleId` must be the paper's current cycle. An eligible submitted paper with no cycle gets its first cycle in the same transaction. Drafts, withdrawals, decided cycles, historical cycles, foreign references, absent reviewer membership, authorship, declared conflicts, conflict bids, and duplicate assignments are rejected. An email address alone is not an assignment identifier; pending invitations cannot be assigned.

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "paperId": "00000000-0000-4000-8000-000000000002",
  "reviewerId": "00000000-0000-4000-8000-000000000003",
  "dueAt": "2030-01-02T17:30:00+05:30"
}
```

The response is `201` with the assignment in `data` and `replayed: false`. Reuse the same request ID and normalized payload after a timeout; a successful replay returns the original assignment snapshot with `replayed: true`. Reusing that ID with different details returns `409`. Idempotency is scoped to the integration, survives key rotation, and its small result records are retained while the integration exists. Authentication and write permission are checked again before every replay. The mutation audit identifies the human authorizer, integration, key and request ID. No bearer secret is stored in the mutation ledger.

Normal reviewer assignment email is queued after the assignment commits and includes the explicit individual deadline. `notificationWarning` means the assignment exists but the email could not be queued; inspect the email log and use the dashboard reminder action if necessary. Replaying a completed request does not queue a second email or change the deadline. There is no bot permission to replace/unassign reviewers, edit reviews, send invitation emails, or record decisions in this release.

## Link-only reviewer invitations

Invitation links require an **organizer or organization administrator** with MFA as the integration authorizer. A chair alone cannot grant these permissions, issue invitation-enabled keys, or reauthorize an invitation-enabled integration under their own account. An organizer can reauthorize a chair-owned integration first (revoking its old keys), then add invitation access and issue a new key. Losing organizer/org-admin membership blocks invitation operations even if the authorizer remains a chair.

Select **Generate and remove reviewer invitations** (`invitations:write`) in Settings → Integrations. This selects **Read reviewer invitation links** (`invitations:read`), reviewer workload, reviewer names, and reviewer email dependencies. Issue a new key explicitly selecting invitation access again; existing keys keep their permissions. A key with just `invitations:read` and its dependencies can retrieve links but cannot generate or remove invitations.

All paths below use the conference prefix above and bearer authentication. Generate links with:

```http
POST /reviewer-invitations
Content-Type: application/json

{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "emails": ["reviewer@example.com", "another@example.com"]
}
```

The `201` response contains `data` entries with `id`, normalized `email`, `status`, `invitationUrl`, and UTC `expiresAt`, plus `replayed` and `message`. Supply 1–25 valid email addresses. Addresses are trimmed, lowercased, deduplicated, and sorted; each entry identifies its email explicitly. A live pending invitation is reused without extending its deadline; a new invitation expires in seven days. Invitations appear in the normal dashboard pending list and grant no reviewer role until accepted. The recipient must sign in as the invited email address. **No invitation email is sent.** Share the returned URL manually using your own process.

Find invitation IDs through `GET /reviewer-invitations?invitationStatus=PENDING&email=reviewer%40example.com`, then read an existing link with `GET /reviewer-invitations/{invitationId}/link`. It returns the same entry shape directly. Only unexpired pending links are shareable: accepted, declined, and expired invitations return `409`; missing/removed/foreign invitations return `404`. Status-list reads do not return URLs.

Remove a pending invitation with:

```http
DELETE /reviewer-invitations/{invitationId}
Content-Type: application/json

{"requestId": "00000000-0000-4000-8000-000000000002"}
```

The `200` response confirms `id`, `removed: true`, `replayed`, and a message. Its link immediately stops resolving. Accepted, declined, or explicitly expired records return `409`; an elapsed invitation still stored as pending can be removed. Removal never removes reviewer membership or submitted reviews and never sends email.

Keep each mutation's UUID `requestId` stable after a timeout. The same generation request and normalized email set replay the original invitation IDs; reordered/duplicated emails do not create extra invitations. On replay, `invitationUrl` is null for accepted/declined/expired/removed entries (`status: REMOVED` if deleted). Replaying never recreates removed invitations or extends expiry. Use a **new** request ID when deliberately creating another invitation. Removal retries with the same request ID and invitation ID return success even after deletion. Reusing an ID with a different email set, invitation, or mutation type returns `409`; request IDs are shared across all mutations for an integration and survive key rotation.

Treat returned URLs as private. Responses use `Cache-Control: no-store`. The mutation ledger stores invitation IDs only; audits and access logs exclude invitation tokens, URLs, and addresses. Generation/removal, the mutation audit, idempotency record, and success access record commit together. An audit failure rolls back the entire batch or deletion.

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

Provision `LOGIN` and local-only passwords for `openconferences_api` and `openconferences_worker` using the owner on **that cluster only**. The worker test derives the worker username from the validated runtime URL, using the same local password. The migration helper never resets/drops a DB or provisions passwords. It checks locality, database prefix, owner/runtime target equality and marker ownership before running the shared `prisma/predeploy.sql` and migrations. The pre-migration SQL creates the `pgboss` schema required by historical permission grants on an empty database.

```sh
ENFORCE_DB_ROLE_CHECK=true corepack pnpm test:bot
corepack pnpm test:e2e:bot
```

The dedicated backend tests exercise actual HTTP controllers, PostgreSQL RLS, Redis, read-only transactions and retention. Human sessions are synthetic test stubs; membership and MFA checks use real fixtures. Browser tests start only a local Next.js server on port 3007 and intercept API requests with synthetic fixtures, covering management actions and responsive behavior. They do not start an API server or connect to any database. These tests are wired into CI alongside existing release gates. Stop and remove only your task-owned local services after testing; never run global cleanup commands against shared services.

## Client example

[bot-client.mjs](bot-client.mjs) lists paper metadata without logging response bodies. Supply `BOT_API_BASE_URL`, `BOT_CONFERENCE_ID` and `BOT_API_KEY` from private server-side environment variables. To use a model bot, build the adapter on its server/tool side and restrict the data it forwards according to your conference policy. OAuth, MCP, direct provider integrations, file downloads, mutations other than paper assignment, and webhooks are outside v1.
