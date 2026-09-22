# Reviewer System Audit — Technical Report

**Audience:** an engineer or coding model that will implement the fixes. Assumes no prior context on
this audit but does assume familiarity with the repository layout.

**Date:** 2026-09-20
**Method:** live black-box walkthrough in a Chrome instance driven over CDP, against the dev web
(`:3000`) and API (`:3001`) processes connected to the production Supabase database, plus static
reading of the API, web, worker and schema packages.
**Tenant under test:** `Test_Conference`, slug `test-conf`, id `019fb1a0-f4cf-7510-9ab0-c6ece0308186`.
**Out of scope and untouched:** the ICAMCDS-2026 tenant.
**Backup:** `pg_dump -Fc` taken pre-test to `~/openconferences-backups/oc-20260920-221230.dump`.

---

## 1. System model as implemented

### 1.1 Roles

Defined in `apps/api/src/tenancy/role-hierarchy.ts` and the Prisma `MembershipRole` enum:

```
ORG_ADMIN > ORGANIZER > CHAIR > REVIEWER > AUTHOR > ATTENDEE
```

`ORG_ADMIN`, `ORGANIZER` and `CHAIR` require MFA. Review coordination endpoints are gated by
`@RequireReviewCoordination()` (`apps/api/src/common/decorators/require-review-coordination.decorator.ts`),
which resolves to `ORG_ADMIN | ORGANIZER | CHAIR`. There is **no** `AREA_CHAIR` or `META_REVIEWER`
role in the enum.

### 1.2 Entities

From `packages/db/prisma/schema.prisma`:

| Model                | Purpose                    | Notable fields                                                                                      |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `ReviewRound`        | Round container            | `number`, `phase`, `reviewDueAt`, `rebuttalDueAt`                                                   |
| `ReviewAssignment`   | Reviewer ↔ submission link | `status`, `roundId`, `reviewerId`, `submissionId`                                                   |
| `Review`             | The review itself          | `status`, `version`, `scores` (Json), `commentsToAuthors`, `confidentialComments`, `recommendation` |
| `ReviewBid`          | Reviewer preference        | `preference` enum, `roundId`                                                                        |
| `ConflictOfInterest` | COI record                 | `submissionId`, `userId`, `reason`, `source`                                                        |
| `Rebuttal`           | Author response            | `submissionId`, `roundId`, `body`                                                                   |
| `Decision`           | Final outcome              | `submissionId`, `outcome`, `notifiedAt`                                                             |

Absent: any `Discussion`/`ReviewComment` model, any `ReviewForm`/`ReviewCriterion` model, any
`MetaReview` model, any attachment relation on `Review`.

### 1.3 Round phase machine

`ReviewRoundPhase` = `OPEN → BIDDING → ASSIGNMENT → REVIEWING → REBUTTAL → DECISION → CLOSED`.

Phase transitions are chair-driven via `PATCH /conferences/:id/review-rounds/:roundId/phase`. The UI
only ever offers the single next phase; there is no way to skip `REBUTTAL` on the path from
`REVIEWING` to `DECISION`, and the button for that transition is labelled "Release reviews", which
also triggers author-visible notifications.

### 1.4 Write-gating rule (source of the P0 bug)

In `apps/api/src/review/reviews.service.ts`, the guard on review mutation is effectively:

- `status = DRAFT` may be written only when `round.phase === REVIEWING`
- `status = SUBMITTED` may be written only when `round.phase === REBUTTAL`
- anything else → `ConflictException('Reviews cannot be edited in the current round phase')` → HTTP **409**

Optimistic concurrency uses `Review.version`; a stale version also throws **409**, with a message
matching `/modified by another request|modified elsewhere/`.

**Both distinct failure modes share status code 409.** This collision is the root cause of §2.1.

---

## 2. Defects

Severity: **P0** data loss / correctness · **P1** blocks a normal workflow · **P2** friction ·
**P3** cosmetic.

### 2.1 [P0] Silent data loss in the review editor autosave

**File:** `apps/web/src/components/dashboard/reviews/review-editor/review-editor-panel.tsx`

**Reproduction A** — round in `OPEN` phase, reviewer opens assignment, types into
`commentsToAuthors`. Status indicator shows `Saving…` indefinitely. Network shows repeated
`PATCH .../reviews/:id` → `409 {"message":"Reviews cannot be edited in the current round phase"}`.
Reload → all text lost.

**Reproduction B** — review already `SUBMITTED`, round in `REVIEWING`. Reviewer changes
`scores.originality` 3 → 5. Local state renders 5. Same 409 loop. Reload → 3. **Worse than A because
the UI displays a value that was never persisted.**

**Mechanism.** The panel classifies 409s with:

```ts
function isVersionConflict(err: unknown): boolean {
  if (!(err instanceof Error) || (err as Error & { status?: number }).status !== 409) {
    return false;
  }
  return /modified by another request|modified elsewhere/i.test(err.message);
}
```

The round-phase message does not match the regex, so the error escapes the `conflict` branch and
lands in generic handling. Generic handling calls `setError(message)` — but the debounced autosave is
still scheduled, and `flushSaves()` opens with:

```ts
setError(null);
setSaveStateSafe('saving');
```

which clears the message and returns the indicator to `Saving…` before the user can read it. This is
exactly the "error flashed and disappeared" behaviour the user reported. The dirty buffer is never
cleared, so the loop repeats indefinitely and nothing is ever persisted.

**Fix, three parts:**

1. **Distinguish the two 409s at the source.** Do not regex on message text. Give the API a stable
   discriminator — either a distinct status (`422` for phase-gating, keeping `409` for version
   conflicts) or an error code field on the body, e.g.
   `{ code: 'REVIEW_PHASE_LOCKED' | 'REVIEW_VERSION_CONFLICT' }`. Propagate it through the API client
   so the panel switches on `code`, not prose.

2. **Add a terminal `locked` save state.** On `REVIEW_PHASE_LOCKED`: cancel pending debounce timers,
   set `saveState = 'locked'`, set a sticky error, and `disabled` every field. `flushSaves()` must
   early-return while `saveState === 'locked'` so it can never clear the message. Do not retry —
   this is not a transient failure.

3. **Prevent entry into the state.** The assignment detail endpoint should return an explicit
   `canEdit: boolean` plus a reason and the phase that will unlock editing. Render the form read-only
   with an explanatory banner when `canEdit === false`, instead of letting the reviewer type first and
   fail after.

Additionally add a `beforeunload` guard while `saveState !== 'saved'` and dirty.

**Regression tests to add:**

- API: assert mutation in each non-permitted phase returns the phase-locked discriminator, distinct
  from the stale-version discriminator.
- Web: mock a phase-locked rejection, assert the error persists across ≥2 debounce intervals and
  fields become disabled.

### 2.2 [P1] MFA challenge does not redirect on success

`POST /auth/mfa/challenge` returns 200 and a valid session cookie, but the challenge page does not
navigate; the form remains interactive with no success state. I had to hand-navigate to
`/me/dashboard`. Affects every MFA-required role, i.e. all chairs and organizers, on every login.
Look at the challenge page's post-success handler — the `router.push`/`router.refresh` is either
missing, not awaited, or being swallowed.

### 2.3 [P1] `rememberMe` and `trustDevice` checkboxes are inert

Both render permanently checked and are not togglable — the DOM node carries `readonly`, which on a
checkbox does nothing visually but the handler clearly isn't wired. Empirically, checking
"Trust this device" did not suppress the MFA challenge on the next sign-in. Either implement trusted
device tokens end-to-end or remove the controls; shipping a security control that lies about its
state is worse than not having it.

### 2.4 [P1] No chair-facing review progress or review-reading surface

`/dashboard/conferences/:id/reviews/assignments` renders columns `Paper | Reviewer | Email | Bid`
only. There is no review status, submitted-at, due-at, or score column, and no per-paper aggregate.
There is no route anywhere that renders the full set of reviews for a submission including
`confidentialComments`. The decisions page collects an outcome without displaying the evidence.

Needed: (a) add review status/score/due columns and a status filter to the assignments table;
(b) add a per-submission review panel for `@RequireReviewCoordination()` roles that shows every
review, both comment fields, recommendation and scores, with an aggregate row.

### 2.5 [P1] No reviewer decline path

`ReviewAssignmentStatus` includes a declined state, but no controller exposes a reviewer-initiated
transition and no UI element triggers one. Add `POST .../assignments/:id/decline` with an optional
reason, restricted to the assignee, blocked once a review exists in non-draft state, and emitting a
chair notification.

### 2.6 [P2] Deadlines are advisory only

`reviewDueAt` is stored on the round, displayed, and templated into emails, but `reviews.service.ts`
performs no comparison against it on submit. Late submissions are accepted silently. Separately, in
`apps/worker/src/reminder-sweep.ts` the reminder query selects assignments whose due date falls in a
forward window (~72h) and excludes already-overdue rows, so reminders stop precisely when they become
useful. Add an overdue sweep, and record lateness on the review even if you choose to keep accepting
it.

### 2.7 [P2] No per-assignment due date

Due dates exist only at round granularity; the assignment create/edit form has no date field. A chair
cannot extend one reviewer. Requires a nullable `dueAt` on `ReviewAssignment` with round-level
fallback at read time — this is a schema addition and per the architecture rules must be approved
before implementation.

### 2.8 [P2] Blinding leak via original PDF filename

`review.mapper.ts` correctly strips authorship via `shouldShowAuthorsToReviewer` / `blindAuthorships`
according to the configured blinding mode. The download path does not participate: the object is
served under its original upload filename, which commonly embeds author surnames. Serve blinded
downloads as `submission-<displayId>.pdf` when the requester is a reviewer under a blinded mode, and
ensure `Content-Disposition` carries the synthesized name.

### 2.9 [P2] COI detection is structurally weak

`coi-check.service.ts` matches only on `userId` equality between the reviewer and a linked
authorship. An author who has no platform account, or whose authorship row isn't linked to a user, is
invisible to the check. There is no email-domain or affiliation heuristic, no co-authorship history
check. Self-declaration through the bidding page is the only real safety net. At minimum add
normalized-email matching against authorship contact emails, and surface a chair-visible warning
rather than a hard block for weaker signals.

### 2.10 [P2] Failed notifications are invisible

The notification table contains at least one row in a `FAILED` state for a review-release email. No
UI anywhere surfaces delivery failures, and there is no retry affordance. Add a delivery panel for
organizers listing failed/pending sends with a manual resend.

### 2.11 [P2] Generic error surfacing

403s render as generic copy — e.g. creating a submission without an `AUTHOR` membership yields
"Failed to create submission" with no indication of the missing role. The API's message is discarded
somewhere in `apps/web/src/lib/api-client.ts` or its callers. Propagate the server message and reason
code into the toast/inline error.

### 2.12 [P2] No success feedback on mutations

Role grant at `/members/grant` succeeded server-side but produced no toast, no inline confirmation,
and did not reset the form. Several other mutation forms behave the same way. Standardize on a
success toast plus form reset or optimistic list update.

### 2.13 [P2] Reviewer context in the review form is minimal

The review page heading is the assignment UUID. The only submission metadata rendered is the title —
no abstract, keywords, track, or page count, and notably **no due date**, despite the dashboard card
showing one. Add a metadata header and a persistent due-date chip.

### 2.14 [P2] No in-app PDF viewer

Download-only. Reviewers must context-switch between the paper and the form. A split-pane with an
embedded viewer alongside the form is the single highest-value reviewer UX change and requires no
schema work.

### 2.15 [P2] Bidding screen is under-informative

Renders title plus a truncated abstract line. No keywords, no PDF access, no search, sort, filter, or
bulk actions, and no indication of how many bids are expected. Bid quality will be poor at any real
paper count.

### 2.16 [P3] Status inconsistencies

"My reviews" summary tiles reported `In progress: 1` while the corresponding row read `Not started`;
the dashboard CTA read "Continue review" for a never-started review. The tiles and the row derive
status from different expressions — unify on a single derivation, ideally server-side.

### 2.17 [P3] Empty vs loading states conflated

Submissions and organizers lists render an empty-looking body during fetch, indistinguishable from a
genuinely empty result. Add skeletons and distinct empty copy.

### 2.18 [P3] Member lists expose UUIDs, not identity

Reviewer/organizer tables show a name next to a raw UUID, with no email or affiliation, and the role
grant form requires pasting that UUID. Replace with an email/name typeahead resolving to the user id
internally.

---

## 3. Unimplemented capabilities

Not defects — never built. Listed with implementation weight.

| Capability                              | Current state                                                                                                                                                                     | Weight                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Automatic/assisted assignment from bids | Bids collected and displayed; `assignments.service.ts` supports manual create and copy-from-previous-round only                                                                   | High — matching algorithm + load balancing + COI exclusion |
| Reviewer discussion threads             | No model, no endpoints                                                                                                                                                            | High — new entity, needs architecture approval             |
| Meta-reviews / area chairs              | No role, no model                                                                                                                                                                 | High — role hierarchy change                               |
| Configurable review form                | Three score dimensions hardcoded in `review-editor-panel.tsx`; `reviewConfigSchema` in `packages/schemas/src/tenancy.ts` has a field for criteria that nothing reads; no admin UI | Medium — render from config, add editor                    |
| Review attachments                      | No relation on `Review`                                                                                                                                                           | Medium — reuse existing storage plumbing                   |
| Reviewer expertise / keyword profiles   | Not modelled                                                                                                                                                                      | Medium — prerequisite for good auto-assignment             |
| Score normalization / calibration       | Not present                                                                                                                                                                       | Low priority for current scale                             |

---

## 4. Recommended sequencing

**Before any live conference:**

1. §2.1 — phase-locked save handling. Discriminated error code, terminal locked state, server-driven
   `canEdit`.
2. §2.2 — MFA redirect.
3. §2.4 — chair review-progress table and review-reading panel.
4. §2.5 — decline endpoint and button.
5. §2.14 — embedded PDF viewer beside the form.

**Next:** §2.13 due date in form · §2.6 deadline enforcement + overdue reminders · §2.3 fix or remove
the trust/remember controls · §2.11/§2.12 error and success feedback · §2.10 failed-notification
visibility · §2.8 filename blinding.

**Then, with architecture approval, since they add entities:** §2.7 per-assignment due dates ·
configurable review forms · reviewer discussion · meta-reviews.

---

## 5. Verification notes

- 409 responses were confirmed in the network log, with the body message
  `"Reviews cannot be edited in the current round phase"`, during both reproduction A and B.
- Data loss was confirmed by hard reload, not inferred from the indicator.
- PDF download was confirmed working by the user.
- The `FAILED` notification row was observed in the existing data, not produced by this test.
- `rememberMe` / `trustDevice` inertness was confirmed both by DOM inspection and by observing the
  MFA challenge reappear on a subsequent sign-in.

## 6. Test-environment mutations to revert

Confined to `Test_Conference`:

- `AUTHOR` membership granted to the admin account — unnecessary in hindsight, revert.
- Round 2 opened and advanced to `REVIEWING` — close or reset as desired.
- "Test Submission 2" assigned to the reviewer account; one review submitted against it.
- One real email delivered to `hacklock.holmes@gmail.com`.

"Release reviews" and "Notify authors" were deliberately not exercised, as both dispatch mail to
submission authors.
