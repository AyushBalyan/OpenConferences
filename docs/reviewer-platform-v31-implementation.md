# Reviewer platform v3.1 — implementation and rollout

Implemented locally on 6 November 2026 against the approved update sheet, with the user’s override: **generating an invitation link marks it Sent**. Production migrations, deployment and real invitation sending have not been performed.

## Implemented

- Additive invitation lifecycle/timestamps/versioning, protected recoverable secrets, append-only changes, and serialized acceptance/decline/revocation. Acceptance and reviewer membership commit together. Existing raw mailed tokens remain usable until normal expiry or deliberate reissue/revocation; stored hashes cannot be used as credentials. An accepted-link replay does not restore reviewer access deliberately removed later.
- Structured, resumable invitation jobs of up to 1,000 rows. Each row gets an outcome; invalid entries and duplicates do not reject valid peers. The new structured path skips existing reviewers/authors and retains closed invitations. Job submissions and queue references commit atomically. Initial batch sending remains off.
- Conference defaults and individual/batch lifetimes of 1–30 days, expiry extension, reissue, explicit reinvitation and soft revocation. Organizer controls show Sent, provide separate accept/decline copies, search invitations, save a conference default, and explain link invalidation before reissue. Integration extensions support up to 100 independently reported operations.
- Public decline confirmation with optional reason, Go back, terminal-state messages, origin checks, abuse limits and no login requirement. Decline reasons are encrypted and require a separate integration response-read permission. Lookup is read-only.
- Integration assignment release/replacement/extension through the existing coordination engine. Release retains drafts/history and is excluded by existing retirement checks from active workload, submission and reminders. The organizer ledger has reason-required individual/bulk release controls. Legacy organizer removal now retires applicable unfinished work rather than deleting it.
- Filtered invitation lists, lifecycle counts and a stable incremental change feed. The worker records expired invitations without requiring a visit. Named coverage metrics keep assignment coverage separate from existing submitted-review shortfall metrics.
- Sensitive URL/log/trace sanitization, no tracking on authentication/action routes, no-referrer action pages, encrypted new invitation email bodies in notification history and queued jobs, and scoped protected batch downloads. Existing custom invitation email branding is retained; the decline action is appended if its placeholder is absent.

The [API guide](api/reviewer-operations-v31.md) describes payloads, permissions, pagination, limits, retention and compatibility boundaries. The [approved update sheet](reviewer-platform-proposed-update-sheet-v3.1.md) records the final Sent rule.

## Which links are used?

Accept links keep the **current Generate Link** format, `/sign-in?reviewerInvite=…`. Email is bound server-side rather than embedded in the URL. Acceptance requires the invited account/email.

The platform-email button keeps its separate passwordless magic-login flow. Invitation expiry and authentication-credential expiry are independent. A dedicated `/reviewer-invite/decline#token=…` link authorizes only decline, without signing in or granting account access.

Sent is an operational acknowledgement of generated links, recorded as `SENT_LINK_GENERATED`. It does not assert confirmed mailbox delivery. The old strict status remains PENDING; the additive lifecycle is SENT. Historical timestamps remain unknown until a new action occurs.

## Verification evidence

- All **73 migrations** applied successfully from scratch in a disposable, task-owned PostgreSQL 17 database. Tests used the actual restricted API/worker roles with NOBYPASSRLS, plus isolated Redis and owner-provisioned pg-boss queues.
- **72 API/database integration tests passed**, including the 61 existing integration regressions. Checks cover old mailed tokens, token-hash rejection, public HTTP protections, cross-conference denial, append-only history, accept/decline races, reissue/revocation, credential cancellation, preserved drafts, submission denial after release, coverage, transactional queue rollback and a full 1,000-row HTTP upload.
- The mixed 1,000-row job produced 1,000 outcomes, including invalid, duplicate and existing rows; it resumed from committed 25-row chunks and remained idempotent after completion. Local processing in repeated runs took roughly 5–10 seconds. This is local evidence, not a production throughput/SLA guarantee.
- **27 browser tests passed** for the organizer invitation controls, existing review ledger, explicit release confirmation, public decline states, optional reasons, Go back, clipboard failure, mobile layout, recovery and tracking exclusions.
- **33 focused unit tests passed** across assignment progress, request complexity, notification publishing/queueing, worker delivery and token/encryption behavior.
- API, web and worker typechecks passed. Changed reviewer files passed targeted lint. The production Next.js build passed. Its first attempt encountered the known Google Fonts extensionless-URL loader issue; an unchanged retry completed successfully ([upstream issue](https://github.com/vercel/next.js/issues/99114)).

No production database, real recipients or provider email delivery were used for this verification. Existing analytics and unrelated workspace work were retained.

## Deployment order

1. Back up the target database and confirm current runtime roles, queue setup and secret configuration. Keep `BETTER_AUTH_SECRET` stable and at least 32 characters: this release derives encryption from it. Secret rotation needs a deliberate re-encryption plan; an uncoordinated rotation prevents recovery of encrypted invitation links, responses and queued email bodies.
2. Apply the five new reviewer migrations with the deployment owner: `20261106100000_reviewer_operations_v31`, `20261106130000_reviewer_batch_execution`, `20261106140000_invitation_response_permission`, `20261106150000_reviewer_operations_integrity`, `20261106160000_reviewer_history_privileges`. Do not grant runtime roles owner/BYPASSRLS privileges. The queue migration provisions the new partition when pg-boss is already initialized. Fresh installations also need the existing owner bootstrap/runtime-grant procedure in the [infrastructure runbook](../infra/RUNBOOK.md).
3. Coordinate the transition of invitation writes; older API instances still contain physical-removal behavior. Deploy the **new worker first**, after migrations, and ensure all old workers are stopped before the new API can enqueue encrypted invitation emails. The new worker accepts existing plaintext jobs as well as new protected jobs.
4. Deploy the API and web. Verify configured WEB_URL/origins, no-store/no-referrer behavior and path-only proxy logging. If the API sits behind an ingress, set `API_TRUSTED_PROXY_CIDRS` to that trusted ingress’s specific address ranges so rate limits use the intended client IP. It defaults to no forwarded-IP trust; do not use an unrestricted trust setting.
5. Run a small authorized synthetic/link-only smoke batch, test decline and reissue, verify the expiry sweep/change cursor and check queue health. Grant and issue the new response-read scope only to integrations that should see private decline reasons. Keep initial bulk email sending disabled.

Do not roll the worker back to a version that cannot decrypt protected email jobs while any such jobs are queued. An API rollback can leave the new worker running to drain compatible jobs. Prefer a forward fix over dropping history tables, deleting assignments or removing newly recorded responses.

## Retention, exports and deletion requests

Protected job input/downloads expire after seven days; invalidated or expired invitation generations stop yielding live URLs immediately. The worker clears expired encrypted job inputs. Non-secret row outcomes and conference audit history are retained separately. New invitation tokens and personal decline reasons are encrypted; general lists, audit/change entries and access logs exclude live links and reasons.

Respond to authorized export/deletion requests through the conference’s existing administrative process. Export private reasons only with explicit response access. For erasure, revoke applicable live links and remove personal response/metadata under the approved conference retention policy; retain necessary resource/version audit history rather than deleting assignments, submissions or decisions. This release does not introduce a public self-service export/erasure endpoint or automatically erase historical plaintext notification records.

## Deliberately outside this release

Outbound webhooks, new automatic reminder milestones, institution matching, visit/open tracking, anonymous account-granting acceptance, retired-assignment reactivation, changes to published decisions/review visibility and automatic overdue release remain excluded or deferred exactly as agreed. The legacy 25-email generator retains its creation policy; the new structured endpoint supplies the stricter author-skip/closed-history policy.

## Local database security audit — 6 November 2026

The follow-up audit reproduced failures before applying fixes and then reran the real database suites. All 73 migrations applied to fresh, disposable PostgreSQL 17 databases. API/worker security tests use restricted NOBYPASSRLS roles; broader application tests use separate owner-provisioned fixtures. Redis was isolated locally. No real email delivery was exercised.

### Fixed and regression-tested

- Private decline reasons now recheck the issued key and current grant inside the read transaction, closing the scope-reduction race.
- Reviewer mutations, replay handling and their integration access audit now commit together. An audit failure rolls back the relevant mutation, change ledger and queue record. Bulk extension rows retain their independent transaction boundary.
- Batch workers acquire the conference lock before rechecking credentials/authority, so credentials revoked while waiting cannot authorize the next chunk. Already authorized in-flight chunks remain bounded; revocation is not retroactive.
- Assignment replacement rejects deleted reviewer accounts even when an opaque reference was cached earlier.
- Oversized change cursors return 400 instead of a PostgreSQL overflow/500. Invitation pages use bounded database reads/counts and consistent snapshots rather than loading the entire ledger.
- Idempotency hashing is canonical across JSON object-key order. Invalid row identifiers, NUL characters and malformed Unicode are isolated as row failures, preserving valid peers and duplicate handling.
- Bulk extensions stop starting new rows after 30 seconds, leaving time inside the concurrency lease; remaining rows return retryable failures with stable request IDs.
- Generated Bot OpenAPI now includes the ten reviewer-operations endpoints with typed responses. HTTP regressions check list and batch responses against their contracts; the generated-spec drift check passes.

### Test evidence

- Broad API/application suite: **505 passed, 5 skipped**, across 53 files, including enabled local review-lock, 1,000-reviewer/10,000-assignment overview, analytics and inbox suites.
- Separate restricted-role Bot/reviewer suite: **91 passed** across three files, including the 1,000-row resumable batch, credential-revocation lock race, audit rollback, private-response scope reduction and malformed-row regressions.
- Additional checks: database-target guards **3 passed**, release-workflow checks **14 passed**, invitation crypto **4 passed**, worker notification **3 passed**. API/worker typechecks, targeted lint, OpenAPI generation/check and whitespace validation passed.
- The five existing skipped decision tests remain a coverage gap: MFA enforcement, stale-version rejection, decision publication/notifications, duplicate decisions and author visibility. This audit does not claim those workflows were verified. The previously recorded 27 browser tests and production web build belong to the earlier feature verification, not this backend audit rerun.

### Test runner isolation

The initial default test command attempted to inherit the shared remote database URL through `.env`; sandbox DNS/network restrictions blocked connection before database access. The runner now refuses remote/ambiguous targets before importing fixtures, ignores shared `.env`, requires an explicit loopback disposable test database and Redis, and verifies the database ownership marker in global setup before cleanup hooks can run. Optional gated databases receive the same checks. Negative tests verify remote URLs, connection overrides and incorrect markers are rejected. CI now provisions its explicit local ownership marker.

### Remaining dependency and deployment gaps

The production dependency audit reports **1 high and 19 moderate advisory entries, zero critical**. Entries can repeat across dependency paths; this is not a count of independently demonstrated application exploits. Dependencies were not upgraded in this audit.

- **High: Zod 3.25.76.** The advisory identifies a patched 4.6.6 release. Existing request byte/depth/node/array budgets reduce the exposed input size but do not clear the advisory. A coordinated Zod/ts-rest compatibility migration and regression run are required. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- **Upload parsing: file-type 20.5.0.** Current upload sniffing reads a bounded 8 KiB prefix, but malformed-file advisories still apply to the installed package. Prioritize an upgrade to a release covering both ASF looping and ZIP decompression issues (21.3.2 or later), checking runtime/module compatibility. [ASF advisory](https://github.com/advisories/GHSA-5v7r-6r5c-r473), [ZIP advisory](https://github.com/advisories/GHSA-j47w-4g3g-c36v).
- Moderate findings also include Express/qs, Sentry/OpenTelemetry, Vitest-related transitive packages and CSS tooling. Reachability differs: an exposed Vitest development server was not used here; build-only findings are distinct from request processing. They still need dependency updates and validation. [qs advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
- CI currently marks its dependency audit `continue-on-error: true`, so known high advisories do not block a merge. Make it enforcing after remediation or adopt a deliberate, expiring exception policy.
- Production queue permissions, ingress/proxy configuration, real provider delivery and the scheduled expiry sweep still require the deployment smoke checks above. Local test success does not verify deployed infrastructure or provider behavior.
