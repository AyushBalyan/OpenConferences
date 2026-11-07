# Reviewer Platform — Proposed Update Sheet v3.1

**Conference:** ICAMCDS-2026  
**Prepared:** 6 November 2026, Asia/Kolkata  
**Status:** First-release scope approved by the user and implemented locally. Production rollout remains separate.  
**Basis:** [Developer Specification v3](/Users/lkbalyan/Downloads/reviewer_platform_spec_v3.md) and [current implementation review](/Users/lkbalyan/Documents/GitHub/OpenConferences/docs/reviewer-platform-v3-review.md)

## 1. Recommendation

Implement the reviewer-operations upgrades as additions to the current platform. Reuse the existing invitation generator, credential scopes, paginated reads, conflict checks, chair replacement/extension services, and reminder infrastructure.

Prioritize reliable personal invitations and safe integration-controlled assignment management. Keep the conference mailbox as the default sender of new bulk invitations. Preserve identity verification for acceptance, existing review/decision workflows, historical reviews, and current integration contracts.

This sheet distinguishes four decisions:

- **Implement in the first release:** necessary operational capabilities with clear behavior and compatibility protections.
- **Retain and reuse:** working functionality that should not be rebuilt or disabled.
- **Defer:** feasible improvements that should follow the core release, with their prerequisites stated.
- **Keep out:** behavior excluded from this update because it changes the product boundary, risks existing records, or contradicts the intended workflow.

The original one-week target is not adopted as a delivery commitment. Migrations, public-link security, concurrent transitions, and 1,000-row throughput must be validated before scheduling a production release.

## 2. Retain and reuse

### R-1. Existing integration foundation

Keep existing paper, author, reviewer, invitation and assignment read endpoints, pagination, cursor handling, credential scoping, request idempotency, and machine-readable errors.

The existing email-array invitation endpoint remains available with its documented request/response behavior and 25-address maximum. A new structured bulk operation provides the larger capability; existing callers are not forced onto a new payload.

### R-2. Identity-bound reviewer access

Keep the requirement that reviewer access belongs to the invited email/account. Reuse the existing authentication and passwordless infrastructure where appropriate.

The optional name/password account setup remains skippable. It is not a research-fields or conflict questionnaire and should not be removed merely because the specification excludes a post-acceptance questionnaire.

### R-3. Conflict checks

Preserve paper-author conflicts, normalized author-email matching, declared conflicts and conflict bids across all assignment paths. These checks remain active during the first release; they are not postponed because the original specification labels them P1.

### R-4. Existing coordination services

Reuse the chair services for atomic replacement and deadline extension, including current-cycle restrictions, version checks, required reasons, audit history, and draft preservation. Add integration access to the shared business logic rather than building a second assignment engine.

### R-5. Review and decision behavior

Keep submitted reviews, author visibility, decision readiness, cycle closure, and published decisions unchanged. Existing overdue assignments remain assigned until an authorized person explicitly releases or replaces them.

### R-6. Messaging foundation

Reuse templates, notification history, suppression handling, worker queues, manual reminder digests, and existing delivery infrastructure. Changes to automatic reminders must be coordinated with the current sweep rather than running an overlapping scheduler.

## 3. Implement in the first release

### U-1. Safe invitation lifecycle transitions

**Covers:** FR-2, FR-3, FR-4.4–4.7; NFR-10.

- Use one concurrency-safe transition mechanism for accept, decline, revoke, extend and reissue.
- Recheck state, expiry and token generation inside the transition transaction.
- Commit acceptance and reviewer membership effects coherently; an accept/decline race must produce one terminal outcome.
- Record transition time, action, actor/source, resource identity and relevant generation/version.
- Preserve invitation records after expiry, decline and revocation.
- Do not fabricate historical sent/opened/accepted/declined timestamps. Leave unavailable historical timestamps unknown.

**Compatibility rule:** Keep the existing legacy `status` values and filters working. Introduce richer lifecycle information through additive fields or a new operations API. Legacy lists may continue omitting revoked invitations, matching their former removal behavior, while new operations lists retain revoked records. A new lifecycle value must not appear unexpectedly in an old strict status field.

**Delivery rule (user-approved override):** Generating an invitation link marks the invitation **Sent** and records `sentAt`, with source `SENT_LINK_GENERATED`. This is the platform’s operational acknowledgement, not a claim of confirmed mailbox delivery. Legacy `status=PENDING` remains unchanged; additive `lifecycleStatus=SENT` carries the richer state. Historical sent times remain unknown until a new link is generated.

### U-2. Structured bulk personal invitations

**Covers:** FR-1.1–1.6; FR-10.1; NFR-7.

- Add a structured batch operation accepting up to 1,000 rows.
- Each row has a stable row identifier, name, email, affiliation, relevant research fields, and optional external reference. Normalize email and field identifiers while retaining the supplied display values.
- Return an outcome for every input row: created, existing active invitation, skipped existing reviewer, skipped author, duplicate within batch, or invalid. Include a clear reason and invitation identity where applicable.
- One invalid row must not reject all valid rows. Repeated rows retain separate row results even when they refer to the same invitation.
- New invitation results include separate accept and decline links through an authorized operational response/download. These links must not enter general logs, event payloads or assistant prompts.
- Use a background job when necessary, with job identity, progress counts, final row results, resumable processing, bounded transactions and idempotent retries.
- Keep initial sending off for the new batch operation. The conference mailbox uses the returned links.
- Document separate job-submission, progress-read and result-download limits. Do not bypass tenant authorization or permit unbounded concurrency for bulk work.

**Deduplication policy:** Allow one active invitation per normalized email per conference, while retaining closed invitation history. By default, skip existing reviewers and authors of any retained paper in that conference. This skip policy applies to creating new invitations; it does not revoke existing reviewer roles or prohibit legitimate reviews of other people's papers.

**Closed invitations:** A declined or revoked invitation is not silently reopened by uploading the same email again. Report the closed state. An authorized explicit re-invite creates a new invitation identity and retains the original response/history. Accepted invitations are not reissued as a way to modify membership.

**Protected results:** Proposed default retention for secret-bearing bulk result downloads is seven days, shortened when relevant tokens expire or are invalidated. Retain non-secret job outcomes according to the conference retention policy. Live-link availability must never exceed the underlying invitation's validity; non-secret result rows may remain available under the retention policy. Downloads require scoped authorization.

### U-3. Configurable expiry, extension and reissue

**Covers:** FR-2.1–2.4.

- Keep seven days as the default to preserve current expectations.
- Allow conference default and per-invitation/batch lifetimes of 1–30 days.
- Add extension-only operations for one or many active invitations. An extension moves expiry later without changing invitation identity or its current links and does not send mail implicitly.
- Add explicit reissue for pending or expired invitations. It preserves invitation identity/history, rotates both action secrets and invalidates both old links, optionally resetting expiry.
- Require an explicit new invitation for a previously declined or revoked person; do not erase their old response.
- Keep legacy resend as a distinct operation with documented legacy behavior; do not relabel resend as reissue.
- Expired links are rejected immediately by time checks even if a background worker has not yet recorded the expiry transition.

**Important boundary:** Invitation lifetime and authentication magic-link lifetime are independent. Extending an invitation must not claim to extend an already issued authentication credential. A user may obtain a fresh authentication link and continue using the still-valid invitation; no expired credential becomes valid again.

### U-4. Dedicated public decline flow

**Covers:** FR-4.1–4.7; NFR-5 for decline.

- Issue an action-specific decline secret distinct from the accept secret.
- Opening the decline URL needs no login and shows a confirmation page, optional reason, Confirm and Go back.
- Loading the page does not decline the invitation. Go back leaves the invitation unchanged.
- Confirmation performs a protected state-changing request, records the decline/time and optional reason, and shows a thank-you page stating that no further action is needed.
- Once declined, neither action may change that invitation again. Repeated requests show a calm state message without repeating side effects.
- Show clear messages for expired, accepted, declined, revoked and invalid invitations, without revealing personal details to someone who lacks a valid token.
- Add abuse limits to public lookup/confirmation routes. State changes use explicit POST requests with appropriate request-origin protections.
- Permit valid decline confirmation even when the browser is signed into a different account; the dedicated decline token authorizes declining that invitation, not access to an account.

**Privacy rule:** Decline reasons are optional, bounded, stored separately from general telemetry, and available only to authorized organizers/integrations with explicit sensitive-response read permission. Ordinary polling and outbound events do not include the reason.

### U-5. Integration-controlled assignment operations

**Covers:** FR-5.1–5.6.

- Expose existing replacement and extension behavior through conference-scoped integration permissions.
- Resolve opaque integration reviewer identifiers server-side. Do not pass them directly into internal user-ID fields or expose internal identities unnecessarily.
- Add explicit release-to-pool with a required reason and durable history. It must preserve the old assignment and any draft.
- Replace atomically: retire the original assignment and create the new reviewer assignment in one coherent transaction.
- Restrict first-release release/replacement/extension to unfinished, active assignments in the current open review cycle.
- Extend deadlines only to a future instant later than the current effective deadline. Preserve the existing fallback/override rules.
- Make retries safe through idempotency and version/state checks. A retry cannot create a second replacement or repeat release side effects.
- On release, remove the assignment from active workload, reminder eligibility, reviewer submission authorization and active coverage. Keep it available in authorized history.
- Keep a same-reviewer retired assignment from being silently recreated in the same cycle. Return a clear conflict until an explicit reactivation policy is designed.

**Deletion rule:** Normal operational removal becomes history-preserving release, including the organizer UI. Where an existing removal endpoint must remain available, preserve its response contract while routing applicable removals through safe retirement; reject changes to submitted/closed work clearly. Do not silently cascade-delete reviews. The existing unsafe deletion behavior is an intentional safety correction, not a behavior to preserve.

**Terminology:** Releasing a reviewer assignment is different from publishing/releasing submitted reviews to authors. Use distinct action names and keep the latter workflow unchanged.

### U-6. Useful invitation lists and incremental polling

**Covers:** FR-3.2–3.5; FR-4.7; NFR-8.

- Add filters for lifecycle, email, research field, and changes since a supplied cursor/time.
- Provide per-status counts and transition timestamps with a consistent observation time.
- Include accepted/declined/expired/revoked changes in the polling feed. An expiry must not be missed simply because no one clicked its link.
- Use a stable change sequence or recorded-at/ID cursor so simultaneous updates and delayed expiry processing cannot be skipped.
- Keep lists paginated, tenant-scoped and safe for polling. Include identifiers and operational state by default; keep invitation secrets and sensitive reasons out of normal list responses.
- Continue supporting polling before outbound event notifications are available.

### U-7. Named coverage metrics

**Covers:** FR-9.1–9.2; proposed promotion from P1 into the first release.

Coverage is necessary to verify release/replacement behavior, so deliver the basic counts with assignment operations rather than postponing them entirely.

- Define eligible papers as papers open for review in their current cycle, with no current decision and no released/closed current review cycle. Exclude drafts and withdrawn papers.
- Expose per-paper active reviewer count, submitted-review count and overdue-assignment count.
- Expose zero-active, one-active and two-or-more-active paper counts. These bands must be mutually exclusive and sum to the eligible paper count.
- Define overdue-only as at least one active assignment, no submitted review, and every active assignment unfinished and overdue. Keep inconsistent assignment records separately flagged.
- Define operationally uncovered as zero-active plus overdue-only. This does not automatically release an overdue reviewer.
- Keep minimum-submitted-review shortfall separate from assignment coverage. Do not change an existing `underCoveredPapers` field to a different denominator silently.
- Return an observation timestamp and document the definitions used.

### U-8. Security, compatibility and operational acceptance

**Covers:** FR-10; NFR-1–3, NFR-5–11 as applicable to the first-release features.

- Reuse existing scoped credentials and problem-style errors; add only the permissions needed by the new operations.
- Sanitize auth/invitation query strings, request/error logs, tracing and metrics. Disable third-party tracking on action pages and prevent secret-bearing referrer leakage.
- Protect new action secrets at rest and in transit. If authorized link re-download is supported, use explicitly protected recoverable storage rather than pretending a hash alone can reconstruct the URL. Keep raw links out of generic idempotency/audit records.
- Preserve existing mailed links during migration unless they expire normally or an organizer explicitly reissues/revokes them.
- Record auditable actions with IDs, versions and safe metadata; protect sensitive reasons with separate access controls.
- Document invite/response export and deletion requests, secret-bearing result retention, and the distinction between deleting personal response data and retaining necessary conference audit history.
- Add migration, compatibility, concurrency and performance verification before rollout.

## 4. Defer until the core release is stable

### D-1. Outbound lifecycle webhooks

**Original scope:** FR-7.1–7.4; NFR-4.

Implement later with a transactional outbox, event IDs, signed payloads, replay protection, bounded retries/backoff, subscription permissions, delivery history and a replay mechanism. Validate allowed destination URLs and protect signing secrets. Payloads contain resource IDs and event types, never live invite links or decline reasons.

Polling remains the first-release integration mechanism. Do not claim the under-15-minute operational target is achieved until consumer polling cadence, job processing and assignment attempts are measured together.

### D-2. Configurable automatic reminder milestones

**Original scope:** FR-8.1–8.4.

Add invite-expiry-minus-three-days, review-due-minus-two-days and review-due-day reminders after the current worker and manual digest paths are reconciled. Use per-conference switches, milestone-specific dedupe and deadline-version handling. Store timestamps in UTC; evaluate calendar-day milestones in the configured conference timezone, using Asia/Kolkata for this conference.

Use the conference-specific sign-off “Organising Committee, ICAMCDS 2026”. Do not hardcode it globally for every conference. Reuse product-neutral templates. Keep existing reminders operational until their replacement is explicitly enabled and verified; do not enable both automatic paths for the same milestone.

### D-3. Same-institution matching

**Original scope:** FR-6.2.

First add normalized institution data and explainable warnings. An initial institution rule should warn and allow authorized organizers to proceed, recording the warning/acknowledgment. Any later default hard block requires reliable institution identities and an explicit audited override policy.

Institutional email domains may support a match; common personal email domains are not institutions. Existing paper-author and declared-conflict blocks remain mandatory and cannot be overridden by this warning path.

### D-4. Open/visit telemetry

**Original scope:** the sent/opened portions of FR-3.1–3.2 and AC-3.

Link generation provides the first-release Sent acknowledgement, as explicitly requested by the user. Separate confirmed mailbox-delivery acknowledgement is deferred. Passive email-open tracking is not required. If link visits are added later, label them as visits, record their source, and distinguish automated scanners from confirmed human actions where possible. A visit never accepts or declines an invitation and does not establish email delivery or reviewer consent.

### D-5. Expanded assignment actions and acceptance convenience

Defer shortening deadlines, reopening submitted/historical assignments, and reactivating a previously retired reviewer in the same cycle. They need separate rules for existing drafts, unique constraints, reminder rescheduling and audit history.

A smoother no-manual-login acceptance experience is feasible later, using identity-bound passwordless verification. It must not grant reviewer membership to an anonymous caller or treat an old shareable invitation token as an authentication credential without an explicit security design.

## 5. Keep out of this update

The following should not be implemented as part of this proposal:

1. **Anonymous acceptance that grants reviewer access without invited-email identity verification.** Public decline is allowed; reviewer account access remains identity-bound.
2. **A mandatory post-acceptance questionnaire.** Do not require research fields, capacity, conflict declarations, researcher IDs or similar forms to accept. Collect the proposed invitation metadata from organizers instead.
3. **Automatic removal or replacement of overdue reviewers.** Overdue is a signal; release/replacement remains an explicit authorized action.
4. **Physical deletion of assignments/reviews as routine release.** Preserve drafts, submissions and history.
5. **Reopening decided papers, altering published decisions, or changing review visibility as a side effect of assignment management.** Decision workflows remain outside scope.
6. **Replacing the conference mailbox as the default invitation sender.** Platform-sent initial bulk invitations require a separately enabled feature, not an implicit default change.
7. **Breaking legacy API payloads, replacing existing status values in place, or silently redefining existing coverage fields.** Add fields/operations or version the contract.
8. **Automatic reinvitation of declined/revoked people, or retroactive removal of existing reviewer memberships because of the new author-skip policy.** Any reinvitation is deliberate and audited.
9. **Raw invitation links, credentials or personal decline reasons in general logs, metrics labels, outbound event payloads or automated assistant prompts.** Secure operational delivery/download is a separate controlled channel.
10. **Open tracking as evidence of acceptance, consent, or reliable human engagement.** Do not invent past open/sent timestamps.
11. **Reviewer payments/honoraria, mobile applications, a second assignment engine, or a replacement review/decision system.** These remain outside the requested operational upgrade.
12. **An unmeasured performance or delivery-date guarantee.** A 1,000-row input cap and a polling endpoint do not alone establish throughput or the under-15-minute operational target.

## 6. Release gates

The first release is ready only when the following are demonstrated:

- Existing paper/author/reviewer/assignment/invitation integrations and currently valid mailed links still work under the agreed compatibility policy.
- A mixed 1,000-row batch returns a result for every original row, tolerates invalid rows, handles duplicates, survives retries/restarts and exposes bounded progress/results.
- Extension preserves current action links; explicit reissue invalidates both old action links; expiry/revocation rejects both actions.
- Concurrent accept/decline/revoke requests produce one coherent invitation state and correct membership effects.
- Decline confirmation needs no login, permits an empty reason, leaves state unchanged on Go back, and shows a clear terminal-state/thank-you page.
- Integration release/replacement/extension requires the correct scope and reason, preserves history, respects current-cycle restrictions and is retry-safe.
- Released assignments cannot receive new review submissions or reminders; coverage changes immediately and decided papers remain excluded.
- Cross-conference requests are denied; tokens/reasons do not appear in logs, traces or assistant-facing summaries.
- Existing author/conflict checks remain effective in every new assignment path.
- Database migrations, backward-compatible responses, rollback behavior and realistic conference-scale response times have been verified.

## 7. Proposed delivery order

1. Agree the acceptance identity boundary, lifecycle compatibility, dedupe/reinvite rules and coverage definitions.
2. Repair the accept/decline race and introduce durable lifecycle/history fields with safe migrations.
3. Add explicit release and expose the existing replacement/extension services through integration permissions; ship their basic coverage counts.
4. Add purpose-bound decline links, public confirmation/state pages, expiry extension/reissue and privacy protections.
5. Add structured bulk jobs, per-row outcomes, metadata and protected results, then validate the full release gates.
6. Follow with outbound webhooks, configurable reminders, institution matching and optional acceptance/visit improvements as separate releases.

This approved scope incorporates the user’s Sent-on-generation override. See [implementation and rollout notes](reviewer-platform-v31-implementation.md) for the shipped code, verification evidence and remaining deployment steps. The original specification remains unchanged.
