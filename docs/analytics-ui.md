# Analytics UI refresh

Run `corepack pnpm --filter @openconferences/web dev`, then open
<http://localhost:3000/dev/analytics> for the development-only preview with labeled
synthetic data. The signed-in conference analytics route uses the same components
and its existing analytics API. The preview returns 404 outside development.

Design: Framed sheet, seed 454593036, retaining Inter and the product's teal.
The screen answers: how is the conference progressing, and what needs attention?

Paper activity now leads the report. It supports all activity, latest 7/30 days
(relative to the latest creation date), custom dates, per-period/cumulative views,
chart brush zoom, a period-average reference, peak summary, exact data and CSV
export. Date ranges affect paper activity only. Brush zoom affects the plot;
summary, table and export cover the date range. Cumulative counts retain their
all-history baseline. Short windows use daily buckets even on a long history.

Category lists support counts and shares of their own breakdown. Reviewer and
institution lists initially show six entries with an expand/collapse control.
The review completion summary links to overdue work. Counting rules, latest-cycle
semantics, excluded paper statuses, and financial definitions are preserved.

Verification: `corepack pnpm exec playwright test --config playwright.analytics.config.ts`;
`corepack pnpm --filter @openconferences/web typecheck`; changed-source ESLint;
analytics utility tests. Design evidence and critique are in `.taste-skill/`.

## Payments across currencies

Reporting now includes both USD and INR receipts and successful refund records,
converted into the conference fee currency using `feeSchedule.domesticInrPerUsd`
(INR per USD). INR-to-USD divides by the rate; USD-to-INR multiplies. Decimal
arithmetic rounds each ledger amount to the nearest reporting minor unit before
applying receipt/refund signs. The same amounts feed every revenue breakdown.
This is current-rate reporting: changing the schedule rate changes the report;
original payment records and checkout prices are untouched.

The revenue panel shows gross captured, refunded, net, the rate, and original
amounts by currency. Unsupported currencies and missing/invalid rates retain
original amounts in the table with an unavailable conversion, and a warning
states how many ledger records are excluded from the converted total. Failed,
pending and unconfirmed-refund records do not count as receipts or refunds.
The local preview demonstrates mixed USD/INR at 83.27 INR per USD.

The Reporting currency selector beside Refresh switches revenue totals, charts,
and converted amounts between USD and INR when a valid fee-schedule rate exists.
The API computes both reports from original ledger records with per-transaction
rounding; the browser never converts a previously rounded total. The selection
survives an analytics refresh within the same conference. Original currency
amounts and non-financial counts remain unchanged. Without an applicable rate,
only the conference's native reporting currency is available.

Analytics numbers, currencies, exchange rates and UTC activity dates use an
explicit `en-US` locale for identical server/client markup. Local snapshot times
are localized only after hydration. Browser regressions cover `en-IN`, `en-GB`
and `de-DE`, including currency switching after hydration.
