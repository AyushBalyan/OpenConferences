# In-app conference updates

Implemented locally on 9 October 2026. This adds a conference activity feed to Updates for chairs, organizers, organization administrators and platform administrators. Existing private released-review and author-response inboxes remain available to participants.

## Events and copy

The feed records successful paper submissions and withdrawals, reviewer invitation acceptance and decline, review submission and republication, and author response submission and republication. Messages are short: “Paper submitted.”, “Reviewer invitation accepted.”, “Review submitted.”, and equivalent plain statements. A separate subject identifies the paper or invitation recipient. Review notifications contain no review text, scores, recommendation, pending edits or private comments.

The top-bar bell and Updates navigation tab share the conference's total unread activity count. A red pill appears beside Updates while notifications remain unread, including in the collapsed sidebar and mobile menu; it disappears at zero and caps its visible count at 99+, while its accessible label retains the exact count. Both locations share one polling subscription and refresh together after acknowledgements. Updates provides All/Unread filters, individual acknowledgement, Mark all read, source links and older-page navigation. Opening a source also acknowledges its notification. Read state belongs to each user; reading an update never marks it read for another chair. Lists and counts refresh every 30 seconds while visible. Count failures do not become a false zero; refresh failures label retained page data. The unread filter searches the entire feed, not just the first page.

## Storage and privacy

The additive migration `20261009160000_conference_in_app_updates` creates immutable `conference_updates` records and extends the existing read-state kind with `CONFERENCE`. Narrow domain-transition triggers create records inside the original transaction. Failed/rolled-back transitions create no records; unchanged statuses and saved drafts create no records. Event/source/version uniqueness prevents duplicate activity for the same transition. Activity starts after the migration is applied; historical events are not backfilled.

Database RLS requires explicit conference/organization context and coordinator privileges, including organization/platform administrator access. Runtime roles cannot insert or delete arbitrary activity. Trigger functions use a fixed empty search path, qualified tables and restricted execution. API authorization independently checks coordinator roles. Participants cannot query conference-wide activity or acknowledge coordinator updates. Existing participant source visibility and per-user receipts are preserved.

Chronological pagination uses timestamp plus UUID ordering, with cursor validation in the current conference. Time values and comparisons are explicitly UTC, independent of database timezone. Indexed source/read-state checks support unread filters and counts. Mark all read acknowledges records timestamped at or before the displayed server snapshot, capped at server time; records timestamped later remain unread. It does not delete history.

## Email boundary

This feature has no email publisher, mail job, template or provider path. It writes activity and read receipts only. Existing invitation/assignment/author emails belong to their existing workflows; this change adds no email delivery or new recipient to those workflows. Development and tests called no mail provider.

## Local validation and rollout

Database commands explicitly targeted a new `in_app_updates_test` database on the task-owned PostgreSQL cluster at `127.0.0.1:55449`. The opt-in integration suite rejects remote hosts and other database names. Browser tests use an isolated server on port 3006, an unusable local database URL and intercepted synthetic APIs. No live production database was used.

All 49 migrations applied from scratch. Eight real PostgreSQL/API-role/RLS tests and seven participant inbox regression tests passed, covering transaction rollback, duplicate invitation responses, drafts, review privacy, author responses, nonpayment withdrawal, per-user receipts, unread filtering/counts, snapshot cutoff, coordinator/admin access, runtime immutability and tied-timestamp pagination. Five browser flows and 29 web/18 shared-schema unit tests passed. Changed-source lint, API/web typechecks, database client/package build, API build and the frontend production build passed. The frontend build reported existing warnings in unrelated files. Desktop/mobile visual review returned ship with no material fixes, and the scoped documentation handoff is saved under `.impeccable/review/in-app-updates/`. The temporary PostgreSQL cluster was stopped after validation.

Apply the additive migration before deploying the compatible API and frontend. No deployment or production migration was performed during development. Applying this migration in the deployment environment remains a rollout step.

## Rollout troubleshooting — 10 October 2026

Notification commit `39d0445` passed CI migrations, lint, typecheck and unit tests, but its five notification browser tests failed. Their mock CORS responses were hard-coded to `http://localhost:3006`; the normal CI Playwright project uses `http://localhost:3000`. The resulting authentication requests were blocked in the browser. CI failure prevented API image promotion and deployment, while the frontend displayed the new Conference activity tab. The previous API contract accepts REVIEW and REBUTTAL only, so it rejects `kind=CONFERENCE` with Request Validation Error before querying activity.

The mock now derives its allowed origin from the Playwright project's baseURL. The isolated config accepts `IN_APP_UPDATES_WEB_PORT` so the same tests can verify the CI origin without starting a database-backed API. The reported UUID and CONFERENCE query both validate against the current built contract. All five notification browser tests passed on both origins (3000 and 3006), and changed-source lint passed. This repair changes test setup only; no production deployment, workflow rerun or database command was issued.
