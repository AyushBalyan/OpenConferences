# Razorpay paper registration

The existing Next.js / NestJS / Prisma integration now uses Standard Checkout with server-priced orders, signature verification, API confirmation of capture, and signed webhooks. It uses the existing `fetch` integration; no Razorpay SDK dependency is needed.

## Domestic and international payments

Razorpay documents separate amounts/currencies for domestic and international orders: use INR with paise for Indian pricing and USD with cents for international pricing. Collecting every payment in USD is unnecessary. The application chooses the order currency using the author's saved billing country; this does not verify where a card was issued or guarantee that Razorpay will accept that payment method.

For a USD fee schedule, `IN` selects INR; any other ISO country selects USD. `domesticInrPerUsd` is an organizer-configured INR-per-USD rate. USD cents multiplied by this rate, rounded once, yields INR paise. INR checkout is unavailable until that rate is set. Other existing single-currency conference schedules keep their original currency behavior.

Razorpay's conversion documentation requires the merchant to supply the desired currency and amount. Its conversion of USD payments into INR for settlement is separate from setting a domestic INR price. We do not infer a selling rate from settlement rates or call an undocumented exchange-rate API. The order and registration store the actual amount/currency and regular-author equivalent, so later rate/fee changes cannot alter an issued order or the amount owed following student-document rejection.

International payments need an activated account with the required KYC, business eligibility, website policies, and international-card approval. An entered country cannot bypass these requirements. For an Indian merchant, Razorpay documents settlement in INR, including foreign-currency payments. Confirm payment-method availability and settlement details in the account's Dashboard.

Official sources checked 2 November 2026:

- [International payments and currency subunits](https://razorpay.com/docs/payments/international-payments/)
- [International cards: eligibility and activation](https://razorpay.com/docs/payments/international-payments/international-debit-credit-cards)
- [Currency conversion and INR settlements](https://razorpay.com/docs/payments/international-payments/currency-conversion)
- [Standard Checkout: orders, verification, capture, and test cards](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)

## Fee schedule and paper eligibility

In the target conference's Settings → Fees, click **Use November 2026 USD fees**, enter the INR-per-USD rate, and click **Save fees**. The preset is explicit because this application hosts multiple conferences; deployment does not overwrite every conference's prices.

- Regular author: USD 125 early / USD 150 regular.
- Student: USD 75 early / USD 100 regular; student-document verification still applies.
- Each additional accepted paper registered by the same signed-in author in the same conference: USD 50 (or its configured INR equivalent).
- Early bird applies strictly before **20 November 2026, 00:00 Asia/Kolkata**, stored as `2026-11-19T18:30:00.000Z`. At that instant regular pricing begins. The price is locked when checkout is first created.
- Set the conference registration deadline or a fee-specific deadline override before opening registration. The early-bird cutoff is not the registration deadline.

Each paper has its own registration, order, payment, and invoice. Only the latest notified ACCEPT decision permits registration or payment, and the paper must remain in DECISION_MADE or CAMERA_READY status. A pending, rejected, revised, withdrawn, or superseded acceptance cannot be paid by calling the endpoint directly.

Example: an author pays USD 125 for paper A before the cutoff. Paper B remains under review and cannot be registered. When B is accepted and its decision is notified, registration opens for B; the same author pays USD 50. Paper A's receipt remains unchanged. Paper C can be registered later for another USD 50.

The discount requires captured net funds covering a base registration paid by this user in this conference. A base student payment awaiting document review also qualifies while its paid amount covers the current due amount. Unpaid registrations and fully/partly refunded base registrations with an outstanding balance do not establish eligibility. Another coauthor's payment does not grant this user's account a base registration. Additional-paper pricing is separate from `Payment.kind=ADDITIONAL`, which means a balance/top-up on the same paper.

## Deployment

1. Generate Prisma Client and deploy the schema migration using the project's normal migration credentials:

   ```sh
   pnpm --filter @openconferences/db generate
   pnpm db:migrate:deploy
   pnpm --filter @openconferences/api... build
   pnpm --filter @openconferences/web build
   ```

2. Configure server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. The supplied test key pair is saved only in the ignored local `.env`. Configure deployment secrets separately. The webhook secret is a separate secret chosen in the Razorpay Dashboard. Only the public key ID is returned to checkout; no `NEXT_PUBLIC_` secret is used. Missing credentials disable payments outside automated tests rather than falling back to mock payments.
3. In the Razorpay Dashboard, enable automatic capture and register an HTTPS webhook at `<API_ORIGIN>/api/v1/webhooks/razorpay`, subscribing to **payment.captured**. Use the same webhook secret on the server. Configure test and live modes separately.
4. Apply the fee preset, conversion rate, and registration deadline to the intended conference, then restart/redeploy API and web. Existing registration deadlines remain per-paper snapshots; use the existing deadline-extension action for already opened registrations if needed.
5. Before real collections, activate international payments and replace test keys with live credentials. No live deployment or production database change is performed by this source change.

## Test

Start the configured stack with `pnpm dev`. Sign in as an author with a notified accepted paper, open its Registration section, save category and billing country, upload student proof if applicable, and click **Pay now**.

In Razorpay test mode, the integration documentation lists domestic Visa `4100 2800 0000 1007` and international Visa `4012 8888 8888 1881`; use a future expiry and arbitrary CVV. Complete the simulated bank success/failure flow. Test `IN` with the configured INR rate and a non-Indian country with USD; account-specific international availability still applies. Test cards and sandbox success do not prove live international activation.

Also test closing checkout, failed payment, a pending/unaccepted second paper, later acceptance and USD 50 checkout, wrong/missing callback signatures, retries, and duplicate webhook delivery. The browser sends all three `razorpay_*` values to the verify route. A valid signature alone does not mark a paper paid: the server fetches the payment and checks the saved order, amount, currency and captured state. Authorized-but-uncaptured payments remain pending until capture is confirmed. Callback and webhook races apply capture once under a registration row lock.

API routes (under the configured `/api/v1` prefix):

- `POST /conferences/:conferenceId/papers/:paperId/registration` saves category/country.
- `POST /conferences/:conferenceId/papers/:paperId/registration/payment` creates/reuses an order; requires `Idempotency-Key`. Client-supplied amounts/currencies are ignored.
- `POST /conferences/:conferenceId/papers/:paperId/registration/payment/verify` verifies the signed checkout result and checks capture through Razorpay.
- `POST /webhooks/razorpay` verifies the raw-body webhook using the separate webhook secret.

Automated checks:

```sh
pnpm --filter @openconferences/api typecheck
pnpm --filter @openconferences/web typecheck
SKIP_ENV_FILE=true pnpm --filter @openconferences/api exec vitest run --config vitest.integration.config.ts src/billing/fee-resolver.test.ts src/billing/razorpay.provider.test.ts
SKIP_ENV_FILE=true DATABASE_URL='<LOCAL_TEST_DATABASE_URL>' pnpm --filter @openconferences/api exec vitest run --config vitest.integration.config.ts test/integration/billing.test.ts
pnpm exec playwright test --config playwright.billing.config.ts
```

The billing integration suite uses real Postgres and pg-boss, with an in-memory auth cache and stubbed invoice storage. Browser tests mock Razorpay Checkout and API responses; a Dashboard test-mode transaction remains a manual launch check.

## Payment receipts and invoices

### Invoice layout and registered-author affiliation

API, worker and local demo use the shared A4 invoice layout in `packages/db/src/invoice-layout.ts`. It includes conference name, invoice number/date, registered author name and affiliation, billing country and author category, public paper ID/title, registration fee, paid total, transaction/order IDs and the computer-generated/no-signature disclaimer. Author email is omitted from the PDF (it remains the receipt email destination).

Registration resolves affiliation only from the registering author's linked authorship, or an email-matched legacy authorship when no linked row exists. A different coauthor's institution is never used. Missing affiliation is required in the registration form and validated server-side before order creation. The value is saved as `registrations.billingAffiliation` and frozen when checkout begins; incomplete older checkouts may fill in a missing affiliation without changing price, category or country. Existing stored invoices are preserved; newly generated invoices use the new layout.

Deploy migration `20261102200000_invoice_author_affiliation` before the updated API and worker, and rebuild the shared database/schema/contracts packages. The local demo uses the same form and renderer with fictional data.

After the server verifies a captured payment, the registered payer's account email receives the `registration.confirmed` payment receipt (corresponding author email is the fallback for legacy registrations). The HTML and text versions include paper title, currency and amount with two decimals, Razorpay payment/transaction ID, and a link to that paper's registration page. Student document verification remains a separate step. Failed, cancelled, or merely authorized payments do not trigger this receipt. Notifications use a per-payment idempotency key and the existing retrying notification worker; invoice queue failures do not block the receipt. Provider retries can recover notification scheduling after a capture has already committed.

PDF invoices are generated by the existing `invoice.generate` worker, stored privately, and include the transaction ID. Once generated, the registration page provides a button that requests a fresh authenticated, signed download link. The email links to this page; it does not attach the PDF. Invoice jobs retry transient failures.

Deployment requires the API and worker builds, database migration `20261102180000_payment_confirmation_transaction`, a running queue worker, configured outbound mail provider and verified sender, and private object storage. The receipt log and notification job commit in the same transaction. The migration grants the API role the necessary queue access on existing installations; fresh installations must run `infra/postgres/scripts/bootstrap-pgboss-queues.sql` as the queue owner after pg-boss initializes its schema. The migration updates only the active platform payment template. Organizer-customized payment templates must add `{{transactionId}}` and optionally `{{registrationUrl}}` themselves; they are preserved. No live email was sent during automated checks.

The standalone local demo never sends email. Its captured payments expose `/__demo/payment-emails/:paymentId` as a clearly labeled email preview and `/__demo/invoices/:paymentId.pdf` as a labeled demonstration invoice. Existing paid dummy registrations remain intact.

## Source changes

- `apps/api/src/billing/`: order reservations, per-paper pricing, eligibility checks, checkout verification, common capture handling, webhook validation, student pricing snapshots, public-key selection, and protocol/pricing tests.
- `apps/api/src/tenancy/tenancy.mapper.ts`: preserve all fee-schedule fields in settings responses.
- `apps/api/src/review/decisions.service.ts`: pass the deciding organizer's tenant context when opening registration under the restricted API database role.
- `apps/web/src/components/billing/registration-card.tsx` and `apps/web/src/lib/api-client.ts`: country selection, fee preview, checkout states, and signed verification.
- `apps/web/src/components/dashboard/settings/settings-{workspace,panels}.tsx`: explicit USD fee preset, cutoff/deadline, additional-paper price, and conversion-rate settings.
- `packages/schemas/src/{billing,tenancy}.ts` and `packages/contracts/src/billing.ts`: pricing, country, verification, and API contracts.
- `packages/db/prisma/schema.prisma` and migration `20261102120000_razorpay_registration_pricing`: billing country, additional-paper flag, regular-price snapshot, and indexed author/conference lookup. No new tables.
- `apps/api/test/integration/billing.test.ts`, `e2e/billing.spec.ts`, `e2e/camera-ready.spec.ts`, and `playwright.billing.config.ts`: backend and browser coverage.
- Local ignored `.env`: supplied test credentials. `.gitignore` already excludes `.env`.

Verified locally on 2 November 2026: the schema migration applied to a temporary PostgreSQL database; 25 backend payment tests and 13 Chromium checks passed. The registration/capture path also runs with `SET LOCAL ROLE openconferences_api` to exercise production RLS. Both INR and USD unpaid test-mode orders were successfully created through the real Razorpay Orders API using the supplied test keys. This checks order creation, not a completed card payment or live international activation.
