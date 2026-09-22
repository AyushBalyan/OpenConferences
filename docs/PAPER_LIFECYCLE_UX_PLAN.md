# Paper submission and review lifecycle: assessment and delivery plan

Date: 22 September 2026. Status: proposed plan; no application changes made.

## 1. Outcome and scope

Make it obvious to every participant: which paper and round they are working on, what changed, what they can do now, whether their work is saved, and what happens next.

The core issue is information architecture and workflow reliability, not merely spacing. A long page containing every lifecycle form makes unrelated tasks compete for attention. Moving those forms into tabs will help, but cannot fix unreliable saves, missing change awareness, or inconsistent permissions by itself.

This plan covers authors, reviewers, and the chair actions that govern their experience. Preserve the existing FresiCMT visual identity and improve its operational surfaces. Outreach and public marketing pages are outside scope.

Confirmed delivery preference: staged upgrades, with reliability and core workflows first. No calendar commitment is implied; size work after the initial contract and prototype review.

## 2. Evidence and limitations

Reviewed both reviewer audit documents, the current author detail page, reviewer editor, conference navigation, decision workspace, notification page, submission status helpers, review guards, reminder worker, and relevant schema/contracts. This is a source-based assessment supported by the earlier audit's reported live findings; no fresh authenticated browser or production test was performed.

Confirmed in current source:

- The author detail page combines paper details, authors, manuscript upload, released reviews, rebuttal, decision, registration, and camera-ready upload. Source: `apps/web/src/app/dashboard/conferences/[id]/submissions/[paperId]/page.tsx`.
- Its secondary requests catch failures and substitute empty reviews, absent rebuttal, or absent decision. A network or authorization failure can therefore look like “nothing has happened.”
- The review editor has idle/saving/saved/conflict states, but no terminal phase-locked or persistent save-error state. Fields are disabled for conflict rather than server-derived edit permission. Its rebuttal request runs during load and errors become an absent rebuttal. Source: `apps/web/src/components/dashboard/reviews/review-editor/review-editor-panel.tsx`.
- The decision workspace loads papers and decisions rather than a consolidated review evidence dossier. Source: `apps/web/src/components/dashboard/reviews/decisions/`.
- Submission helpers prefer the current clean version over the latest uploaded version. This creates a risk of showing ready while a replacement is pending; reproduce this explicitly before changing semantics. Source: `apps/web/src/lib/submission-types.ts`.
- The reminder sweep skips overdue assignments. Source: `apps/worker/src/reminder-sweep.ts`.
- The inspected schema has no participant notification read receipt or review discussion model.

Corrections to the September 20 audits:

- An Email log already displays failures and supports resend: `apps/web/src/app/dashboard/conferences/[id]/notifications/page.tsx`. Improve discoverability, filtering, access for relevant coordinators, and failure summaries; do not rebuild it.
- `ReviewerAssignment.dueAt` and assignment creation input already exist. Extensions need an assessed edit workflow and clear fallback semantics, not automatically a new field/migration.
- The current review header says “Review editor” and includes the paper title in its description. The earlier UUID-heading observation needs browser revalidation; the missing richer paper context remains relevant.
- MFA, trusted-device behavior, download filename leakage, and role-grant feedback remain audit-reported findings pending targeted revalidation.

Benchmark: Fourwaves documents a side-by-side submission/review experience, reviewer progress tracking, consolidated feedback, configurable review forms, and controlled author-visible fields. These support the proposed task separation, rather than establishing an exhaustive feature-parity checklist. Sources: [peer-review product](https://fourwaves.com/peer-review-software/), [review configuration](https://help.fourwaves.com/en/articles/8350208-customize-reviews), [feedback visibility](https://help.fourwaves.com/en/articles/8756893-share-review-results-to-authors). “HotCRM” is treated as a general quality reference; no specific product capability is attributed without confirming the intended product.

## 3. Target experience

### Shared workspace

Keep conference navigation distinct from paper navigation. Add a clear Author / Reviewer / Chair workspace switch for people with multiple roles, preserving their conference and last relevant location. This is presentation context, never a substitute for server authorization or conflict-of-interest checks.

Each paper workspace has a compact persistent header: paper title and human-readable identifier, round selector where relevant, lifecycle status, deadline with timezone, and one primary next action. Status and action-needed are different: a submitted paper can still require a rebuttal. Avoid UUIDs as primary labels.

Use route-backed sections with refreshable URLs and browser history. Show meaningful read-only sections and explain locks; hide genuinely irrelevant actions. Preserve existing deep links through redirects and anchor mappings. Do not put every section's forms below the navigation again.

### Author

My submissions becomes an action queue: title, stage, next deadline, required action, unread updates, and last meaningful activity. Filters: Action required, Drafts, Under review, Decisions, Completed. Counts and row status use the same definitions.

Paper sections, relative to `/submissions/:paperId`:

- **Overview:** current stage, next action, deadline, compact recent activity. No full editing forms.
- **Submission:** metadata, authors, manuscript and version history. Explicit Edit mode while permitted; otherwise read-only. Draft creation uses Details → Authors → Manuscript → Confirm submission, with resumable progress and field validation.
- **Reviews:** released feedback grouped by round and stable anonymous reviewer labels, with visible new/updated markers. Read-only; confidential chair content never reaches this response.
- **Rebuttal:** a dedicated response editor with released reviews available alongside it. Show save status, word limit when configured, deadline, preview, explicit submission receipt, and update policy. Preserve the existing single response per paper/round initially; do not silently introduce per-comment threads.
- **Final materials:** decision-dependent camera-ready tasks and registration links/checklist. Keep the detailed payment flow separate from the manuscript form.
- **Activity:** participant-visible milestones and changes with deep links. This is not the internal security audit log.

Separate Upload PDF and Submit paper. Track the exact intended version through upload, scan, clean, rejection, and failure. A clean older version must not silently satisfy a replacement upload. Preserve the older version and make any choice to submit it explicit and server-validated. Slow scanning shows elapsed status and an organizer support path, not an invented completion estimate or endless ambiguous spinner. Reload must recover the server state.

### Reviewer

My reviews is a task queue with Not started, Draft, Submitted, New rebuttal, Due soon, and Overdue filters. Show deadline, last saved/submitted state, and a context-sensitive Start review / Continue review / Read rebuttal action. Include Decline or Report conflict where policy permits, with confirmation and chair follow-up.

Assignment workspace:

- **Paper & review:** desktop split pane with authorized PDF viewer on the left and structured review form on the right. Paper title, abstract, keywords, round, deadline, and save state stay discoverable. Put author-visible and chair-only comments in clearly labeled separate sections.
- **Author response:** released rebuttal and update timestamp, with a link back to revise the review when allowed. Do not bury the response beneath the entire scoring form.
- **History:** submission receipts and permitted review changes. Internal committee discussion is a later distinct capability, not a public conversation by default.

On narrow screens, switch between Paper and Review without losing position or draft state; never squeeze two panes into an unusable width. PDF failures have a download fallback. Signed URLs must refresh safely; retain blinding, authorization, and accessible alternatives.

### Chair

Provide a review operations queue: missing assignments, incomplete/overdue reviews, declines, new rebuttals, papers ready for decision, and failed communications. Add search, round/track filters, workload and completion indicators.

Opening a paper presents its review dossier: all permitted reviews, recommendations, score spread, confidential comments, rebuttal, and decision history. Keep the decision composer near the evidence. Do not preselect acceptance as an implicit default; require a deliberate outcome. Bulk decisions need selection review and a confirmation summary.

Separate recording a decision, releasing reviews, opening rebuttal, and notifying authors into explicit operations with clear consequences. Current state-machine coupling must be addressed in the backend before offering new paths in the UI.

## 4. Notifications and change awareness

Build a participant inbox, conference navigation counts, paper-row indicators, and section-level “new” markers from one persistent recipient state. Email complements this inbox; SENT is not read, and read is not task completed.

Initial events and audiences:

- Assignment created/changed → assigned reviewer; decline/conflict → authorized chairs.
- Reviews released or author-visible published feedback updated → authorized authors.
- Rebuttal submitted or meaningfully updated → assigned eligible reviewers and chairs.
- Decision released → authorized authors; internal decision recorded → eligible chairs only.
- Deadline changed, due-soon, overdue, or scan failed → affected participants; operational scan/delivery failure → organizers.

Do not notify authors on a reviewer's private autosaves or expose hidden review counts. Avoid rebuttal notifications on every keystroke. Use explicit publication/submission events and distinguish drafts from published changes.

Proposed persistence: a workflow event plus recipient notification/read state, carrying conference, paper, round, entity version, safe summary, target route, and deduplication key. This is a schema/API proposal to refine during design, not a claim that the entities already exist. Record events transactionally with the mutation and dispatch through a durable outbox/retry process. Reuse existing queue and mail plumbing where appropriate.

Mark an item read only after its authorized detail successfully loads or the user explicitly marks it read. Acknowledgement applies to the viewed version, so a later update becomes unread again. Counts survive reload and synchronize across devices. Recheck access at read time after reassignment or membership changes. Do not place confidential text in email previews, notification payloads, analytics, or URLs.

Start with paginated inbox queries and visibility-aware periodic refresh with backoff. Adopt server push only if freshness/load evidence justifies it. Proposed acceptance target: new items appear within 30 seconds in an active online session; this is a target, not measured current performance. Group related events and cap reminder frequency. Reuse the existing email log for delivery retries and add a failure summary to chair operations.

## 5. Workflow and reliability foundation

Return server-derived capabilities with the relevant resources: canEdit, canSubmit, canRebut, canDownload, canDecline, lock reason, effective deadline, and permitted next actions. Determine these from role, ownership, conflicts, paper/round state, publication state, and file version. Mutation endpoints remain authoritative when state changes while a page is open.

Use stable error codes for phase lock, version conflict, deadline passed, scan pending, and permission denial. Preserve standard HTTP status semantics; do not classify failures by English-message regex.

Editors distinguish Unsaved, Saving, Saved at time, Save failed, Conflict, Read-only, and Submitted. Cancel retry loops for terminal failures, retain the draft buffer, offer manual retry for recoverable failures, and block submission until the exact visible draft has saved. Handle navigation and browser-close warnings. Never automatically overwrite a newer server draft after a version conflict; provide recovery/comparison. Any cross-reload draft recovery must be scoped to user/paper/round, expire, and be cleared on logout, especially on shared devices.

Make round-specific queries explicit; preserve the selected round during refresh. Specify deadline policy before implementation: hard close versus late submission with labeling and chair override. Support extensions using the existing assignment due date. Explain locks consistently in the API and UI.

Release visibility is an independent permission decision. A new inbox, viewer, and history page must preserve double-blind rules and prevent coauthor/chair role combinations from bypassing conflicts. Neutral filenames do not anonymize PDF contents or embedded metadata; explain author responsibilities and test download headers separately.

## 6. Delivery sequence and acceptance gates

### Phase 0 — Baseline and workflow contract

Create isolated fixtures for author, reviewer, chair, and multi-role users across two papers and two rounds. Reproduce the audit's critical defects without touching live conference data or sending real mail. Inventory endpoints and document the capability/publication/deadline matrix. Prototype the three workspaces within the existing visual system.

Exit: agreed page map and policy defaults; each audit finding classified as confirmed, already implemented, or needs live verification. Capture initial task-completion and error baselines.

### Phase 1 — Protect work and make state truthful

Fix terminal autosave failure, unsaved navigation, conflict recovery, server capabilities, intended-version scan readiness, and partial-load error states. Revalidate/fix MFA routing and inert security controls. Address confirmed filename blinding leakage before broader release.

Exit: typed review/rebuttal text cannot silently disappear in phase-change, failed-save, refresh, or multi-tab scenarios; displayed save state agrees with persisted content. An unscanned replacement cannot appear ready. Failed feedback retrieval never displays a false “no reviews” state.

### Phase 2 — Separate the author and reviewer tasks

Implement shared workspace header/navigation, author sections, resumable submission steps, focused reviewer editor/PDF viewer, dedicated rebuttal surfaces, and consistent task queues. Add reviewer decline/report-conflict flow and relevant chair handling.

Exit: an author can submit, return to released reviews, and submit a rebuttal without encountering unrelated editable forms; a reviewer can read a paper, save/submit a review, and later locate the rebuttal without losing context. Verify desktop, mobile, keyboard, screen-reader status announcements, long titles, long reviews, and several rounds.

### Phase 3 — Deliver change awareness

Implement transactional events, recipient inbox/read state, unread counts, targeted highlights/deep links, grouping, reminders, and integration with delivery monitoring. Contract design can begin in Phase 0; rollout follows stable resource routes and visibility rules.

Exit: a released review appears for the right author, a rebuttal appears for the right reviewer, reading one version clears only that update, retries produce no duplicate items, and private or wrong-conference content never appears. Email failure does not remove the in-app update.

### Phase 4 — Complete chair operations

Ship review progress, review dossier, explicit decision/release actions, extension workflow, overdue management, and decision confirmations. Move the minimal dossier/progress work earlier if an active conference needs chairs to make decisions during the rollout.

Exit: a chair can identify missing reviews, inspect evidence, extend an assignment, handle a decline, record an intentional decision, release permitted content, and detect failed mail through the UI.

### Phase 5 — Advanced capabilities

Versioned configurable review forms, assisted assignment with COI/workload safeguards, committee discussion, meta-reviews/area chairs, and scanned review attachments. Prioritize from actual conference volume and policy needs. Freeze form versions for active rounds so changed scoring scales do not corrupt comparisons. Each feature requires its own access and lifecycle design.

These are separate product investments; they should not delay the core reliability, segregation, and notification improvements.

## 7. Engineering handoff and rollout

Suggested independent work packages: capability/error contract; safe editor state machine; author routes; reviewer workspace/viewer; recipient inbox; chair dossier; deadline/decline operations; lifecycle accessibility and regression checks. Backend contract changes precede consuming UI. Notification read state requires migration and tenant/recipient authorization tests; page splitting and the PDF viewer do not inherently require schema changes.

Likely touchpoints: `packages/schemas/src/review.ts`, `packages/contracts/src/`, `apps/api/src/review/`, `apps/api/src/submission/`, `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/conference-nav.ts`, author routes, reviewer editor and decision components, notification routes, and worker notification/reminder processing. Avoid overlapping unrelated uncommitted outreach work.

Roll out through additive contracts and conference feature flags. Pilot on a synthetic conference, then a small consenting conference. Keep existing links working. A UI rollback must not discard drafts, event history, or submitted content. Notification backfill should establish a baseline rather than flood users with historical unread items or retroactive email.

Required scenarios: first upload and retry; replacement scan; two papers from one account; multiple rounds; review edited while phase changes; concurrent tabs; offline/reconnected saves; newly released feedback; amended rebuttal; deadline extension; reassignment; role revocation; reviewer also an author; confidential comments; scan-worker and mail-worker outage. Test against disposable data with mail capture.

Measure successful submission completion, saved-draft recovery, time to find new feedback, review/rebuttal completion, save failure frequency, notification latency/duplicates, scan age, and overdue workload. Never collect manuscript or review text in product telemetry. Set numeric improvement targets after baseline measurement; the hard release requirements are no silent data loss, no confidential-content exposure, and truthful state across routes.

## 8. Decisions to settle before implementation

Confirm timing and live-conference constraints; exact deadline and post-submission editing policies; whether rebuttal is optional per round; when updated reviews are republished; which authors receive updates; and whether “HotCRM” refers to another peer-review product. Recommended defaults: retain current publication boundaries, notify corresponding authors and eligible assigned reviewers, keep rebuttal as one versioned response per round, and make policy changes explicit rather than silently broadening access.

The recommended first deliverable is Phase 0 plus the Phase 1 reliability fixes, followed immediately by the author/reviewer workspace separation. Visual polish then reinforces a workflow users can already trust.
