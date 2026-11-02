# Payment infrastructure security audit — 2 November 2026

Scope: checkout, acceptance/registration eligibility, capture callbacks/webhooks, refunds, invoices, email queueing, reconciliation, and dependency advisories. Reviewed commit `270ef40` plus the existing local checkout. No application fixes, deployments, live charges, or actual refund requests were made. Tests use isolated PostgreSQL on port 55439 and a fake gateway; protocol tests mock network responses.

## Remediation status — completed locally

All seven reproduced application issues now have passing regression tests. The findings below preserve the original audit evidence and refer to the pre-fix commit; they are not a list of currently failing tests.

- Invoice downloads require the registering author or an authorized organizer role.
- Refund requests persist durable intents, allocate amounts to original captures, reserve uncertain/pending balances, and reuse a stable Razorpay idempotency key outside database transactions. Retries after a lost local commit may repeat an HTTP call, but use the same provider key so the financial operation occurs once.
- Captures retain cancelled/discarded/refunded states and recheck acceptance. Decision reversals cancel existing registration eligibility; student verification cannot restore a cancelled registration. Received funds remain in the ledger for organizer resolution.
- Refund pending/processed/failed events and out-of-order deliveries are handled idempotently. Historical parent payment IDs are backfilled where the stored provider response identifies them.
- A scheduled worker delegates reconciliation to the shared API state machine using a timestamped HMAC over the raw request body. Missing captures are fetched from Razorpay; pending refund intents and missing invoice/email side effects are retried. No duplicate accounting implementation lives in the worker.

Validation: **453 passed checks**, comprising 404 API tests, 2 worker recovery tests, 13 invoice/template tests, 29 web tests, and 5 demo protocol tests. The full API suite also reports 45 environment-specific skips. API/web/worker typechecks and changed-code lint passed. The migration was validated inside a rolled-back transaction on the isolated database. No production migration, live payment/refund, real email, or deployment was performed in this remediation task.

The dependency scan improved from 8 critical / 26 high / 34 moderate / 5 low to **0 critical / 1 high / 19 moderate / 0 low**. Patched dependencies include Next.js, Better Auth, proxy-addr, Vitest/tinypool, multer, body-parser, sharp, PostCSS, Vite and the official SheetJS 0.20.3 distribution. This does not establish production reachability of any advisory.

The remaining high advisory is Zod's collection-validation memory exhaustion issue. Zod 4 breaks the current ts-rest contract types, so Zod 3 is retained with an API-wide, pre-validation limit of 1,000 collection entries, 5,000 total nodes and 32 nesting levels. Limit enforcement and supported 500-recipient uploads are tested. This is a mitigation, not an upstream dependency fix; the advisory remains visible and a coordinated ts-rest/Zod migration is still needed. The 19 moderate advisories also remain open for separate dependency triage.

Deployment requires applying `20261103000000_payment_security`, rebuilding shared packages, and restarting API and worker together. The migration also normalizes legacy email-based credential account IDs for Better Auth 1.7 while preserving existing canonical accounts. Subscribe to `payment.captured`, `refund.created`, `refund.processed`, and `refund.failed` in Razorpay. The worker must reach the configured `BETTER_AUTH_URL` and share the API's `BETTER_AUTH_SECRET`; reconciliation runs every five minutes. Existing pre-migration refunds without identifiable parent payment IDs remain conservatively reserved and may require organizer reconciliation.

Final evidence: `/private/tmp/payment-fix-api-final-tests.log`, `/private/tmp/payment-fix-worker-final-tests.log`, `/private/tmp/payment-fix-db-final-tests.log`, `/private/tmp/payment-fix-web-final-tests.log`, `/private/tmp/payment-fix-demo-final-tests.log`, `/private/tmp/payment-fix-audit-final.json`.

## Original audit result

91 test cases executed: **84 passed, 7 security invariants failed**. The seven failures below were reproduced with ordinary assertions, not inferred solely from code. Four are rated high and three medium. No critical application exploit was demonstrated. The passing tests do not establish that the infrastructure is free of other vulnerabilities.

The tests are retained in `apps/api/test/integration/billing.test.ts` and `apps/api/src/billing/razorpay.provider.test.ts`. At audit time the billing suite failed on the seven reproduced issues; remediation now passes those assertions. An older replay test silently returned when checkout was unavailable; it now actually submits eight concurrent replay deliveries and checks one capture and one notification.

## High: private invoice accessible to another author

Location: `apps/api/src/billing/invoices.service.ts:112`; `apps/api/src/billing/billing.controller.ts` getInvoice.

An authenticated author with membership in a conference can request another author's invoice using the victim's paper ID. The endpoint checks conference membership but the download service never checks paper ownership or an authorized organizer role. Billing RLS is permissive and invoice/file RLS only requires organization membership.

Reproduction: create an invoice for author A, use author B's session (same conference, unrelated to the paper), GET A's registration invoice route. **Observed HTTP 200 and a signed S3 download URL**, using `SET LOCAL ROLE openconferences_api`. The fixture object was not uploaded to S3; the unauthorized capability issuance was verified, not an actual object download.

Fix: enforce paper/payer/organizer authorization before accessing invoice metadata and signing; cover same-conference strangers and different-conference members of the same organization. Apply equivalent checks to generic file-download routes. Organization membership alone is insufficient.

## High: a refund can be issued twice after a local rollback

Location: `apps/api/src/billing/payments.service.ts:545`; `apps/api/src/billing/razorpay.provider.ts:183`.

The external refund runs inside the database transaction. If Razorpay accepts it and the transaction fails or times out afterwards, the local refund record and version increment roll back, but money movement cannot roll back. Retrying the identical request issues another refund; there is no stable provider idempotency key or durable refund intent.

Reproduction: capture a payment, inject a transaction failure after the fake provider returns success, then retry the same registration version and refund amount. **Observed two provider refund calls**, with only the retry recorded locally. This demonstrates the application failure mode; no real money was refunded.

Fix: persist a refund operation and stable idempotency key before calling the provider, make the call outside the registration transaction, and recover uncertain results by reconciliation. Razorpay documents `X-Refund-Idempotency` for normal refunds: https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md . Add bounded request timeouts; a timeout means unknown outcome, not a safe blind retry.

## High: late capture reactivates a cancelled registration

Location: `apps/api/src/billing/payments.service.ts:417`; `apps/api/src/billing/paid-state.ts:47`.

A legitimate order created before cancellation can still be paid. Capture records the payment and unconditionally derives PAID from sufficient funds, overwriting CANCELLED.

Reproduction: create checkout, mark registration CANCELLED, deliver a correctly signed capture. **Observed PAID**, expected cancellation to remain authoritative.

Fix: separate financial capture from participation eligibility. Record received funds but preserve cancelled/discarded states and route the payment for refund or organizer review. Test deadline-expired and discarded registrations too.

## High: previously issued checkout registers a subsequently rejected paper

Location: `apps/api/src/billing/payments.service.ts:417`.

Acceptance is checked when creating checkout, but not when applying capture. An author with an old valid order can complete payment after the latest decision is reversed to REJECT.

Reproduction: accepted paper → checkout → latest decision changed to REJECT → signed capture. **Observed PAID** despite the rejected paper.

Fix: recheck eligibility at capture under consistent locking with decision changes. Preserve the financial record while keeping rejected papers ineligible; queue manual resolution/refund rather than discarding the payment event.

## Medium: refund accounting treats pending refunds as completed

Location: `apps/api/src/billing/payments.service.ts:558`; `apps/api/src/billing/razorpay.provider.ts:183`.

Any successful HTTP response creates a REFUNDED ledger entry using the requested amount. Provider refund status is ignored, as are refund.processed/refund.failed webhooks. Pending or later failed refunds therefore reduce paid balance and may revoke registration before the refund completes. Dashboard-created refunds are also not ingested by the capture-only webhook parser (code review finding).

Reproduction: provider returns a refund entity with status pending. **Observed local REFUNDED** immediately.

Fix: maintain pending/processed/failed refund lifecycle, validate response ID/amount/parent payment, handle signed refund events idempotently, and reconcile external refunds. Source: https://github.com/razorpay/markdown-docs/blob/master/webhooks/refunds.md .

## Medium: multi-payment refunds target the wrong amount

Location: `apps/api/src/billing/payments.service.ts:526`.

The implementation selects the latest captured payment but checks the requested refund against the entire registration balance. A student registration with an initial payment and later top-up can therefore send an oversized refund against the smaller top-up. Previous refunds are also not allocated to their original capture.

Reproduction: registration paid in two captures, request one minor unit more than the latest capture but less than the overall balance. **Observed provider call for more than that capture's amount.** The fake provider accepts it; Razorpay is expected to reject the oversized request. This is an application validation/availability bug, not evidence that Razorpay allows over-refunding.

Fix: allocate refunds across captures and track remaining refundable balance per original payment ID. Validate and reserve that balance transactionally.

## Medium: reconciliation does not recover missing captures

Location: `apps/api/src/billing/payments.service.ts:597`; `apps/worker/src/payment-reconcile.ts`.

API reconciliation logs stale payments and the worker only counts them. Neither consults the provider nor changes state. If the browser callback is lost and webhook delivery never succeeds, funds can be captured externally while registration remains unpaid.

Reproduction: age a CREATED payment beyond the threshold and run reconciliation. **Observed inspected=1 with zero provider fetches**. Source review confirms the worker has the same gap. The test verifies missing recovery behavior, not an actual Razorpay outage.

Fix: fetch provider state for persisted orders, validate amount/currency, apply the same idempotent capture/refund processing, and retry with pagination/backoff. Include uncertain order-creation outcomes and missing invoices/notifications in recovery.

## Additional reliability risks from code review

- Invoice enqueue errors are swallowed after capture. If email succeeds, the webhook returns success and no further delivery is guaranteed. Job retry settings only help jobs successfully enqueued. Persist an invoice outbox atomically or sweep captured payments missing invoices.
- Invoice generation checks for existence before creating; concurrent workers can race, leaving an uploaded orphan object and a failed unique insert. New invoice counters also use read-then-create. Existing unique constraints protect against duplicate invoice rows, but recovery/cleanup should be explicit.
- Country is self-reported, so INR/USD selection is not verified residency. This is the chosen product behavior; it is not automatically a vulnerability, but it must not be used as evidence of regulatory location.
- Payment rate limiting was not established: the visible application middleware limits auth routes only. Deployment/WAF controls were outside scope.

## Dependency scan

`pnpm audit --prod --json` reported **73 vulnerability counts: 8 critical, 26 high, 34 moderate, 5 low**, represented by 70 advisory records. These counts are package/advisory accounting, not 73 demonstrated payment exploits.

Critical advisory records include Next.js 15.5.19, better-auth 1.6.22, proxy-addr 2.0.7, and Vitest/tinypool via dependency/peer paths. Prioritize supported patched versions and retest. Runtime applicability is conditional: for example Windows-specific issues require Windows, and Vitest UI issues require an exposed UI server. No production container or deployment was inspected, so deployed reachability was not verified. Registry output is preserved at `/private/tmp/payment-dependency-audit-online.json`.

Relevant registry advisory links:

- Next.js: https://github.com/advisories/GHSA-2464-fhr4-w9xw
- better-auth: https://github.com/advisories/GHSA-965c-763c-88jm
- proxy-addr: https://github.com/advisories/GHSA-jqcg-44mw-7w3h
- Vitest: https://github.com/advisories/GHSA-5xrq-8626-4rwp

## Verified defenses and limits

Passed checks include HMAC verification, forged signatures, callback order/amount validation, author-only verification, authorization versus capture distinction, non-accepted paper checkout rejection, signed amount tampering, rejected currency/country inputs, immutable quotes, additional-paper pricing, student proof and top-up flows, anonymous/stranger registration access, author refund rejection, malformed payment IDs, invalid amounts, concurrent checkout retries, concurrent webhook replay, callback/webhook races, transactional email queue rollback/retry, template rendering and invoice layout.

Real production API role was exercised for invoice disclosure and the existing later-paper flow. Other integration tests use the isolated DB owner role. HTTP routes run inside the Nest test app, not behind the deployed proxy. S3 upload/delivery, live Razorpay credentials/dashboard configuration, bank settlement, actual email deliverability, WAF, deployed secrets, and sustained load testing were outside scope.

## Re-run

Use a dedicated migrated test DB; never copy a production DATABASE_URL. The example assumes the isolated local DB is running:

```sh
SKIP_ENV_FILE=true DATABASE_URL=postgresql://openconferences:openconferences@127.0.0.1:55439/openconferences_test pnpm --filter @openconferences/api exec vitest run --config vitest.integration.config.ts test/integration/billing.test.ts src/billing src/messaging/notification.publisher.test.ts src/messaging/notification-queue.test.ts src/messaging/notification.service.test.ts
pnpm --filter @openconferences/db exec vitest run src/invoice-layout.test.ts src/notification-templates.test.ts
node --test infra/testing/organizer-demo/razorpay-test.test.mjs
```

At the original audit, the first command had seven security assertion failures (73 cases: 66 pass, 7 fail); those assertions now pass after remediation. Shared-package tests: 13 pass. Demo protocol tests: 5 pass. Logs: `/private/tmp/payment-security-final-strict.log`, `/private/tmp/payment-security-shared.log`, `/private/tmp/payment-security-demo.log`. API typecheck passed. Test-file lint passed after formatting cleanup.

Fix order: invoice authorization → durable/idempotent refunds → capture eligibility → refund lifecycle/allocation → reconciliation and outbox recovery → dependency upgrades with focused regression tests.
