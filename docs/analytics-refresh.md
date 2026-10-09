# Analytics refresh

Implemented locally on 9 October 2026. This extends the existing operational dashboard. No production database, email provider or payment provider was accessed, and no deployment, commit or push was performed.

## Reading the page

The page starts with its included-paper scope and a compact summary, then presents review health, submissions and decisions, people and institutions, and registration and finances. Section links provide navigation through the longer report.

- Review progress uses mutually exclusive submitted, draft, not-started, closed-incomplete and inconsistent segments with counts and percentages. Overdue work remains a subset of open draft/not-started assignments. Attention links lead to the paper ledger and Reviewer Overview.
- Paper activity uses Recharts with readable time ticks, per-period/cumulative modes, explicit units and an exact-data table. Missing periods are zero-filled. Ranges automatically use daily, weekly or monthly buckets without dropping papers.
- Category/ranking charts use semantic HTML labels, exact values and scaled bars so names stay readable on narrow screens. Financial charts support positive and negative net balances.
- Corresponding authors remain complete, with name search and 10-row pagination.
- Empty data, initial failures and failed refreshes are distinct. Failed refreshes retain a clearly dated previous snapshot. Requests from an earlier conference or refresh cannot overwrite the current view.
- Shared navigation now computes breadcrumb segments consistently and limits the Overview item to the conference root.

## Counting rules and corrected bugs

Submissions, reviews, decisions, authors, institutions and registration workload exclude `DRAFT`, `WITHDRAWN` and `WITHDRAWN_NONPAYMENT` papers. The excluded draft and withdrawn counts appear separately. Rejected decisions remain included conference activity.

Review and decision aggregates use the latest cycle per paper. Declined/replaced assignments are excluded; `Review.submittedAt` determines genuine submission, including reviews with pending edits. Released/decided cycles contribute closed-incomplete counts rather than overdue workload. An assignment marked completed without a submitted review is flagged for checking. Same-name reviewers remain separate by user ID.

The review-minimum count describes papers still open for review whose latest cycle has fewer submitted reviews than required. It links to the ledger without applying the assignment-shortage filter, whose meaning differs.

Authors are grouped by corresponding-author email and counted by distinct paper ID, so different papers with identical titles do not disappear and different people sharing a name are not merged. Institutions count distinct paper IDs per normalized affiliation; a paper can belong to several institutions. Rankings show up to 12 institutions/reviewers and retain all corresponding authors.

Acceptance share uses accepted decisions divided by all latest-cycle decisions, including revision outcomes. The denominator is visible; no percentage is claimed before decisions exist. An old acceptance cannot make a paper awaiting a new decision count as currently accepted or unpaid-accepted.

Unpaid registrations include pending payment, verification and additional-payment requests. Cancelled, refunded and discarded registrations do not count as unpaid. Past-deadline records and records due within the next seven days are separate; these dates refer to the saved registration deadline, not any additional-payment grace expiry.

Financial totals remain a transaction ledger: captured non-refund payments less successful refund records, including transactions for subsequently withdrawn papers. Only the conference fee currency is summed; other-currency records are counted and flagged instead of silently added. Unspecified fee timing remains separate rather than being relabeled Regular. Revenue does not pretend to be a paper-conversion stage.

Paper activity is labeled as creation dates of currently included papers, in UTC. The schema has no first-submission timestamp; this release does not invent one or substitute an updated timestamp. Consequently this chart is not an immutable historical submission-event series.

## Database boundary and rollout

No schema migration is needed for this analytics refresh. The existing additive Reviewer Overview migration belongs to the earlier work in this checkout.

Database verification used a newly created `analytics_test` database on the task-owned temporary PostgreSQL cluster at `127.0.0.1:55449`. The integration test refuses a non-local host or another database name and defaults to skipping unless its explicit opt-in URL is present. Application-role tests set the API role and tenant context, exercising RLS. No shell database command used the repository's default connection.

For a fresh local database, the existing `prisma/predeploy.sql` queue-schema prerequisite must be present before all migrations can apply. A local setup failure was recovered only in this empty test database; all 48 existing migrations then applied successfully.

API and frontend changes should roll out together so the new count definitions and displayed labels agree. Financial transport, billing state transitions and historical review records are unchanged.

## Verification

- 7 analytics aggregation regression tests and 4 real PostgreSQL/API-role/RLS tests passed.
- 29 web unit tests and 18 shared-schema tests passed.
- 5 browser flows passed: desktop/mobile rendering, scope definitions and chart modes, author search/pagination, empty data, and initial/refresh failures.
- Changed-source ESLint checks, API/web typechecks, and schema/contracts/API builds passed.
- The frontend production build passed, including lint/type validation, all 21 static pages and final trace packaging. An initial attempt ran out of local disk space; after temporary output cleanup released space, the isolated retry succeeded. Existing unrelated lint warnings remain. Temporary build output was removed and generated TypeScript configuration changes were restored.
- The independent desktop/mobile finish review returned **ship**, with no material fixes. The scoped design documentation handoff is recorded alongside the captures.
- The task-owned temporary PostgreSQL cluster was stopped after verification.

Browser captures use synthetic test fixtures; `capture-record.md` explicitly labels the evidence, which contains no production conference data. Captures and design handoff evidence live under `.impeccable/review/analytics/`.
