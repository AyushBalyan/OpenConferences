# Read-only Bot API: first-release implementation plan

Status: implemented locally, 10 October 2026. This document preserves the approved release plan and links the implementation evidence below. Development and database testing use an isolated local temporary database; the production database configuration is not used.

Implementation status (10 October 2026): v1 is implemented locally, including the isolated HTTP/RLS suite, Settings → Integrations, browser coverage, generated OpenAPI, worker retention and CI wiring. The feature is disabled by default and has not been deployed or enabled in production. See [the runbook](api/bot-api-runbook.md) for configuration, local test commands and supported behavior. The sections below preserve the approved release plan; [verification notes](api/bot-api-verification.md) record what was actually exercised.

## 1. Outcome and release boundary

An authorized conference organizer or chair can create a named integration, issue a limited credential, and let a bot retrieve submission metadata, author information, reviewer workload, assignment progress, and conference summaries. The integration can neither edit conference data nor send reminders, invitations, or other messages.

Success example: a bot answers “Which reviewers have overdue reviews, on which papers, and what are their deadlines?” using current records, with reviewer names available only when explicitly permitted. A second integration can read paper metadata without gaining access to author identities or reviewer information.

Include in the first release:

- One conference per integration, with independently revocable, expiring credentials.
- Versioned JSON REST endpoints and a generated OpenAPI specification.
- Separate scopes for metadata, identity, and contact details.
- Current-cycle defaults and explicit historical-cycle browsing.
- Server-side pagination, bounded filtering, read-only query enforcement, rate limits, and access auditing.
- A small conference Settings → Integrations interface for credential lifecycle management and recent access records.
- A documented server-side client example usable by a bot connector, with synthetic data only.

Exclude from this release:

- Write tools, emails, reminder actions, assignments, deadline changes, or invitation acceptance.
- Draft papers, manuscript downloads, storage keys, signed file URLs, full review text, confidential review comments, scores, conflict declarations, private review drafts, rebuttal content, billing, and authentication records.
- Organization-wide or cross-conference credentials; public anonymous access; reviewer/author self-service bot grants.
- OAuth delegation, a full MCP server, webhook delivery, arbitrary SQL, arbitrary GraphQL expansion, semantic search, and bulk exports.
- A guarantee of native Grok Bot integration. REST compatibility and native connector onboarding are separate deliverables.

## 2. Existing code and integration points

The existing backend is NestJS, with ts-rest contracts, Zod schemas, Prisma, and PostgreSQL RLS. These are the foundations to reuse:

- `apps/api/src/common/guards/auth.guard.ts`: human session authentication. Keep this behavior unchanged.
- `apps/api/src/common/guards/membership.guard.ts`: route membership, organization inheritance, role checks, and MFA requirements.
- `apps/api/src/tenancy/role-hierarchy.ts`: organizer/chair authorization helpers.
- `packages/db/src/index.ts`: transaction-local user, organization, and conference context. Add an opt-in read-only helper without changing existing callers' default behavior.
- `packages/contracts/src/` and `packages/schemas/src/`: new dedicated integration contracts and DTOs.
- `apps/api/src/review/reviewer-overview.service.ts` and coordination/analytics services: established workload, history, and eligible-paper behavior.
- Shared `effectiveReviewDeadline` and reviewer workload helpers: reuse these rules rather than inventing another definition.
- `apps/api/src/audit/audit.service.ts`: human management-event auditing. Existing logging catches write errors, so it is insufficient by itself for the proposed durable access-record guarantee.
- `apps/api/src/common/middleware/auth-rate-limit.middleware.ts`: limits auth routes only. Bot reads need their own limiter.

The application sets `/api/v1` as its default global prefix. Use effective bot routes under `/api/v1/integrations/v1/…`; contract paths start at `/integrations/v1/…`. This accounts for the prefix instead of accidentally documenting unreachable `/api/integrations/v1` routes. A future application prefix change must update generated documentation consistently.

## 3. Authorization and ownership

### Human management access

- ORG_ADMIN, ORGANIZER, and CHAIR can manage integrations within conferences where their current effective roles permit review coordination.
- Use existing session, membership, organization inheritance, and MFA checks. No new platform-admin bypass is introduced.
- Each integration has an `authorizedByUserId`, initially the human who creates it. This is its permission ceiling, not an impersonated bot session.
- Every bot request checks that this authorizer still exists, still has an eligible current conference/org role, and still satisfies the existing privileged-role MFA policy. Otherwise deny access.
- Other authorized conference managers may suspend/revoke an integration. Explicit reauthorization assigns a new eligible authorizer, preserves the integration ID and history, and revokes all existing keys; issue a new key afterward.
- Requests admitted before revocation may finish. New requests after the committed revocation must fail; do not cache successful authorization in release one.

### Bot access

Effective access is the intersection of active integration state, active credential state/expiry, credential scopes, integration scopes, current authorizer permissions, conference visibility policy, and requested resource scope.

- A key cannot select a different conference or organization through path, query, cursor, header, or related-object ID.
- `IntegrationPrincipal` contains integration ID, key ID, authorized conference/org, authorizer ID, and effective scopes. Do not manufacture an `AuthUser` or attach organizer roles to a bot request.
- Only the dedicated bot controller accepts this principal. Existing human controllers continue to require actual user sessions.
- Keys never grant write permission. A bot key presented to any existing mutation endpoint must not authenticate as a human.
- Scope increases require an explicit human grant change and a new key. Keys retain their originally issued scope ceiling. Reductions apply to existing keys immediately.
- Suspension is reversible; key revocation is permanent. Restoring an integration does not restore revoked keys.
- Disabled/deleted conferences, organizations, and deleted authorizers fail closed. Archived conferences may be read by currently authorized grants, with history semantics preserved.

### Identity and field scopes

- `papers:read`: paper metadata and submission lifecycle status.
- `authors:read`: per-paper authorship names, affiliations, order, and corresponding-author flag. Requires `papers:read`.
- `authors:contacts:read`: author email. Requires `authors:read`.
- `reviewers:read`: reviewer aliases/IDs and workload counts.
- `reviewers:identity:read`: reviewer name. Requires `reviewers:read`.
- `reviewers:contacts:read`: reviewer email. Requires `reviewers:identity:read`.
- `assignments:read`: paper-to-reviewer assignment links, progress, cycles, and effective deadline. Requires `papers:read` and `reviewers:read`.
- `analytics:read`: aggregate submission/review/workload totals without named rankings or identity-bearing breakdowns.

Reject invalid scope combinations when creating grants or keys. New integrations start with paper metadata only; the human explicitly chooses additional scopes. New credentials default to a subset of the integration grant, never silently to every scope.

No endpoint may reveal author identities through nested paper data, reviewer names through summary rankings, or emails through search/error text without the corresponding scope. Searches on identity fields require the identity scope; email searches require the contact scope. Filter options, counts, and ordering also count as information disclosure surfaces.

Release one serves a privileged conference-management audience. Identity scopes explicitly authorize management-level identity access even in a double-blind conference; they do not make identities public or reviewer-accessible. Identity-free responses must omit author data and return reviewer aliases. Full reviews and COI information remain excluded regardless of scopes.

## 4. Credential lifecycle and storage

- Generate at least 32 random bytes of secret material using Node cryptographic randomness.
- Token format: a recognizable version prefix, public key ID, and random secret. Accept it only as `Authorization: Bearer …` over HTTPS; never accept a query-string token.
- Store a SHA-256 digest of the high-entropy token/secret plus its version and public key ID. Do not store recoverable plaintext. This is a random API credential, not a human password.
- Compare fixed-length digests safely, reject malformed/oversized tokens before database work, and return a generic invalid-credential response for wrong, unknown, expired, or revoked keys.
- Display plaintext only in the successful issuance response. Redact issuance response bodies, authorization headers, digests, and SQL parameters from logs, tracing, and error reporting.
- Default lifetime: 30 days. Maximum lifetime: 90 days. No non-expiring keys in release one.
- Maximum two active, unexpired keys per integration supports rotation. Enforce issuance limits transactionally, not through UI checks alone.
- Rotation: issue second key, configure the connector, test it, then revoke the old key. No silent grace period after revocation.
- Use a client request ID for key issuance/reauthorization to prevent accidental duplicate credentials. An idempotent retry must never redisplay an already-issued secret; return metadata and explain how to revoke/reissue if the original response was lost.
- No credential delivery by email and no credentials in browser localStorage, URLs, downloadable request logs, or source control.

## 5. Proposed additive data model

### ApiIntegration

UUID ID; organization ID; conference ID; name; optional purpose; status ACTIVE/SUSPENDED/REVOKED; allowed scopes; authorizer user ID; created-by user ID; created/updated timestamps; revoked-at/by; optimistic version. Bound name/purpose lengths, and sanitize them for display/logging.

### ApiIntegrationKey

UUID public ID; integration ID; organization/conference IDs for direct policy evaluation; label; credential version; secret digest; issued scopes; created-by user ID; created-at; expires-at; revoked-at/by; approximate last-used-at; issuance request ID. Keep credential metadata when revoked so historical audit references remain valid.

### ApiIntegrationAccessLog

UUID ID; integration/key IDs; organization/conference IDs; request ID; route template; method; response status; result count; duration; observed-at; normalized outcome/reason. Do not persist raw query strings, search text, paper titles, person names, emails, response bodies, authorization headers, or full client IPs. Human management changes remain separate audit events.

### ApiIntegrationReviewerReference

Random UUID external ID; integration ID; organization/conference IDs; internal reviewer user ID; created-at. Unique `(integrationId, reviewerUserId)` and external ID. This small metadata mapping provides stable opaque reviewer identifiers without exposing platform user IDs or inventing reversible/deterministic cryptography. Create missing references through the controlled metadata path for already-authorized reviewer rows, using an idempotent upsert; do not write them inside the business read transaction. Resolving a reference still requires current roster/resource authorization, so a stale reference is never an access grant.

Constraints and indexes:

- Enforce parent organization/conference consistency with composite unique keys/FKs; a key/log/reviewer reference cannot claim a conference different from its integration.
- FK authorizer/creator references preserve audit meaning; a deleted/invalid authorizer disables reads rather than transferring authority.
- Unique public key ID and issuance request ID scoped to integration; unique secret digest.
- Index integration listings by `(conferenceId, createdAt, id)`, keys by integration/expiry/revocation, and access logs by `(conferenceId, observedAt, id)` plus integration ID/time where needed.
- Store scopes as validated, canonical values; enforce an allowlist and scope dependencies in the service, with migration constraints for allowed values where practical.
- Apply RLS and explicit grants to all new tables. Existing default privileges grant API/worker DML on new public tables: explicitly revoke unnecessary worker privileges in this migration.
- Access logs are append-only for normal API requests; only an authorized retention operation can remove old records.
- Retain access records for 30 days; integrate a bounded retention task with the existing worker, granting only the required cleanup privilege. Never grant worker access to credential digests for convenience.

No paper/review data backfill, changed business-table ownership, destructive column changes, or new blanket RLS exceptions are required.

## 6. Database read path and credential bootstrap

### Authenticate without a human session

Key authentication occurs before the authorizer can be used as tenant context. Do not fix this by connecting as the migration owner, bypassing RLS, or trusting a client-supplied authorizer ID.

Implement a narrow credential repository that looks up one public key ID/digest pair. Recommended first-release approach: transaction-local candidate key ID and candidate digest settings used only by SELECT policies on the new integration/key tables. Candidate-key SELECT must match both values; the parent grant may be read only through that matched key. Human management policies use direct conference membership checks. Keep key-policy evaluation independent of parent-grant policies to avoid recursive RLS joins.

The server alone derives these settings from the bearer token. A match yields only the grant/credential metadata needed to authenticate. Check expiry, revocation, grant state, tenant consistency, current authorizer roles/MFA, and scopes before any business read. Clear context automatically at transaction end. Regression tests must prove that absent/wrong settings reveal nothing.

This bootstrap and its RLS policies are the first technical spike. If current policy helpers prevent a nonrecursive implementation, resolve and review an equally narrow alternative before implementing data endpoints; do not relax business-data RLS or add a privileged global lookup client as a shortcut.

### Read business data

- Run business queries as the existing safe, NOBYPASSRLS runtime role, with the validated authorizer's user ID and validated organization/conference in transaction-local context. Authorization and audit still identify the integration/key as the caller.
- Extend the database helper with an explicit read-only variant/option. Start READ ONLY before tenant-context queries or other statements; use REPEATABLE READ for internally consistent multi-query summaries.
- Verify that writes to permanent business tables fail inside this transaction. Do not globally change the shared Prisma client or normal web transactions to read-only.
- The integration query layer receives the restricted transaction client; it cannot reach a write-capable global Prisma client, queues, mailers, or mutation services.
- Use explicit Prisma field selections and pure shared calculations. Do not return existing paper DTOs, full reviewer DTOs, or arbitrary relations and redact afterward.
- Keep key-use metadata, access auditing, human management changes, and retention writes outside the business read transaction.
- Initially enforce a 3-second statement timeout, a 5-second query transaction timeout, and a bounded total request timeout. Confirm exact values in local load testing.

Read-only transactions prevent accidental persistent data changes; they do not themselves enforce field visibility or tenant authorization. Those remain mandatory application/RLS checks. PostgreSQL also permits some temporary-table activity in read-only mode, so do not describe the mechanism as a sandbox for arbitrary SQL.

## 7. REST data contract

All routes below are relative to `/api/v1/integrations/v1/conferences/:conferenceId` with the default application prefix. Support only documented GET reads, plus protocol OPTIONS where required. Do not register bot mutation handlers or generic query endpoints.

### GET /capabilities

Return API version, conference ID/name/timezone, effective scopes, supported filters, effective page/rate limits, credential expiry, and scope-dependent resource availability. Do not reveal another conference or secret metadata. Helps a connector avoid requesting unsupported/private fields.

### GET /papers and GET /papers/:paperId

Require `papers:read`. Return ID, submission number, title, abstract, keywords, track ID/name, status, actual available submission timestamp, created/updated timestamps, and current cycle ID/number. The current Paper model has no dedicated submitted-at column. Do not label draft creation time as submission time: check whether a reliable existing lifecycle event provides it; otherwise return a documented nullable field. Adding or backfilling paper submission timestamps is a separate lifecycle change, not a hidden prerequisite of this API.

Filters: status, trackId, title/submission-number query, cursor, limit. Default eligible statuses are SUBMITTED, UNDER_REVIEW, DECISION_MADE, CAMERA_READY. Withdrawals are available through an explicit withdrawal filter and appear with a withdrawn lifecycle label. DRAFT is unsupported and never accessible, including by detail ID.

Use `includeWithdrawn=false` by default on paper/authorship list and detail reads; selecting a withdrawn status explicitly is equivalent to opting in. A withdrawn detail requires `includeWithdrawn=true`. This flag never admits drafts. Reviewer/assignment history modes ALL/HISTORICAL may include retired/withdrawn records automatically as historical records; CURRENT excludes their obligations. Echo this difference in response scope metadata and document it for clients.

Paper DTOs do not inline author/reviewer data. Avoid indirect identity leaks from submitter user IDs, uploaded-by IDs, original filenames, bucket/object keys, or nested versions.

### GET /authors and GET /papers/:paperId/authors

Require `authors:read` plus `papers:read`. Return per-paper authorship ID, paper ID/submission number, full name, affiliation, author order, corresponding-author flag, and optional email under `authors:contacts:read`.

An authorship record is not necessarily a registered user. Return authorship records, not a guessed global person directory; do not deduplicate people by name/email or expose platform user IDs. The flat list filters by paperId and trackId and follows the same paper visibility/status rules. Names are searchable only under this author scope; email search additionally requires contact scope.

### GET /reviewers and GET /reviewers/:reviewerId

Require `reviewers:read`. Return conference/integration-scoped opaque reviewer ID, neutral display label, current reviewer-role flag, assigned/submitted/remaining/overdue/due-soon/closed-incomplete counts, inconsistent-progress count, and earliest outstanding effective deadline. Name/email are optional fields requiring their respective scopes.

Use persisted random reviewer-reference IDs scoped to the integration/conference. They remain stable across key rotation, differ across integrations, and never expose global user IDs. Do not derive them from names or emails. Document that they are pseudonyms, not a guarantee against contextual identification. Reviewer detail resolution must remain within the integration/conference roster.

Roster: current conference reviewers including zero-assignment reviewers, plus assignment holders needed to explain selected history. Pending invitations are not reviewers. Missing current membership does not erase historical assignments or outstanding work.

Filters: trackId, paperId, history, cycleNumber, attention, cursor, limit, and bounded name/email search when scoped. Default ordering uses an internal stable keyset order, with internal identifiers kept inside encrypted cursors; defer expensive workload sorting unless supported by a bounded database read model. Per-page counts must use all assignments in the selected scope for those reviewers, not a page of assignments. Resolve attention filters through a database aggregate/eligible-ID query before pagination; do not filter after paging and produce incomplete pages.

### GET /assignments and GET /assignments/:assignmentId

Require `assignments:read`, `papers:read`, and `reviewers:read`. Return assignment ID, paper ID/submission number, scoped reviewer ID, cycle ID/number, current-cycle flag, assignment status, normalized progress state, submitted-at if available, effective due-at, deadline source, overdue flag, and historical/retired indicators.

Never return review content or invitation tokens. Read only submission-presence/timestamp metadata needed to explain progress. Do not include names/emails implicitly through related data.

Filters: paperId, reviewerId, trackId, history=CURRENT/ALL/HISTORICAL, optional cycleId or cycleNumber, normalized progress, overdue, cursor, limit. Validate that every supplied ID belongs to the same conference. A cycle ID is paper-specific; reject contradictory paper/cycle filters. Cycle numbers are also per paper, not conference-global rounds.

### GET /summary

Require `analytics:read`. Return current eligible-submission counts by lifecycle status, review workload totals, overdue counts, under-covered paper count, and number of reviewers with active work. Withdrawn totals are a separate section and never inflate active-submission or review-obligation totals. Do not return draft totals, named top authors/reviewers, affiliations, or billing information.

Support trackId only initially. Summary always uses current cycles, with the selected scope echoed in the response; reject historical filters rather than silently ignore them. Historical detail remains available through reviewer/assignment reads.

### Common response behavior

- Lists return `data`, `nextCursor`, and `meta` containing `observedAt`, applied filters, cycle scope, and returned count. Do not promise cross-request snapshot consistency; list pages reflect live data.
- Detail/summary responses also include `observedAt`. Use a single timestamp inside each response for all overdue calculations.
- Default page size 25; maximum 100. Stable keyset ordering includes ID as a tie-breaker. Authenticated-encrypted, versioned cursors bind resource, integration, conference, normalized filters, and sort values; reject tampered or wrong-context cursors. Encoding or signing alone does not conceal internal user IDs. Use standard authenticated encryption with random nonces and a dedicated server secret, not bespoke cryptography.
- No arbitrary sort fields, relation expansion, client-supplied SQL, unbounded nested lists, or total counts on every list request.
- Dates are ISO 8601 UTC strings; return conference timezone through capabilities. Null means unavailable/not set, not the Unix epoch or an invented fallback.
- Missing identity/contact fields are omitted when unscoped. Document these variants in schemas and OpenAPI; forbidden `include`/search parameters receive 403 rather than being silently honored.
- Errors use the existing problem envelope: 400 invalid query/cursor, 401 invalid credential, 403 missing scope, 404 wrong-conference/missing/hidden resource, 429 rate limit, 503 temporarily disabled/dependency/audit failure. No stack traces or existence hints for unauthorized resources.
- Responses containing conference data or newly issued credentials use `Cache-Control: no-store`. Do not widen browser CORS for bot use; server-to-server clients do not require wildcard CORS.

## 8. Counting and deadline rules

Use the shipped reviewer-overview semantics and shared helpers as the source of truth. Extract pure functions if necessary; do not call a full human overview endpoint that loads every paper/name/email into memory.

- A review counts as submitted only if it has an actual submission timestamp. A saved draft or COMPLETED status alone is insufficient; a submitted review with pending edits remains submitted.
- Current remaining work is unfinished, non-retired work on an eligible current open paper/cycle. Closed incomplete work is separate. Replaced/declined/withdrawn records remain inspectable in history but contribute no current obligation.
- Completed-without-submitted inconsistencies must be reported explicitly. Reconciliation includes inconsistent records instead of silently forcing a valid-looking total.
- Remaining = not-started + draft-saved for valid outstanding records. Overdue and due-soon are disjoint subsets; due-soon uses the existing 72-hour window.
- Assigned = submitted + remaining + closed-incomplete + inconsistent for non-retired records in the selected scope. Retired/withdrawn history is reported separately from this reconciliation.
- Current cycle means the latest persisted cycle per paper, independent of the current list page. Historical selections count assignments, not unique papers.
- `effectiveReviewDeadline` applies saved individual assignment deadline first, then existing cycle/conference/legacy fallback rules. Report the chosen source and never calculate a new deadline from request time.
- Draft and withdrawn submissions never inflate active counts. WITHDRAWN_NONPAYMENT is treated as withdrawn too.
- Deleted legacy assignment rows cannot be reconstructed. Documentation must not promise complete history where records were hard-deleted.

## 9. Human control API and management screen

Human-only contract paths under `/conferences/:conferenceId/integrations`, protected by existing guards and MFA:

- GET collection/detail: integration metadata and masked key metadata; no secrets or digests.
- POST collection: create name, purpose, scopes, and authorizer grant.
- PATCH detail: edit label/purpose, suspend/resume, reduce scopes, or explicitly increase grant scopes with version checking.
- POST `/:integrationId/keys`: issue a scoped expiring key, returning plaintext once.
- POST `/:integrationId/keys/:keyId/revoke`: idempotent permanent key revocation.
- POST `/:integrationId/revoke`: idempotent permanent grant revocation and key invalidation.
- POST `/:integrationId/reauthorize`: bind the current eligible human as authorizer and revoke existing keys.
- GET `/:integrationId/access`: paginated recent access metadata with no data payloads.

Settings → Integrations shows name/purpose, authorizer, status, granted permissions, active-key count, nearest expiry, and approximate last use. Create/edit forms explain metadata, identity, and contact permissions in plain language. Sensitive scopes start unchecked.

One-time key display supports deliberate copy and provides the exact conference URL and Authorization header format. Keep the key in component memory only; closing the display removes it. Never call a third-party service to test a key automatically. A test-access action calls our capabilities endpoint and shows effective permissions.

Revoke/suspend controls explain the affected integration/keys, handle optimistic conflicts, and refresh canonical state. Provide clear loading, retry, missing-MFA, expired-authorizer, and permission-denied states. This is a small addition to existing conference settings, not a settings redesign.

## 10. Load controls and access records

Initial configurable limits, subject to local benchmarking:

- 60 read requests/minute/key and 300/minute/conference; pre-auth invalid-token attempts separately limited by trusted client IP.
- At most two in-flight read queries/key and ten/conference, using bounded leases or an equivalent tested admission mechanism. Define multi-instance behavior; do not advertise a process-local semaphore as a global limit.
- Query/page/time limits apply even to valid credentials and historical filters.
- Rate-limit state lives in Redis. Failure denies bot reads with a controlled 503, without changing normal web access. Return Retry-After for 429.
- Authentication/authorization reads are uncached initially. Response caching is deferred, avoiding scope/revocation leakage and stale operational counts.
- Avoid one DB query per paper/author/reviewer. Page entities first and fetch scoped relations/aggregates in bounded batches. Reviewer aggregates must not require a full conference snapshot on every call.
- Inspect representative query plans on synthetic temporary-DB data before adding indexes. Add only indexes needed by the actual tenant/filter/order shape.

Create a dedicated durable access recorder. For authenticated requests, persist a metadata-only record before returning data; if persistence fails, return 503 and record a sanitized operational error. Do not rely on the existing best-effort AuditService for this guarantee. Unknown-key attempts go to bounded sanitized security telemetry, not unbounded database inserts.

Update approximate last-used-at at most once/minute/key through the controlled metadata path. Track aggregate request volume, latency, 4xx/5xx, query timeouts, denied scopes, limiter failures, and audit failures without high-cardinality personal data. Key creation/change/revocation must produce a human management audit event in the same transaction as the change.

## 11. Implementation sequence and acceptance gates

### Phase 1 — Contracts and isolated security spike (2–3 days)

1. Finalize scope dependency rules, DTO allowlists, omitted/null fields, status defaults, and cycle semantics from this plan.
2. Add schema/contract fixtures using UUID formats accepted by current records, including UUIDv7; verify query coercion and response validation.
3. Prototype narrow key bootstrap policies plus authorizer tenant context and read-only transactions on a temporary database.
4. Prove correct-key access, wrong-key denial, cross-conference denial, nonrecursive policies, and persistent-write failure.
5. Confirm query paging/aggregation approach and actual submission timestamp availability.

Gate: no endpoint implementation until the credential bootstrap, read-only context, and permission matrix pass real-RLS tests. No production connections or credentials.

### Phase 2 — Credential lifecycle and human control API (3–4 days)

1. Add the additive tables, constraints, indexes, explicit grants, and RLS policies.
2. Implement grant/key lifecycle services, one-time secret issuance, idempotency, version checks, and management audits.
3. Implement dedicated bot authentication/scope guards and authorizer-role/MFA rechecks.
4. Add feature flag, global/per-conference disable behavior, redaction, and durable access recorder.
5. Validate limits on active keys and concurrent revoke/issue/reauthorize operations.

Gate: keys are never recoverable from list/read endpoints; revoke/expiry/role removal/scope reduction work on subsequent requests; keys never authenticate human mutation routes.

### Phase 3 — Read endpoints and bounded queries (2–3 days)

1. Implement capabilities and paper/authorship endpoints.
2. Implement reviewer aliases/roster, batched workload queries, and detail endpoint.
3. Implement assignment/history reads with normalized progress/deadline semantics.
4. Implement current-cycle summary using shared counting definitions.
5. Add cursor integrity/context binding, filter validation, limits, timeouts, and Redis admission controls.
6. Compare summary/workload responses with existing operational screens on the same synthetic fixture.

Gate: all allowlisted resources paginate correctly, reconcile counts, and contain no unauthorized nested fields. Large conferences do not require unbounded response/query work.

### Phase 4 — Management UI, documentation, and release verification (3–5 days)

1. Build the minimal Settings → Integrations interface using incumbent UI patterns.
2. Generate versioned OpenAPI with bearer security, scope dependencies, filters, errors, and synthetic examples. Verify generation with the repository's installed ts-rest/Zod versions before selecting any new dependency.
3. Add a short server-side client example: load secret from environment/secret storage, query capabilities, traverse pages, respect Retry-After, and never include credentials in model tool arguments.
4. Add browser tests for grant creation, one-time display, scope selection, rotation, revocation, and stale/permission errors.
5. Complete real DB/RLS, contract, API, and regression suites plus bounded synthetic load tests.
6. Prepare migration/deploy notes, pilot procedure, and disable/revoke recovery instructions.

Gate: all acceptance checks below pass and required suites actually execute, rather than being green because database tests were skipped.

Detailed planning estimate: 10–15 engineering days for one developer for this scope, with uncertainty concentrated in the RLS bootstrap and paginated workload queries. This refines the earlier preliminary 7–12 day estimate to include the guarded test harness, durable access auditing/retention, opaque reviewer references, and management UI verification. MCP/OAuth/native connector delivery is outside that estimate.

## 12. Concrete verification matrix

### Credentials and authorization

- Missing, malformed, oversized, unknown, wrong-secret, expired, and revoked token.
- Suspended/revoked integration; removed/downgraded/deleted authorizer; disabled MFA.
- Role inherited through organization versus direct conference membership.
- Every scope individually; invalid dependency combinations; reduced grant versus originally broader key; scope increase does not silently expand old keys.
- Conference A key against conference B path, paper, reviewer, authorship, assignment, cycle, track, and cursor IDs; same-organization conferences must remain isolated too.
- Credential hash/raw secret cannot appear in normal DTOs, issuance logs, traces, error responses, or generated fixtures.
- Concurrent key issuance respects the two-key limit; idempotency retries do not redisplay secrets; reauthorization invalidates old credentials.

### Read-only behavior and field privacy

- Bot key cannot POST/PATCH/DELETE existing paper, review, membership, deadline, reminder, invitation, billing, notification, or management routes.
- Business reads cannot persist database mutations or enqueue jobs. Compare domain rows and queue state before/after representative requests.
- Raw read transaction attempts to insert/update/delete permanent records fail under the production-equivalent safe role.
- Unscoped responses omit names/emails/user IDs/storage internals in every nesting path; corresponding search/sort/filter channels cannot leak them.
- Authorships without a registered user work; equal names/emails do not merge distinct records.
- Alias stability across key rotation and separation across integrations/conferences; concurrent reference creation produces one mapping; encrypted cursors do not reveal platform user IDs.
- Double-blind management identity policy behaves as explicitly documented; identity-free aliases are never described as anonymous guarantees.

### Domain correctness and pagination

- Paper UUIDv7 IDs; invalid enums/booleans/limits/cursors produce useful 400 responses.
- Draft paper inaccessible by list/detail/authorship/assignment/summary; both withdrawal statuses excluded from active totals.
- Current/all/historical cycles; multiple cycles on one paper; contradictory paper/cycle filter rejection.
- Individual deadline override, legacy fallback, exact deadline equality, UTC/timezone boundaries, due-soon window, null/unavailable timestamp.
- Submitted review with pending edits; saved draft; replaced/declined reviewer; withdrawn paper; closed incomplete and inconsistent completed-without-review records.
- Zero-assignment reviewer, removed reviewer membership with retained work, pending invitation excluded, and removed legacy rows not invented.
- Stable pages without missing/duplicate fixture records; tampered, cross-resource, cross-filter, and cross-tenant cursor rejection.
- Workload per reviewer uses the whole selected assignment scope; assignment pagination never changes their aggregate totals.
- Concurrent updates do not produce impossible values within one response; cross-page live-data behavior is documented.

### Reliability and regression

- 429/Retry-After, query timeout, Redis outage, failed durable audit write, and disabled feature produce controlled outcomes without data leakage.
- Authenticated successful data responses have persisted access records; bad-token telemetry is bounded.
- Retention removes only eligible access logs, never credential/business data.
- Existing human authentication, MFA, membership, submissions, reviewer coordination, analytics, and notification flows continue to pass.
- CI runs the new local-service-backed security suite explicitly and fails if its required database URL is missing. Browser mocks use configured origins, avoiding the earlier hardcoded-port failure.

## 13. Temporary database and safe development harness

- Introduce `BOT_API_TEST_DATABASE_URL` and a dedicated local harness. Refuse to start tests unless host is explicit localhost/127.0.0.1/::1 and database name uses a dedicated `bot_api_test_` prefix. Require a task-owned local cluster/port marker as well; localhost alone could otherwise target a forwarded production database.
- No fallback to `.env` DATABASE_URL. The current Vitest configuration reads the repository `.env`; use a dedicated integration config/setup that supplies isolated database/Redis/config values before importing application modules.
- Create a disposable local PostgreSQL cluster/database, apply migrations there as its local owner, and run API reads as the production-equivalent NOBYPASSRLS role. Verify current database, server address/port, role flags, and the test-only marker before any setup/cleanup writes.
- Use synthetic fixtures covering two organizations and multiple conferences; no production export or personal data.
- Use task-owned Redis namespace/service and stub mail/storage/billing providers. Disable scheduled workers except explicitly tested retention code. No live messages, webhooks, or payments.
- CI uses its ephemeral PostgreSQL/Redis services with the same guard checks. Capture executed test counts so a skipped security suite cannot satisfy the release gate.
- Clean up only task-owned test resources after checks complete. Never run generic `migrate:reset` or migration scripts that load repository `.env`.

## 14. Expected file ownership and deliverables

- `packages/schemas/src/integrations.ts` and exports: scopes, lifecycle inputs, DTOs, progress/cursor query schemas.
- `packages/contracts/src/integrations.ts` and exports: separate bot read and human management routers.
- `packages/db/prisma/schema.prisma` plus one additive migration: tables, constraints, policies, explicit grants/indexes.
- `packages/db/src/index.ts` or an exported focused helper: opt-in tenant read-only transaction support with default callers unaffected.
- `apps/api/src/integrations/`: module, controllers, principal/guards, policy, credential repository/lifecycle, query/mapping layer, access recorder, limiter, and tests.
- `apps/api/src/app.module.ts`: register the new module without changing human auth guards.
- `packages/config/src/env/`: validated server feature flag, limiter settings, and cursor encryption secret; no secrets under NEXT_PUBLIC variables. Missing bot-only secrets disable/reject bot functionality without breaking feature-off app startup. Document server-secret versioning/rotation; unlike credential rotation, retiring a cursor encryption key invalidates outstanding cursors and requires restarting pagination.
- `apps/web/src/app/dashboard/conferences/[id]/settings/integrations/` and related components/navigation: management UI.
- `apps/worker/src/`: bounded access-log retention integration only, using the existing worker scheduling mechanism.
- `apps/api/` dedicated bot integration test config/setup and local harness; `e2e/` management browser tests; CI service/test wiring.
- `docs/bot-api-first-release.md`, generated versioned OpenAPI artifact, client example, and operational runbook.

Implement in dependency order: contract/security spike → schema/credentials → bot guards → bounded query endpoints → UI/documentation → full verification. Keep commits reviewable by these boundaries; do not mix unrelated analytics or notification redesigns into this feature.

## 15. Rollout and recovery

1. Finish implementation and migration review using temporary databases only.
2. Ship additive schema and code with the feature disabled by default; this step belongs to a later explicitly authorized release, not this planning task.
3. Configure server secrets and pilot one conference/integration with metadata-only scopes.
4. Verify capability response, audit records, pagination, count reconciliation, limits, key rotation, and revocation in the pilot.
5. Enable identity/contact scopes only when the conference manager explicitly grants them. Place credentials in the connector's secret store; send only needed tool results to the model. Treat submission text as untrusted data, never authorization instructions.
6. Observe API/DB latency, denial rates, and existing web flows before expanding access.
7. If problems occur, disable the feature or suspend/revoke the affected grant. Leave additive tables intact; do not roll back by deleting audit history or changing paper/review rows.

No production migration, deployment, third-party bot connection, commit, or push is part of creating this plan. Existing main-branch pushes can trigger production migration/deployment, so keep local implementation separate until a release is requested.

## 16. References

- [PostgreSQL transaction access modes](https://www.postgresql.org/docs/current/sql-set-transaction.html): use read-only mode for business-data transactions, with its documented limits.
- [OWASP object-level authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/): authorize each referenced resource, not just route access.
- [OWASP property-level authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/): scope each returned property and related data.
- [xAI function calling](https://docs.x.ai/developers/tools/function-calling): a trusted application executes requested tools and returns results; the model does not receive unrestricted database access.
