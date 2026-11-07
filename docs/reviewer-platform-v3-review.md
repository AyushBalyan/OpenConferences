# Reviewer platform specification v3 — implementation and compatibility review

Reviewed 6 November 2026 against the current OpenConferences checkout. Source: [reviewer_platform_spec_v3.md](/Users/lkbalyan/Downloads/reviewer_platform_spec_v3.md).

The specification is a useful functional upgrade plan, but it is not safe to implement by simply replacing existing statuses, exposing current controllers publicly, or raising the batch limit. Reuse existing integration security, pagination, author-conflict checks and chair coordination; add versioned or additive capabilities for the missing behavior.

This is a repository-level assessment, not a production deployment audit. The spec’s 184-paper/133-uncovered snapshot, external automation and under-15-minute assignment latency were not independently verified. No live conference data, credentials, links or personal response records were accessed. Application code was not changed for this review.

## Assessment key

Implemented means the requirement has a matching code path in the inspected checkout. Partial means reusable behavior exists but the requirement as a whole is not satisfied. Missing means the requested end-to-end capability was not found; unrelated infrastructure does not count as implementation. These are requirement counts, not completion percentages.

53 requirements mapped: 3 implemented, 32 partial, 18 missing.

## Existing functionality worth reusing

- Integration invitation generation is already email-addressed, normalized, locked, idempotent, link-only and limited to 25 addresses. It is not a new-from-zero bulk system.
- Assignment replacement and deadline extension already exist for chairs in ReviewCoordinationService, with version/cycle checks, reason audits and draft preservation. They are missing from integration credentials/contracts.
- Author conflicts already block assignment and replacement, including unlinked author emails. This P1 requirement should be preserved throughout P0 work.
- Assignment read APIs already expose progress, persisted deadlines, overdue state and history; paginated paper/author/reviewer/assignment reads and scoped hashed credentials are present.
- Automated review reminders, manual reviewer digests, notification histories and product-neutral email templates already exist, but not the exact requested reminder schedule and configuration.

## Compatibility risks and existing lifecycle hazards

### 1. No-login acceptance changes the identity boundary

Requirements: FR-4; NFR-5; Appendix B. Evidence: [apps/api/src/review/invitations.service.ts:306](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:306).

Acceptance validates a signed-in invited-email user and materializes that user’s REVIEWER role. Integration-generated links go to sign-in; platform-email links use a seven-day magic-link session. Simply making the accept controller public would remove an existing authorization invariant.

**Safe approach:** Clarify no manual login versus anonymous acceptance. Preserve invited-email binding and create/resolve an account safely. The optional name/password setup is skippable, not a research-fields questionnaire; do not remove it as though it violated the out-of-scope questionnaire rule.

### 2. Invitation enum renaming will break strict clients and pending filters

Requirements: FR-3; NFR-11. Evidence: [packages/schemas/src/integrations.ts:121](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:121).

PENDING/ACCEPTED/DECLINED/EXPIRED are fixed enums in storage and API schemas. Pending counts, dedupe, link retrieval, acceptance and deletion all depend on PENDING. Replacing it with SENT/OPENED changes existing request and response contracts. Link-only generation also does not prove that an email was sent.

**Safe approach:** Keep legacy status behavior or version the contract; add explicit lifecycle/delivery fields and transition timestamps. Do not backfill invented sent/opened times. Define how mailbox delivery is acknowledged and whether scanner visits count as opens.

### 3. Assignment release must not reuse physical deletion

Requirements: FR-5.1–5.6. Evidence: [packages/db/prisma/schema.prisma:711](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/db/prisma/schema.prisma:711).

Organizer unassign deletes ReviewerAssignment and cascades deletion to Review. New RELEASED status would also bypass existing exclusions that name only DECLINED/REPLACED, potentially leaving released reviewers active in reads, review submission, reminders and analytics. The unique round/paper/reviewer constraint prevents a new same-cycle assignment to the same reviewer while history remains.

**Safe approach:** Implement a history-preserving release transition, update every active/retired predicate and submission authorization, reuse cycle locks, and decide whether same-reviewer reactivation is permitted. Distinguish assignment release from publishing reviews to authors. Resolve opaque integration reviewer IDs server-side rather than passing them into chair reviewerUserId fields.

### 4. Accept and decline are not currently serialized together

Requirements: FR-4.4–4.7; NFR-10. Evidence: [apps/api/src/review/invitations.service.ts:453](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:453).

Acceptance locks and rechecks the invitation; decline checks PENDING before an unconditional update in a separate transaction. A decline that read PENDING can write DECLINED after acceptance grants membership. Expiry/resend paths also need the same state-machine review.

**Safe approach:** Use one locked/conditional transition path for accept, decline, revoke, extend and reissue. Commit terminal state, membership side effects, timestamps and audit coherently. Keep GET confirmation pages free of terminal mutations.

### 5. A 1,000-row upload needs a different execution model

Requirements: FR-1; FR-10.1; NFR-7. Evidence: [apps/api/src/integrations/bot-invitations.service.ts:80](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:80).

Current email-only schema accepts 1–25 addresses, rejects an invalid address for the entire request, sorts/deduplicates input and creates rows serially under a 5-second transaction with a 3-second statement timeout. Raising only the array maximum does not deliver per-row validation or reliable progress.

**Safe approach:** Add a structured bulk operation or job, stable input-row identities, bounded chunks, resumable/idempotent progress and protected result retention. Preserve the existing email-array endpoint and its replay semantics. Benchmark 1,000 rows before asserting throughput.

### 6. Invite extension and secret migration can invalidate mailed links

Requirements: FR-2; FR-4.1; NFR-1. Evidence: [apps/api/src/auth/auth.config.ts:249](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/auth/auth.config.ts:249).

Resend extends the invitation but does not rotate its token. Platform email additionally uses a separately expiring magic-link token. A 30-day invitation extension alone will not extend an already issued seven-day magic link. Link retrieval and request replay render URLs from the stored raw invitation token; hashing it without a retrieval design breaks those endpoints.

**Safe approach:** Define independent accept/decline purpose-bound secrets, token generations and a legacy-link transition. Support extension without rotation and explicit reissue with rotation. Choose protected recoverable storage or one-time result delivery; never persist live URLs in generic idempotency or audit records.

### 7. Reminder milestones conflict with existing deduplication

Requirements: FR-8.1–8.4. Evidence: [apps/worker/src/reminder-sweep.ts:166](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/worker/src/reminder-sweep.ts:166).

The daily sweep can send within three days of a deadline, then deduplicates by assignment and due-date day. That suppresses a second automatic reminder on the due day. Manual digests have their own daily limits. Adding a new scheduler without coordination can instead duplicate messages.

**Safe approach:** Add per-conference switches and explicit expiry-minus-three / due-minus-two / due-day milestone keys. Define the conference timezone and reconcile all reminder sources, including existing scheduled and manual jobs.

### 8. Public invite links need broader privacy protection

Requirements: NFR-1, NFR-2, NFR-5. Evidence: [apps/api/src/app.module.ts:35](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/app.module.ts:35).

Integration-only request serialization strips query values; non-integration requests retain their URL. Magic-link verification carries secrets in a query, and Sentry filtering is also integration-specific. New public decline responses/reasons enlarge the sensitive surface. This is a code-level exposure risk, not proof that a live secret has been logged.

**Safe approach:** Sanitize auth/invite URLs, errors, traces, proxies and metrics; prevent public-page analytics/referrer leakage; scope decline reason reads and keep them out of assistant prompts. Separate necessary mail delivery storage from general logs and define its retention.

### 9. Coverage and author rules need explicit definitions

Requirements: FR-1.2/1.4; FR-9; Appendix A. Evidence: [apps/api/src/integrations/bot-read.service.ts:525](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:525).

Bot underCoveredPapers counts assignments, analytics counts insufficient submitted reviews, and operations calls overdue-only papers uncovered even while the overdue reviewer stays assigned. Decisions close assignment creation. The spec also says repeated email must not duplicate an invite while asking for a new invitation after decline.

**Safe approach:** Expose separately named active coverage, submitted coverage and actionable uncovered metrics; exclude decided/released cycles according to a documented rule. Preserve existing aggregate meanings. Define one active invite per email plus retained history, and choose whether author skipping covers all or active papers. Do not retroactively remove reviewer roles just because an author would now be skipped.

### 10. Same-institution hard blocking changes who can be assigned

Requirements: FR-6.2. Evidence: [apps/api/src/review/coi-check.service.ts:17](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coi-check.service.ts:17).

Current checks already block paper authors and declared conflicts, but do not auto-block matching institution text/domain. Enabling a broad domain block can reject legitimate assignments or treat common personal email providers as one institution.

**Safe approach:** Normalize affiliation identities, exclude personal email domains, define an authorized and audited override, and apply the rule consistently in bot/manual/bulk/replacement paths. Do not postpone existing authorship checks to Phase 2 or apply new institutional rules retroactively without a policy.

## Requirement-by-requirement mapping

- **FR-1.1 · P0 · Partial — Structured personal-invite batch.** Email-only batches exist; no invitation-time name, affiliation, research fields or external reference. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:202).
- **FR-1.2 · P0 · Partial — Conference/email deduplication.** Normalizes and locks emails; reuses active pending invitations. Accepted/declined/expired invite and existing reviewer policies differ from the spec. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:80).
- **FR-1.3 · P0 · Missing — Per-row outcomes and two links.** Response has invitation identity/status and a single URL; no created/existing/skipped/invalid outcome and no dedicated decline URL. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:220).
- **FR-1.4 · P0 · Missing — Skip existing reviewers and authors.** Batch queries users and pending invitations, not conference authorships or reviewer memberships. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:108).
- **FR-1.5 · P0 · Missing — 1,000 rows and background progress.** Maximum 25 emails; whole operation runs synchronously under a 5-second transaction. No invitation bulk-job contract. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:202).
- **FR-1.6 · P0 · Partial — Initial invitation mail off by default.** Integration generator sends no mail. Organizer issue defaults to email unless LINK_ONLY is specified; preserve legacy behavior or introduce a conference-specific default. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:163).
- **FR-2.1 · P0 · Missing — Configurable 1–30 day lifetime.** Invitation and magic-link lifetimes are fixed at seven days; no conference/per-batch/per-invite setting. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitation-links.ts:4).
- **FR-2.2 · P0 · Partial — Extend expiry with stable links.** Organizer resend preserves identity/token and extends seven days, but also sends mail; no explicit extension-only or bulk integration operation. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:209).
- **FR-2.3 · P0 · Missing — Reissue both links preserving history.** Resend keeps the original invitation token; no two-secret rotation, old-link invalidation or reissue history. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:232).
- **FR-2.4 · P0 · Partial — Retain expired invites, block actions.** Expired rows remain and acceptance/decline reject expiry. Integration reads derive expired status; organizer mapping may retain PENDING until an action updates it. No expiredAt timestamp. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:428).
- **FR-3.1 · P0 · Partial — Sent/opened/accepted/declined/expired/revoked.** Only PENDING, ACCEPTED, DECLINED, EXPIRED are stored. Revocation deletes the row; no sent/opened lifecycle. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/db/prisma/schema.prisma:93).
- **FR-3.2 · P0 · Partial — Transition timestamps.** createdAt, updatedAt and expiresAt exist. Specific sent/opened/accepted/declined/expired/revoked timestamps do not. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/db/prisma/schema.prisma:597).
- **FR-3.3 · P0 · Partial — Status/recency/field/email filters.** Integration filters status and email. No changed-since or research-field filter; arbitrary query keys are rejected. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:422).
- **FR-3.4 · P0 · Partial — Invitation counts by status.** Chair coordination counts active pending invitations only. No complete per-status or field summary. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coordination.service.ts:76).
- **FR-3.5 · P0 · Partial — Revoke and disable both links.** Pending invitation deletion invalidates its single token, but loses the resource rather than storing REVOKED history. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:212).
- **FR-4.1 · P0 · Missing — Dedicated decline URL.** Only the email-bound acceptance/sign-in URL is returned. Accept and decline currently share one invitation token. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitation-links.ts:5).
- **FR-4.2 · P0 · Missing — Anonymous confirmation and optional reason.** Decline controller requires CurrentUser and the existing page is ProtectedRoute. No separate public confirmation route or reason field. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/review.controller.ts:555).
- **FR-4.3 · P0 · Missing — Go back without mutation.** No dedicated confirmation page or back action exists. New GET pages must not mutate terminal state. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/web/src/app/reviewer-invite/accept/page.tsx:16).
- **FR-4.4 · P0 · Partial — Confirm decline, time/reason, thank-you.** Authenticated decline changes status and audits it; no decline reason/timestamp or dedicated thank-you page. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:427).
- **FR-4.5 · P0 · Partial — Decline closes both actions safely.** Sequential repeat actions reject non-pending state, but decline lacks the row-lock/recheck used by acceptance; concurrent accept/decline can diverge from membership. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:453).
- **FR-4.6 · P0 · Partial — Clear messages for every used state.** Existing UI displays errors, including expiry, but often generic no-longer-pending/not-found messages. Deleted revocations cannot be distinguished. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/invitations.service.ts:574).
- **FR-4.7 · P0 · Partial — Organizer/integration decline visibility.** DECLINED is listable/filterable. Reason and declinedAt are absent from storage and list DTOs. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:191).
- **FR-5.1 · P0 · Missing — Integration release/remove with reason/history.** Integration API only creates assignments. Organizer unassign physically deletes the assignment; Review has an on-delete cascade. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/assignments.service.ts:370).
- **FR-5.2 · P0 · Partial — Atomic reassignment through integrations.** Chair coordination already replaces atomically, checks conflicts, preserves the draft and audits a reason. No scoped integration endpoint. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coordination.service.ts:191).
- **FR-5.3 · P0 · Partial — Change assignment due date.** Chair EXTEND exists with audit/version checks, limited to unfinished current assignments and future deadlines later than the old one. No bot mutation endpoint. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coordination.service.ts:253).
- **FR-5.4 · P0 · Partial — Assigned/started/submitted/overdue/released.** Integration reads expose status, inferred DRAFT/NOT_STARTED/SUBMITTED/CLOSED/RETIRED and overdue. No explicit startedAt or RELEASED state. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:276).
- **FR-5.5 · P0 · Missing — Explicit release to uncovered pool.** REPLACE requires a new reviewer; no release-only action. Existing code does not automatically remove overdue reviewers. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/review.ts:671).
- **FR-5.6 · P0 · Partial — Auditable assignment transitions.** Creation/replacement/extension/reminders have audit records. No full release lifecycle; legacy deletion records no required reason. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coordination.service.ts:331).
- **FR-6.1 · P1 · Implemented — Block paper authors when assigning.** Shared conflict check covers submitter ID, linked authorship and normalized author email; used in manual assignment, bot creation and replacement. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coi-check.service.ts:10).
- **FR-6.2 · P1 · Missing — Same-institution detection and override.** Shared check reads identities and declared conflicts, not institution affiliation/domain. No institutional override contract. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coi-check.service.ts:17).
- **FR-7.1 · P1 · Missing — Outbound invite/assignment lifecycle events.** No outbound integration subscription/delivery API found. Existing incoming mail/payment webhooks and email job queues are different systems. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/contracts/src/integrations.ts:219).
- **FR-7.2 · P1 · Missing — Authenticated delivery, retry/backoff.** No outbound integration subscription/delivery API found. Existing incoming mail/payment webhooks and email job queues are different systems. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/contracts/src/integrations.ts:219).
- **FR-7.3 · P1 · Missing — Subscriptions and delivery history.** No outbound integration subscription/delivery API found. Existing incoming mail/payment webhooks and email job queues are different systems. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/contracts/src/integrations.ts:219).
- **FR-7.4 · P1 · Missing — Identifier-only payloads without secrets.** No outbound integration subscription/delivery API found. Existing incoming mail/payment webhooks and email job queues are different systems. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/contracts/src/integrations.ts:219).
- **FR-8.1 · P1 · Partial — Configurable expiry/due-minus-two/due-day reminders.** Review sweep runs daily for due-within-three-days work. No invite-expiry sweep or per-conference reminder configuration; same-deadline dedupe prevents separate milestones. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/worker/src/reminder-sweep.ts:103).
- **FR-8.2 · P1 · Partial — Neutral templates and exact committee sign-off.** Product-neutral templates already exist, with tests. Review/digest templates do not guarantee the exact Organising Committee, ICAMCDS 2026 signature. Scope customization to this conference. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/db/src/notification-templates.ts:240).
- **FR-8.3 · P1 · Partial — Queryable reminder activity and dedupe.** Notification logs, assignment dedupe and manual-digest daily limits exist. No scoped bot reminder-history endpoint or milestone-specific automatic reminder dedupe. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/worker/src/reminder-sweep.ts:44).
- **FR-8.4 · P1 · Partial — Mailbox invitations and enabled platform reminders.** Integration link-only invites and separate platform review reminders coexist. Per-conference reminder enable/disable policy is missing. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:185).
- **FR-9.1 · P1 · Partial — Per-paper assigned/submitted/overdue counts.** Bot assignment reads can be filtered by paper and expose progress/overdue; chair ledger has counts. Exact per-paper bot count DTO is not present. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:288).
- **FR-9.2 · P1 · Partial — 0/1/2+ reviewer and overdue-only coverage.** Integration summary has underCoveredPapers and workload, but not the requested bands/overdue-only rule. Analytics coverage instead counts insufficient submitted reviews. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-read.service.ts:498).
- **FR-10.1 · P0 · Partial — Documented limits with bulk capacity.** Limits are documented: 60/key/min, 300/conference/min, 2/10 concurrent. Bulk uses the same capacity and small synchronous batch path. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/docs/api/bot-endpoints.md:330).
- **FR-10.2 · P0 · Implemented — Machine-readable consistent errors.** Global problem envelope and scoped integration status handling exist; controller sets Retry-After for 429. New endpoints should reuse this layer. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/common/filters/problem-exception.filter.ts:17).
- **NFR-1 · NFR · Partial — Protect invitation secrets at rest/in transit.** API credentials and magic-link verification tokens are hashed. Invitation tokens are application-retrievable strings and links can be fetched again. Deployment storage encryption/TLS was not audited. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/db/prisma/schema.prisma:603).
- **NFR-2 · NFR · Partial — No secrets or personal responses in logs/prompts.** Integration routes redact credentials and strip query strings; ordinary auth/invitation routes do not get the same URL sanitation. New reason fields need scoped reads and payload/log filtering. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/app.module.ts:35).
- **NFR-3 · NFR · Partial — Scoped credentials.** Conference-bound paper/author/reviewer/read/write/invitation scopes exist. Notification/subscription management scopes do not. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:2).
- **NFR-4 · NFR · Missing — Authenticable secret-free outbound events.** No outbound integration event subscription/delivery feature to enforce this invariant. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/contracts/src/integrations.ts:219).
- **NFR-5 · NFR · Missing — Public no-login actions with abuse protection.** Existing accept/decline routes require authentication. Auth-path throttling and bot limiter are not a substitute for explicit limits on new public invite actions. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/review.controller.ts:539).
- **NFR-6 · NFR · Partial — Export/deletion request path.** Privacy page documents a general copy/delete email request path and conference-record retention. No invite/reason-specific export, purge, and retention procedure was found. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/web/src/app/privacy/page.tsx:317).
- **NFR-7 · NFR · Missing — 1,000-row operability.** Current schema caps at 25 and invitation writes use a short synchronous transaction. No bulk-job progress/results endpoint or 1,000-row measurement. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:80).
- **NFR-8 · NFR · Implemented — Paginated automated list reads.** Bot lists have bounded pages and tenant/resource/filter-bound encrypted cursors. This supports polling, but is not an incremental changed-since feed. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:93).
- **NFR-9 · NFR · Partial — Responsive conference coverage.** Batched ledger reads and SQL workload aggregation provide a foundation; requested coverage bands are absent and response-time targets were not benchmarked. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/review/coordination.service.ts:39).
- **NFR-10 · NFR · Partial — Audit material lifecycle actions.** Existing integration create/delete and chair intervention audits exist. New extend/reissue/revoke/release/public decline transitions need durable histories and safe diffs. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/apps/api/src/integrations/bot-invitations.service.ts:265).
- **NFR-11 · NFR · Partial — Compatibility of existing integrations.** Current endpoints are present, but v3 is not implemented. Strict schemas, status-dependent filters and opaque reviewer references require an additive rollout. [Source](/Users/lkbalyan/Documents/GitHub/OpenConferences/packages/schemas/src/integrations.ts:121).

## Decisions needed before implementation

1. Does no login mean no manual authentication screen, or acceptance without any identity-bound account/session? Existing membership authorization must remain intact.
2. Preserve PENDING for legacy clients; define additive lifecycle/delivery fields, action-specific tokens, historical backfill limits and explicit reissue semantics.
3. Choose release/reassignment behavior for submitted, historical and decided work; define whether a retired same-reviewer assignment can be reactivated in the same cycle.
4. Define one active invite versus permanent email uniqueness, re-invitation after decline, reviewer-role preservation and author dedupe across active/all papers.
5. Define opened/sent events for mailbox-sent mail and scanner visits. Pick reminder milestones, timezone and treatment of deadline extensions.
6. Keep notification authenticity, retries, subscription scoping and result retention explicit. Do not turn existing incoming mail webhooks into an assumed outbound lifecycle service.
7. Specify invite/decline response export, deletion and retention; reconcile the no-sensitive-data-in-assistant-prompts requirement with any operations assistant that receives bulk invitation results.

## Suggested implementation order

1. Preserve existing contracts and identities; define lifecycle/coverage semantics and repair the accept/decline transition race.
2. Add schema fields and durable transition history with backwards-compatible migrations. Preserve live legacy tokens until explicit reissue.
3. Implement purpose-bound public decline confirmation/thank-you/state pages with abuse controls and privacy-safe telemetry; finalize the acceptance identity flow.
4. Expose existing chair replacement/extension through integration scopes and add explicit release with coherent coverage/history.
5. Add structured bulk invite jobs, per-row dedupe/outcomes, expiry controls and protected results. Benchmark the 1,000-row acceptance criteria.
6. Add milestone-aware configured reminders, named coverage aggregates and an outbound event outbox/subscription/delivery system. Keep current author checks enabled.

## Verification and limits

- 48 focused API unit tests passed: 29 coordination, 7 integration security, 8 conflict checks, 3 assignment progress, 1 problem-envelope test.
- 4 worker reminder tests passed. Total: 52 tests.
- Reviewed current source, shared schemas/contracts, Prisma model, worker schedules, UI routes and local API documentation. No live database, external mailbox, secret-bearing invitation URL, production log or deployed endpoint was queried.
- No concurrent database reproduction or 1,000-row performance test was run. The accept/decline race and timeout risks are code-based findings; deployment-level encryption, TLS, log sinks, provider configuration, and actual latency remain unverified.
- Reissue must account for the independently expiring magic-link credential. Existing audit history cannot reconstruct sent/opened/declined timestamps that were never recorded.
