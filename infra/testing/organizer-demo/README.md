# Local organizer demo

Run from the repository root:

```sh
node infra/testing/organizer-demo/server.mjs
```

Open http://localhost:3010/dashboard/conferences/00000000-0000-4000-8000-000000000001

The app signs in automatically as **Dr. Kavya Sharma · Demo Organizer** (`organizer@example.test`). The real Next.js UI uses a separate, local, in-memory dummy API on port 3011. By default it never loads production configuration or connects to a database, mail provider, or payment provider. All names, institutions, papers, reviews, and seeded payment records are fictional. The INR conversion rate of 85 is demonstration data, not a recommended exchange rate.

The dataset covers all organizer sidebar sections and child tabs: updates, submissions, analytics, bidding, COI, review ledger, reviewer overview, assignments, invitations, decisions, registrations, student verifications, settings, integrations, tracks, members, outreach, email logs/templates, and audit logs. Input-only forms use the dummy paper, reviewer, and member choices.

Edits, approvals, assignments, and simulated sends/refunds update the dummy state until the server stops. Reloading a page preserves that state. Restart the command to reset everything, or POST to `http://localhost:3011/__demo/reset`. `GET /__demo/routes` lists all demo tab URLs; `GET /__demo/state` returns the fictional dataset. Both endpoints exist only in this standalone local API.

Press Ctrl+C to stop both processes. `DEMO_WEB_PORT` and `DEMO_API_PORT` can override the ports. No production application routes or authentication code are changed by this demo.

For a separate author demo, keeping the organizer demo open:

```sh
DEMO_VIEW=author DEMO_WEB_PORT=3020 DEMO_API_PORT=3021 DEMO_DIST_DIR=.next/author-demo node infra/testing/organizer-demo/server.mjs
```

Open http://localhost:3020/dashboard/conferences/00000000-0000-4000-8000-000000000001 as **Aarav Mehta · Demo Author**. This view has a paid base paper, a later accepted additional paper, and a paper still under review.

To open the real Razorpay **test checkout** in this dummy author view, add `DEMO_RAZORPAY_TEST=true` to that command. The server reads only the Razorpay credentials from the root ignored `.env` (or environment). It refuses live keys. Test orders are created at Razorpay, and callbacks are verified using HMAC plus the fetched payment amount, currency, order, and captured status. The secret stays on the server. Registration changes remain in memory; no real money or email is involved. The demo does not run a public webhook; refresh confirmation uses the checkout callback.

For an intentional restart that preserves dummy edits, save `GET /__demo/state` as JSON and pass its absolute path in `DEMO_STATE_FILE`. Without that variable the original fixtures are loaded. Never load production records into this unauthenticated local demo.

To add four more accepted papers to a running author demo, run `node infra/testing/organizer-demo/add-accepted-papers.mjs`, then restart the author command with `DEMO_STATE_FILE=/private/tmp/openconferences-author-state.json`. This preserves current papers and payment records. The new unpaid papers include two Indian billing countries and two international ones to test INR and USD additional-paper checkout. Repeating the command skips papers whose titles already exist. `DEMO_API_URL` and `DEMO_STATE_FILE` override the source API and snapshot path.

Run the test gateway checks with `node --test infra/testing/organizer-demo/razorpay-test.test.mjs`.

Captured payments now expose a demonstration invoice through the author's registration page. `http://localhost:3021/__demo/payment-emails/:paymentId` previews the payment email using the platform template (run `pnpm --filter @openconferences/db build` after template edits). This page explicitly says no email was sent. The dummy API never calls a mail provider. PDF invoices are marked as demonstration data.
