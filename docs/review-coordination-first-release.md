# Review coordination: first release

Status: implemented and locally validated. Scope agreed on 6 October 2026. Deployment is a separate step.

## Outcome

An organizer or chair can answer three questions from the conference overview and paper review ledger: which papers are blocked, which reviewers need attention, and which intervention will resolve the problem.

## Product scope and defaults

- Extend the existing organizer overview and Review progress route; retain the current dashboard design and navigation.
- The ledger defaults to the latest review cycle of every eligible paper across the conference. At the user’s request, a history filter also exposes earlier cycles in the same ledger; overview counts and intervention controls remain current-cycle only.
- Show paper identifier, title, track, cycle/stage, reviewer names and progress, submitted reviews versus the configured minimum, effective deadlines, blockers, and next action.
- Filter by paper/title, track, cycle number, reviewer, insufficient assignment coverage, overdue reviews, and decision readiness. Page results in the browser without silently excluding papers from the snapshot.
- Draft content remains private; coordination receives draft status only.
- Chair and organizer roles can perform interventions. Invitation administration retains its existing organizer-only permission boundary.
- Support per-assignment reminders, replacements and deadline extensions. Support bulk reminders and extensions with a concrete selection preview and individual results. Replacement is deliberately a single-assignment action to avoid accidental reviewer swaps.
- Set an individual deadline during manual reviewer assignment. Prefill the normal default, let the chair choose a future local date/time, save it in UTC, and include that exact saved date in assignment and reminder emails. Replacement also exposes its new reviewer's deadline.

## Delivery sequence

### 1. Shared contracts and deadline semantics

Add typed coordination snapshot and intervention contracts. Use one effective-deadline helper everywhere: an explicit assignment deadline wins; otherwise use the cycle deadline, then the conference deadline, capped by the existing seven-day assignment window. A chair extension is an explicit override and may exceed the default conference/cycle deadline. Require a future, strictly later deadline and a reason. Use assignment versions to reject stale changes.

Acceptance: chair ledger, assignment list, reviewer dashboard, analytics and scheduled reminders report the same effective date. Existing null deadlines retain the normal seven-day fallback.

Assignment acceptance: reject past or invalid explicit deadlines before opening a cycle; save the date without recapping it against the conference default; pass the saved date to the assignment email. Browser date entry uses local time and emails label their date as UTC. Changing the final conference deadline does not rewrite saved assignment deadlines.

### 2. Conference-wide coordination snapshot

Load eligible papers with their latest cycle and batch-load assignments, submitted-review status, decisions, tracks and pending invitation count. Exclude declined/replaced assignments from active coverage and overdue counts. Compute all summary counts from the same current-cycle dataset as the ledger. Completed and revision-requested cycles do not appear in the intervention queues. Return an observation timestamp so relative deadlines and stale data are explicit.

Acceptance: a paper with no assignments is visible; a missing cycle is visible; previous-cycle reviews do not satisfy the latest cycle; identical reviewer names do not collapse identities; summary links and ledger filters agree.

### 3. Safe interventions

- Reminder: validate scope, coordination permission, open current cycle and unfinished assignment; enqueue the existing review.reminder template, deduplicate by assignment/version/UTC day, and record an audit event. Display queued/suppressed/failure results honestly; delivery remains in the existing notification log.
- Replace: validate membership, authorship/COI/conflict bid and uniqueness; lock the cycle and atomically mark the old assignment REPLACED and create the new one with a future reviewer deadline. Retain the old assignment/draft. Refuse replacement of submitted/completed reviews or closed/old cycles. Audit the old/new reviewer IDs, new assignment ID and reason. Notify the new reviewer through the existing assignment template.
- Extend: lock the cycle, validate current assignment and version, save the later date with a version increment, and audit the before/after date and reason. Offer a separate reminder action using the updated deadline.
- Bulk operations execute bounded selections and report each assignment result; never treat a partial batch as full success.

Acceptance: a failed replacement leaves the old assignment active; old reviewers cannot save/submit after replacement; stale requests cannot overwrite changes; submitted reviews are preserved; cross-conference and unauthorized requests are rejected.

### 4. Actionable organizer overview

Add an attention list linking to ledger filters for missing reviewers, overdue reviews and decision-ready papers, plus pending invitations for organizers. Replace phase/slug deadline placeholders with actual conference deadlines. Keep submission and registration context.

Acceptance: counts load independently of unrelated dashboard requests; errors remain visible; loading never appears as a false zero; all queue links preserve their filter in the URL.

### 5. Paper ledger and inline actions

Upgrade Review progress to the paper ledger. Use a compact operational table, URL-backed filters, 25-paper pages, an expandable assignment section, and an inline action form. Show reviewer progress, exact local deadline and overdue state. Include recipient/date/replacement preview and required reason fields. Retain review release with a deliberate author-visible confirmation, and link to decision dossiers and existing manual assignment tools.

Acceptance: keyboard-accessible controls, empty/loading/error states, mobile horizontal table scrolling, selection restricted to active unfinished assignments, fresh versions after mutation, and visible per-item bulk results. No unfinished review text reaches the coordination UI.

### 6. Validation and release preparation

Build shared packages and regenerate the Prisma client. Run deadline/queue/filter tests, API intervention tests (permissions, scoping, current-cycle checks, submitted-review preservation, COI, stale version and atomic replacement), reviewer access regression tests and reminder tests. Run API/web/worker typechecks and relevant lint checks. Inspect the UI at desktop/mobile widths if a local preview is available, run the Impeccable detector once, and record any environment limitations.

The release adds two migrations: `20261006090000_review_assignment_replacement` introduces the REPLACED status, and `20261006100000_review_coordination_email_deadlines` updates the active platform assignment/reminder templates to show the actual deadline and configured review link. Apply both before deploying the updated API/worker. Organization-specific custom templates are preserved; any customized assignment/reminder template should include `{{dueAt}}` (UTC) and `{{reviewUrl}}`. Development does not apply migrations to an existing external database, send live test email, publish, or deploy.

## Follow-on work

Reviewer capacity/expertise matching, track delegation, internal discussion, score-disagreement signals, reminder scheduling policies, and server-side ledger search/pagination for unusually large conferences are separate releases.

## Implementation record

Completed:

- Typed contracts, shared effective deadline helper and additive database changes.
- Conference-wide current/historical cycle snapshot, attention counts and private-draft status metadata.
- Cycle-locked version-checked interventions, atomic replacement with audit rollback, retained drafts, conflict checks and retired-reviewer write protection.
- Actionable overview and URL-filtered ledger, read-only history, individual/bulk action previews and per-item results.
- Individual deadline selection on manual assignment, server validation, audit date, and assignment/reminder template updates.
- Saved deadlines used in reviewer assignment views, dashboard, analytics and worker reminder scheduling.

Validation:

- Shared schema deadline/intervention tests: 5 passed. Ledger filter/selection tests: 3 passed.
- Full API unit suite: 126 passed. Nine opt-in PostgreSQL tests are skipped in this suite and run separately below.
- Isolated PostgreSQL with application RLS: 9 passed, covering initial assignment date persistence/email payload, atomic rollback, draft preservation, retired-reviewer denial, concurrent extensions, replacement versus submission, and existing review/rebuttal/decision locks.
- Platform email templates: 10 passed; API email rendering verifies the saved deadline in HTML and plain text.
- Worker reminder checks: 4 passed, including extended deadlines and historical-cycle exclusion.
- API, web and worker typechecks passed. API lint passed; web lint passed with existing warnings elsewhere. The new ledger's unused-variable warning was removed.
- Browser flows against the real web UI with intercepted synthetic API fixtures: 9 passed. Covers deadline selection/local-to-UTC conversion, overview queue navigation, historical read-only cycles, reminder preview, extension, replacement, bulk partial failures, error states, persistent search and desktop/mobile overflow.
- Both migrations successfully applied to a new isolated local PostgreSQL database. No existing external database was modified and no live email was sent.
- Impeccable detector: no findings on changed UI targets. Independent UI review identified three fixes (bulk failure identities, mobile scroll cue and placeholder contrast); its verdict pass scored all three resolved, with disposition ship at that fix-list scope. Evidence is stored in `.impeccable/review/`. The documentation check confirmed this extension preserves the incumbent dashboard system. Existing DESIGN.md/dashboard differences and the absent design sidecar were recorded without changing the design files.

Practical limits: the snapshot is conference-wide and browser-paginated; very large conferences may need server pagination in a later release. A reminder result describes queuing, while delivery remains visible in the existing notification log. An extension updates the reviewer UI; a chair can then send a reminder with the new deadline. Replacement reports email queue failure separately from the already committed assignment change.
