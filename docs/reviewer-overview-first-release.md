# Reviewer Overview: first-release implementation plan

Status: implemented locally on 9 October 2026, following approval of this plan. Development and database testing used an isolated temporary PostgreSQL cluster bound to localhost. No production database changes, live email sends, commits, pushes or deployments were performed.

## 1. Outcome and release boundary

Give conference organizers and chairs a reviewer-focused view of the review process. From one row they should understand a reviewer's assignments, submitted reviews, remaining work, overdue work and earliest outstanding deadline. Expanding the row should identify the individual papers and expose the appropriate next action.

The first release includes:

- A conference-wide Reviewer Overview beside Paper Review Ledger.
- All current conference reviewers, including reviewers with zero assignments, plus assignment holders needed to explain the selected records.
- Submitted, remaining, not-started, draft, overdue and due-soon counts with explicit definitions.
- Expandable assignment details and direct links to the paper ledger or review dossier.
- Search, track/cycle/history filters, workload sorting and URL-persisted view state.
- Existing individual reminder, extension and replacement controls, with the existing checks and previews.
- Reviewer-level and selected-reviewer reminders: one consolidated email per reviewer containing the explicitly selected unfinished assignments and each saved individual deadline.
- Current-cycle defaults and read-only historical browsing.
- Accessible desktop/mobile behavior, loading/error/empty states, and per-reviewer bulk results.

Not included: capacity limits, expertise matching, automated assignment, reviewer rankings, response-time scoring, login/activity tracking, configurable reminder schedules, exports, or a redesigned dashboard. Pending invitations remain in the existing Invitations screen; an invited person is not a current reviewer until membership exists.

Success means the chair can find an overdue reviewer, identify the affected papers, preview the exact reminder or intervention, perform it, and see refreshed counts without visiting every paper individually.

## 2. Source of truth and counting rules

### Reviewer population

- Start with every current conference-scoped membership containing the REVIEWER role. Deduplicate by user ID, never by name or email.
- Union in users with assignments in the selected data scope, even if their reviewer role was subsequently removed. Label these rows “No current reviewer role”; retain their records and disable assigning additional papers. Unfinished work requiring a current role should direct the chair toward replacement; digest sending requires a current reviewer membership.
- Exclude pending invitations from this roster. Show current reviewers with zero assignments as “Unassigned.”
- Track filters describe assigned work, not reviewer expertise or track membership. A zero count under a track filter means “No assignments in this scope,” not “Qualified for this track.”

### Cycle and paper scope

- Default to the latest cycle of each eligible paper, using the same eligibility and cycle selection as the paper ledger.
- History options: Current cycles, All cycles, Earlier cycles. Add an optional cycle-number filter; cycle numbers are per paper, not a conference-global round.
- Count review assignments, not distinct papers: the same reviewer reviewing the same paper in two selected cycles represents two review assignments. Expanded details always display the cycle.
- Earlier cycles are read-only. Decisions, released reviews and other closure conditions use the same eligibility rules as existing coordination actions.
- Preserve withdrawn, declined and replaced records when available through the history read model. They contribute no current obligation. Do not silently expand the paper ledger's eligibility during a shared-query refactor; add any additional history records through an explicit reviewer-history query.
- Legacy assignments removed through the existing hard-delete path cannot be reconstructed. Do not promise a complete historical audit for deleted records; new replacement history remains preserved.

### Metrics per reviewer, within the selected assignment scope

- **Assigned reviews:** non-retired, non-withdrawn assignment records, including closed-cycle records retained in the selected scope.
- **Submitted:** assigned reviews with an actual submitted review. A saved draft or an assignment status alone is insufficient. A submitted review with a pending edit remains submitted.
- **Remaining:** unfinished active assignments in a current, open paper/cycle. Includes not-started and saved-draft assignments. Losing the reviewer role does not erase this outstanding work; label it as requiring replacement and disable reminders until the reviewer has access again.
- **Not started / Draft saved:** mutually exclusive subdivisions of Remaining. Draft content is never returned.
- **Closed incomplete:** assigned reviews without a submission whose cycle/paper is no longer open for work. Display separately when nonzero; exclude from Remaining, overdue, reminders and extensions.
- **Overdue:** Remaining assignments whose effective due date is strictly before the snapshot timestamp.
- **Due within 3 days:** Remaining assignments due at or after the snapshot timestamp and within the next 72 hours. Overdue assignments are not counted again here.
- **Earliest outstanding deadline:** the minimum effective date among Remaining assignments. It may be in the past; show its overdue state explicitly. If no work remains, show an em dash.
- **All assigned reviews submitted:** Assigned reviews is greater than zero and Submitted equals Assigned reviews. Zero assignments is never “complete.”

Reconciliation invariants: Assigned reviews = Submitted + Remaining + Closed incomplete; Remaining = Not started + Draft saved; Overdue and Due within 3 days are disjoint subsets of Remaining. Retired/withdrawn records appear in details/history outside these primary totals.

If source records contradict these states, such as a COMPLETED assignment with no submitted review, flag the affected row as having unavailable/inconsistent progress. Do not report it as submitted or silently force normal-looking totals; test this diagnostic path as well as valid-state reconciliation.

Use `effectiveReviewDeadline` throughout: a persisted individual deadline takes precedence; legacy null dates use the established cycle/conference/seven-day fallback. Use one `observedAt` value per response for every relative-date calculation. Never derive reviewer progress from assignment `updatedAt` or infer personal activity.

## 3. Screen structure and interactions

### Placement

- New route: `/dashboard/conferences/[id]/reviews/reviewers`.
- Add Reviewer Overview beside Paper Review Ledger in conference navigation, breadcrumbs and command search.
- Add a small two-view switch, Paper ledger / Reviewer overview, on both coordination pages. Retain existing ledger URLs and the Assignments workspace.
- Add an overview shortcut; avoid duplicating every reviewer statistic on the organizer home screen.

### Summary and main table

Show a compact attention strip with counts of reviewers who have overdue work, work due within 3 days, all assigned reviews submitted, and zero assignments. Clearly label these as reviewer counts; overdue-review totals are a different unit.

One main row per reviewer:

1. Name, email and any missing-role warning.
2. Assigned reviews.
3. Submitted reviews.
4. Remaining, with not-started/draft breakdown and Closed incomplete when relevant.
5. Overdue and due-soon counts.
6. Earliest outstanding deadline.
7. Paper identifiers, showing at most three followed by “+N more.”
8. Actions: View papers, Remind, Assign paper.

Use counts rather than a completion-percentage column in this release. This avoids false comparisons between different workloads and keeps zero-assignment rows clear.

### Expanded reviewer row

Show assignment rows with paper identifier/title, track, cycle, assignment status, review progress, individual deadline and available actions. Sort overdue unfinished work first, then other unfinished work by deadline, then submitted/closed/retired records.

- Paper links carry paper/cycle context to the ledger or dossier.
- Individual actions reuse the existing intervention endpoint and its previews. Retired, submitted and historical assignments cannot enter an intervention selection.
- Assign paper opens the existing manual assignment screen with the reviewer preselected. The chair still chooses the paper and individual deadline; server-side conflict and membership checks remain mandatory.
- Label closed unfinished assignments explicitly so they are not mistaken for tasks the reviewer can still complete.
- Show the same person's multiple cycles as separate assignment rows, not duplicate reviewer rows.

### Filters, sorting and selection

- Reviewer search matches name/email and narrows visible people without changing their workload calculation.
- A separate paper search matches submission identifier/title and narrows the assignment scope. Track, cycle and history filters also change that scope. Display “Counts within selected filters.”
- Attention filters: All reviewers, Overdue work, Due within 3 days, Has remaining work, All assigned reviews submitted, Unassigned.
- Sorting: default overdue count descending, remaining count descending, earliest deadline ascending, then name/user ID for stable ties. Offer reviewer name, assigned count, submitted count, remaining count and deadline sorting.
- URL-persist filter/sort/page state. Debounce typed searches without losing characters or focus, and reset pagination when the scope changes.
- Page at 25 reviewer rows initially. Fetch a complete roster/scope snapshot before browser pagination; never treat the first member API page as the conference roster.
- Summary counts describe the selected assignment scope before reviewer search and attention filtering. Show visible/total reviewer counts beside the table so this distinction is explicit.
- Keep zero-assignment current members in the base roster, including under track filters. Paper search should show reviewers with matching papers; the Unassigned queue remains available after clearing that paper filter.
- Changing assignment scope clears action selections and previews. A confirmed preview lists every target; selections cannot silently include hidden assignments.

### Responsive and accessible behavior

- Retain the incumbent dashboard components, spacing and operational table style.
- On narrow screens keep reviewer identity and key counts readable; contain table overflow and visibly explain horizontal scrolling. Stack expanded assignment controls and preview fields.
- Use semantic table headings, keyboard-operable expansion, explicit checkbox labels, visible focus, and a named action-preview region.
- Use status text in addition to color. Long names, email addresses and paper titles must wrap or truncate with an accessible full value.
- Loading and errors never display as zero workload. Refresh failure retains a clearly stale snapshot and disables mutations until refreshed. Empty roster, no filter matches and no remaining assignments have distinct messages.

## 4. Read API and shared implementation

Add `GET /conferences/:conferenceId/reviewer-overview` with typed query fields for history, track, cycle number and paper search. Return:

- `observedAt` and resolved scope/filter metadata.
- Reviewer identity/current-role state.
- Per-reviewer aggregates and assignment metadata needed for expansion, including current/historical and intervention eligibility.
- Summary reviewer counts, available track/cycle filter options and complete-snapshot metadata.

Use server-side aggregation for the selected assignment scope; the browser handles reviewer search, attention filters, sorting and 25-row pagination over the returned complete snapshot. Scope changes request a new response. Prevent stale responses from replacing newer filter results.

Implementation approach:

1. Extract a reusable review-coordination read model from the existing snapshot service where appropriate. Retain current ledger behavior and response compatibility.
2. Load the conference reviewer roster and scoped assignment/review metadata through batched tenant-scoped queries, selecting only required fields. Avoid one query per reviewer or paper.
3. Apply a pure aggregation function keyed by reviewer user ID. Unit-test it independently with a supplied timestamp.
4. Return only submitted/draft existence and progress metadata. Do not load scores, recommendations, draft text, chair comments or manuscript content for this screen.
5. Use existing conference membership/RLS and `RequireReviewCoordination` guards. Authors and reviewers cannot access the overview merely through their participant role.
6. Keep data reads internally consistent across roster, assignment counts and summary. Choose a short transaction snapshot appropriate for the existing Prisma/Postgres setup; never perform mail/provider calls inside it.

Existing indexes on conference/reviewer and cycle provide a starting point. Inspect query plans against a synthetic large conference before adding indexes. Count aggregation should not require new persisted counters or a scheduled recomputation job.

## 5. Consolidated reviewer reminder flow

### Preview and selection

- “Remind” opens a preview for one reviewer; “Remind selected” groups selected assignments by reviewer.
- Default to eligible unfinished assignments within the visible scope. The chair can deselect individual papers. An Overdue queue defaults to overdue assignments only; including other remaining work requires explicit selection.
- Preview shows the exact recipient, paper identifier/title/cycle, effective individual deadline, email subject, time-zone explanation and total emails/assignments.
- One reviewer receives one digest for the selected assignments, never one email per selected row. Submitted, retired, withdrawn, historical, closed and missing-role targets are ineligible.
- Initial bounds: at most 50 reviewers and 500 assignments per confirmed bulk operation, with at most 100 assignments in one digest. Reject oversized selections visibly; do not truncate or split one reviewer into unexpected extra emails.

### Proposed contract and validation

Add `POST /conferences/:conferenceId/reviewers/:reviewerUserId/reminders` taking the selected assignment IDs and expected versions, plus a client request ID retained on retry. Return the digest ID, included assignment count, notification/log reference when available, and an explicit outcome such as queued, preparing, already requested today, suppressed or failed.

The server resolves the reviewer identity and email; do not accept a caller-supplied recipient. Revalidate authorization, membership, assignment ownership, conference scope, current cycle, submitted state and effective deadline. Acquire the same cycle locks as interventions in deterministic cycle-ID order, reread, and reject the whole reviewer digest if any selected item is stale or ineligible. Return a refresh-required message; do not quietly send a different selection from the preview. Independent reviewers in a bulk operation can succeed or fail separately.

The preview is a snapshot. Persist an immutable validated digest snapshot before asynchronous dispatch, including the chosen assignment IDs/versions and deadlines. A subsequent submission cannot recall an already queued email; do not claim the email always reflects changes made after confirmation. Revalidate prepared, unsent snapshots after an enqueue failure/retry and require a fresh preview when the selected work has changed.

### Email content and template safety

- Add a new platform template key, `reviewer.reminder_digest`, with HTML and plain-text bodies. Preserve the existing individual `review.reminder` and assignment templates.
- Include conference/reviewer names, the selected papers and cycles, each assignment's saved deadline, an overdue indicator at preparation time, and the configured review link.
- Display an unambiguous human-readable UTC date in email; use the viewer's local time with explicit time-zone help in the interface. Never substitute the conference-wide date for an individual date.
- The current renderer escapes every scalar placeholder and does not support raw repeated HTML. Generate the repeated paper list from a bounded structured array through a dedicated trusted renderer, escaping all manuscript/user strings and validating links. Do not add general unescaped placeholders or concatenate user HTML.
- Preview and queued mail must use the same rendering path and validated snapshot. Preserve conference branding and existing template customization boundaries; new digest customizations must retain the structured paper/deadline section.

### Deduplication, dispatch and audit

- V1 policy: at most one manual reviewer digest per conference/reviewer per UTC day. Identical retries refer to the same request. A second selection that day returns “Already requested today” and identifies the existing digest; changing the date/selection does not bypass the limit. No force-resend control in V1.
- This limit applies to manual reviewer digests. Existing scheduled and individual assignment reminders retain their policies; make the distinction visible in the preview rather than claiming all mail is globally deduplicated.
- Persist a small digest/outbox record, its immutable item snapshot, requester, UTC date, request/idempotency key, preparation/dispatch state and notification reference. Enforce the daily uniqueness in the database. Do not store review content.
- Use a durable outbox handoff to the existing worker/notification infrastructure. A prepared request must be recoverable after a process crash; a failed queue attempt must not be reported as queued merely because a notification log exists. Retry the same digest identity, with unique queue/provider idempotency keys, and distinguish delivery failure from enqueue failure.
- Keep transactions short: validate/record under locks, release locks, then dispatch asynchronously. A relay retry checks the recorded state; it does not send a new logical digest. Validate provider retry behavior rather than promising exactly-once email delivery.
- Record the actor, reviewer, selected assignment IDs, deadline snapshot, digest ID and outcome in audit/log metadata. Show per-reviewer bulk results with name/email and paper identifiers, plus a link to delivery status where permitted.
- Suppressed recipients receive an explicit outcome. Retries of infrastructure failures reuse the same reservation; an already queued digest is not independently resent. No provider email is sent during development checks.
- If an unsent snapshot becomes stale, cancel that preparation and require a fresh preview. Reuse its daily reservation only when the system can prove no mail job was queued or sent; retain the cancelled snapshot/audit record. An ambiguous enqueue outcome must be reconciled before permitting another send.

## 6. Changes by package

- `packages/schemas/src/review.ts`: overview query/response, reviewer metrics/assignment metadata, digest input/result schemas and bounded selection rules.
- `packages/contracts/src/review.ts`: overview GET and reviewer-digest POST contracts with 400/401/403/404/409 outcomes.
- `apps/api/src/review/`: shared read model/aggregation, reviewer overview service, digest preparation/validation and controller/module registration; preserve existing intervention endpoints.
- `apps/api/src/messaging/` and queue integration: digest publisher/renderer, durable enqueue result handling and delivery-log references.
- `packages/db/prisma/`: additive digest/outbox persistence, daily uniqueness, required indexes and tenant/RLS policies. No migration of existing review assignments or counts.
- `packages/db/src/email-drafts/` and canonical templates: the new digest definition plus an idempotent platform-template migration and seed support. Do not overwrite organization templates.
- `apps/worker/src/`: recoverable digest relay/dispatch through existing notification jobs; bounded processing and observable failures.
- `apps/web/src/app/dashboard/conferences/[id]/reviews/reviewers/page.tsx`: new route.
- `apps/web/src/components/dashboard/reviews/`: reviewer overview, expandable details, shared coordination view switch/action forms as appropriate.
- `apps/web/src/lib/`: typed API wrapper and URL filter/sort helpers; update conference navigation and organizer overview shortcut.
- `e2e/`: reviewer overview fixtures and browser flows extending the existing coordination test approach.

These are intended boundaries, not a requirement to create a large component hierarchy. Extract shared code only where it reduces duplicate behavior without changing the ledger's public contract.

## 7. Delivery sequence and completion gates

### Milestone 1 — counting rules and contracts

Implement the aggregation helper, roster/scoping definitions and typed overview/digest contracts. Create a shared fixture covering current/historical cycles, zero-assignment members, duplicate names, removed roles, submitted reviews with pending edits, drafts, replaced reviewers and closed unfinished work.

Gate: all count invariants hold; history cannot inflate current remaining/overdue totals; null and extended deadlines match the paper ledger.

### Milestone 2 — overview read API

Implement guarded tenant-scoped reads and aggregation. Refactor only the necessary common ledger read logic. Confirm complete roster handling and prevent draft-content exposure.

Gate: chairs/organizers see the same totals for equivalent ledger scopes; unauthorized and cross-conference requests fail; query volume does not grow once per reviewer.

### Milestone 3 — reviewer table and navigation

Build the route, summary, table, expansion, filters/sorts, URL state, pagination, current/history modes and links. Add individual existing interventions and prefilled manual assignment navigation. Disable actions while a snapshot is stale or a conflicting operation is running.

Gate: a chair can find a reviewer, inspect all selected-scope papers, follow the correct cycle link, and complete an existing intervention with fresh counts afterward. Mobile and keyboard interactions work.

### Milestone 4 — consolidated reminders

Add the digest/outbox migration and template; implement preview, server validation, daily uniqueness, immutable snapshots, relay recovery, notification rendering and per-reviewer result handling. Add selected-reviewer bulk execution with progress and refresh behavior.

Gate: one reviewer gets one correctly rendered logical digest per confirmed request/day; retries and crashes do not create new logical sends; all selected deadlines are individual saved dates; stale previews and suppressed/failed recipients receive honest outcomes.

### Milestone 5 — validation and release preparation

Run focused tests, builds/typechecks, appropriate lint, isolated migrations and real-database concurrency checks. Capture desktop/mobile table, expanded details, historical view, digest preview and mixed bulk outcomes using labeled synthetic fixtures. Complete the established bounded UI review and documentation workflow.

Gate: acceptance checks below pass, migration/deployment notes are complete, and no live email or external database change occurred during development validation.

Dependencies: Milestone 1 precedes the read API and UI; the shared contracts and validated snapshot precede reminder dispatch. The release is complete only after the reminder and validation milestones, not when the table alone renders.

## 8. Acceptance and regression checks

### Counts and scope

- A current reviewer with no assignments appears with zero counts and an Unassigned label.
- A reviewer with 5 assignments, 3 submitted, one draft and one unstarted shows 3 submitted and 2 remaining; overdue is a subset of those two.
- Closing an unfinished assignment's cycle moves it from Remaining to Closed incomplete without losing the record or breaking reconciliation.
- An earlier-cycle submitted review does not complete a newer-cycle assignment. All-cycle mode shows both assignment units with cycle labels.
- Replaced/declined/withdrawn records do not inflate active counts. Duplicate reviewer names remain separate identities.
- The exact-deadline boundary and the next-72-hours boundary are deterministic using the response timestamp. Individual extensions beyond the conference cutoff remain authoritative.
- Track/paper/cycle filters recalculate assignment counts; reviewer name/email search only filters people. Summary labels and visible totals match those semantics.

### Actions and email

- Existing reminder/extension/replacement permissions, reasons, COI checks, version conflicts and draft preservation still pass.
- Manual assignment deep links preselect the reviewer and retain individual deadline entry.
- A digest contains only the previewed eligible assignments and their exact saved deadlines in both email formats.
- Submitted, retired, historic, closed, withdrawn, wrong-reviewer, cross-conference and stale targets cannot be included.
- Concurrent submission/replacement/extension versus digest preparation is serialized consistently. Different lock orders cannot deadlock competing multi-paper previews.
- Concurrent duplicate requests produce one daily reservation; repeated POSTs return its state. Crash recovery, queue failure, suppression and provider retry paths are exercised with mocked mail.
- Mixed bulk outcomes identify each reviewer and affected papers; one failure does not imply the entire batch failed or succeeded.
- HTML escaping, long/unicode titles, configured links, time zones and plain-text rendering are tested.

### Interface and performance

- Search survives continuous typing; Back/Forward restores the selected view; stale network responses cannot replace a newer scope.
- Selection cannot silently target hidden work after filtering or refresh. History offers no mutation controls.
- Loading, failure, stale data, empty roster, no matches and zero remaining work have distinct states.
- Desktop and 390px mobile views contain overflow and expose all actions accessibly; keyboard expansion, preview focus, labels and status announcements work.
- Use a synthetic dataset of at least 1,000 reviewers and 10,000 assignments to inspect response size, query count and browser sorting/expansion. Record measured results; do not claim a performance target before measurement. If a complete snapshot is impractical, implement server aggregation/pagination before release with global summary counts and explicit selection scope.
- Run relevant schema, API, worker and web tests plus package builds/typechecks and lint. Re-run the existing paper-ledger browser and intervention regression checks.

## 9. Rollout and operating notes

1. Confirm the existing review-coordination commit and its prerequisite migrations are present in the target deployment; this plan does not assume the previously timed-out push succeeded.
2. Apply additive digest/outbox/RLS/template migrations before deploying code that uses them. Test from a clean isolated database and from the prior schema, including repeatable seed/template behavior.
3. Deploy the compatible API/worker before exposing the new UI; confirm the relay and template are available. Use the project's existing deployment controls rather than inventing a new flag system solely for this tab.
4. Perform a staging smoke test with synthetic conference data and a mail sink: reviewer totals, one digest, one extension and one replacement. Never use real reviewers for smoke email without explicit authorization.
5. Observe API errors, digest preparation age, outbox backlog, suppressed recipients and queued/delivered/failed notification status. Distinguish infrastructure failures from recipients who have not completed reviews.
6. If rollout fails, remove/hide the new route through the deployment rollback and stop new digest preparation while draining or deliberately holding prepared jobs. Do not roll back by deleting assignment history or reminders already sent. Additive tables can remain until a separately reviewed cleanup.

## 10. Decisions carried into implementation

The defaults above are deliberate: full reviewer roster, latest-cycle scope, separate closed-incomplete counts, draft-status privacy, per-assignment deadline authority, read-only history, 72-hour due-soon window, one manual digest per reviewer per UTC day, complete previews, explicit bulk limits and existing intervention safeguards.

No additional product decision is required to start implementing this plan. Capacity, expertise, automatic reminders and exports remain later releases. Implementation was subsequently authorised with a strict local temporary database boundary. Committing/pushing, deployment and production database migration remain separate work.

## 11. Implemented release and verification

### Application changes

- Added `/dashboard/conferences/[id]/reviews/reviewers`, conference navigation and a shared paper/reviewer view switch. The roster includes zero-assignment reviewers and assignment holders whose reviewer role has been removed.
- Added a repeatable-read, complete-snapshot API with server-selected paper/cycle scope and a pure shared workload aggregator. Only review existence/submission metadata is selected; review bodies, scores and pending edit content are excluded.
- Added attention queues, reviewer search, paper/track/history/cycle scope, workload sorting, 25-row pagination, URL state and expandable paper-cycle assignments. Paper links open the existing submission dossier at the selected review cycle.
- Added existing individual reminders, deadline extension and reviewer replacement from assignment rows. Reasons and future deadlines are validated by the existing intervention endpoint; replacement preserves original assignments and drafts.
- Added reviewer digest selection, server-rendered HTML/plain-text preview, explicit confirmation and independent per-recipient results. Client request IDs survive retries. Selection is limited to the current page; batches cannot silently include hidden reviewers.
- Added `reviewer_reminder_digests`, daily/request uniqueness, immutable validated snapshots, retained cancelled snapshots, runtime RLS, insert-only audit use, and a restricted worker cycle-lock function. Runtime roles cannot delete reservations. Organisation administrators and platform administrators retain their existing oversight access.
- Added a canonical `reviewer.reminder_digest` template and editable draft. The server owns the repeated paper/deadline section and escapes untrusted scalar values. Each mail uses persisted assignment deadlines, explicitly formatted in UTC, and records the previewed template version.
- A request transaction stores its reservation and pg-boss preparation job atomically. The worker locks and revalidates cycles, then creates the notification log and email job atomically. Stale selections are cancelled before handoff; queue failures roll back without falsely claiming an email was queued. Cancelled reservations can be reused only before a notification log exists, retaining earlier snapshots and ignoring obsolete preparation attempts.

### Verification performed locally

- Clean database recreation successfully applied all 48 migrations, including `20261009100000_reviewer_overview_digests`.
- 16 real PostgreSQL/pg-boss integration tests passed with the application's API/worker roles and RLS. Coverage includes daily concurrency/deduplication, organisation/platform access, participant denial, cross-conference isolation, reservation deletion denial, submitted reviews with pending edits, missing reviewer roles, history, stale previews/deadlines, cancelled reservation reuse, audit/queue rollback and a simultaneous review-submission/reminder race.
- Shared-schema tests: 18 passed. Database/template/rendering tests: 20 passed, including reserved-token rendering safety. Worker tests: 26 passed. Relevant review API unit tests: 56 passed. Web unit tests: 23 passed.
- All 18 ledger and reviewer browser flows passed together after the correction batch, including individual assignment reminders, dossier links, URL pagination restoration and mobile assignment actions. Browser APIs and mail delivery are synthetic fixtures, with actual canonical digest rendering for preview captures.
- Shared packages, API and worker builds passed. Frontend production build passed after allowing its existing Google Fonts downloads. Typechecks passed for schemas, contracts, database, API, worker and web. Changed-source lint checks passed; the frontend build reports existing warnings in unrelated files.
- A synthetic local PostgreSQL fixture returned 1,002 reviewers and 10,001 assignments without truncation in approximately 2.7–5.1 seconds across local runs. Its uncompressed JSON was approximately 9.2 MB. These are local development measurements, not production latency or capacity guarantees. Very large conferences may warrant a later server-paginated read model.

### Operational boundaries

All database commands explicitly selected `reviewer_overview_test` at `127.0.0.1:55449` in the owned temporary cluster. Integration tests refuse a non-local URL or a different database name. No production connection string was used for database operations, and no mail provider was called for digest testing. The owned temporary PostgreSQL cluster was stopped after verification.

`PREPARING` means a durable preparation job exists; `QUEUED` means the email-job handoff committed, not that delivery is confirmed. The overview displays the linked notification status when available. Preparation retries are finite and terminal failures remain visible. A submission after email handoff cannot recall the message. The existing provider transport is at-least-once; this release does not claim exactly-once inbox delivery after an ambiguous provider/network failure. Individual and scheduled reminder policies remain separate from the new manual digest daily limit.

The additive migration and compatible API/worker must be deployed before exposing the route in another environment. That rollout was not performed as part of this local implementation.

### Finish review corrections

The correction batch added visible server-confirmed recipients and assignment targets/totals through reminder confirmation/results; viewport-sized, stacked mobile assignment actions; remaining-work filtering and assigned/submitted sorting; stable deadline/name/ID ties; URL pagination; collapsed paper identifiers; local-time help and explicit overdue deadlines. The new digest omits the visual eyebrow while retaining conference identity in its copy and footer. Paper search narrows reviewer rows while a separate complete roster supplies replacement choices.

The independent finish reviewer scored all seven requested corrections resolved (`ship` at that fix-list scope). The final paper-search empty-state check distinguishes no matching reviewers from an empty conference roster.
