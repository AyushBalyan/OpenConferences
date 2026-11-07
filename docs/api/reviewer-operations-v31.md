# Reviewer operations API v3.1

Additive operations under `/api/v1/integrations/v1/conferences/:conferenceId/reviewer-operations`. Existing `/reviewer-invitations` email-array operations retain their 25-address contract. All operations require a scoped bearer key and return `Cache-Control: no-store`; errors use the existing problem envelope. Capabilities advertises the new base path and limits. The generated Bot OpenAPI 1.3.0 includes these operations and their response schemas.

## Permissions and limits

Invitation reads require `invitations:read`, `reviewers:read`, `reviewers:identity:read`, `reviewers:contacts:read`. Writes additionally require `invitations:write` and an active organizer/org-admin authorizer. Private decline reasons additionally require the newly granted **and newly issued** `invitations:responses:read` scope. Existing keys gain no permission automatically. Private-response permission is revalidated against the current grant and issued key inside each read transaction.

Assignment actions require `assignments:write`, `assignments:read`, `papers:read`, `reviewers:read`. Coverage requires `analytics:read`, `assignments:read`, `papers:read`, `reviewers:read`.

The shared limits remain 60 requests/key/minute, 300/conference/minute, 2 concurrent/key and 10/conference. Additional per-key batch limits are 5 submissions/minute, 60 progress reads/minute and 20 result reads/minute; these share the global allowance. Limit responses include `Retry-After: 60`. Submit up to 1,000 rows, download at most 100 results/page, and extend at most 100 invitations per extension request. JSON bodies are limited to 2 MB; the structured batch path has a separate bounded complexity budget. Poll sensibly (for example every 5–15 seconds while a job is active).

## Structured personal invitations

`POST /invitation-batches` returns **202** with `{id,status,total,replayed}`. Example with synthetic data:

```json
{
  "requestId": "10000000-0000-4000-8000-000000000001",
  "lifetimeDays": 7,
  "rows": [
    {
      "rowId": "source-row-1",
      "name": "Synthetic Researcher",
      "email": "researcher@example.test",
      "affiliation": "Example Institute",
      "researchFields": ["computing"],
      "externalReference": "external-001"
    }
  ]
}
```

`lifetimeDays` is optional (conference default, initially 7; range 1–30). Name, email, affiliation and researchFields are validated per row. Empty affiliation/fields are allowed. Email and field identifiers are normalized. The supplied row remains available in the protected result window. Row number is always stable; supplied `rowId` is retained up to 200 characters. Invalid identifiers, NUL characters and malformed Unicode produce an INVALID row outcome without discarding valid peers.

`GET /invitation-batches/:id` returns progress: status, total, processed, createdAt and resultsExpireAt. Status is QUEUED, RUNNING, COMPLETED, CANCELLED or FAILED. Chunks commit at most 25 rows. A worker retry resumes from the committed processed count. Revoked/expired credentials, lost authority or expired job retention cancel further processing. Existing committed invitations remain intact.

`GET /invitation-batches/:id/results?offset=0&limit=25` returns a result for every processed input row, with stable row/rowId, outcome, safe message and invitationId when available. Outcomes: CREATED, EXISTING, SKIPPED_REVIEWER, SKIPPED_AUTHOR, DUPLICATE_IN_BATCH, CLOSED_INVITATION, INVALID. Invalid rows do not reject valid peers. Duplicates retain separate result rows.

CREATED results include current accept/decline URLs only while their original token generation is still active and the seven-day protected result window remains open. Reissue, revocation, expiry and terminal responses suppress consumed URLs. Results never redisplay a newer token generation from an old batch. After retention, non-secret outcomes remain and input/links disappear. Result availability is distinct from completion (`nextOffset` can be null while a running job has more input to process).

The new structured path skips existing conference reviewers and authors of any retained conference paper. Declined/revoked invitations require deliberate REINVITE; accepted people are not reissued. The legacy email-array generator retains its historical creation/deduplication policy for compatibility; use the structured path for author-skip and closed-history guarantees. Initial structured sending is disabled. Use the generated URLs in the conference mailbox.

## Invitation lifecycle

`GET /invitations` supports `limit`, UUID `cursor`, `lifecycle`, `email` substring, normalized `field`, and ISO `updatedSince`. It returns `data`, counts across the email/field/time-filtered set, nextCursor and observedAt. Lifecycle counts are PENDING, SENT, ACCEPTED, DECLINED, EXPIRED, REVOKED. Internal account IDs, action secrets and private reasons are excluded by default.

Generating a link records **Sent**, with audit/change action `SENT_LINK_GENERATED`. This is the user-approved delivery acknowledgement. Legacy status remains PENDING until a traditional transition; Sent is additive `lifecycleStatus`. It does not assert confirmed email delivery. Existing unknown historical timestamps remain null.

`GET /invitation-changes?cursor=0&limit=25` returns a stable decimal sequence cursor, invitationId, action, version and recordedAt. Persist `nextCursor` after processing the whole page; follow while hasMore is true. Sequence allocation is serialized per conference until commit. The worker records expiry without requiring a click. Poll the sequence feed for reconciliation; updatedSince alone is not a durable change feed.

`POST /invitations/:id/actions` returns **200**. Body:

```json
{
  "requestId": "10000000-0000-4000-8000-000000000002",
  "version": 0,
  "action": "EXTEND",
  "lifetimeDays": 14
}
```

- EXTEND: active invitations only; moves expiry to the selected number of days **from now**, later than the current expiry. Keeps both links and does not send mail.
- REISSUE: pending/expired only; rotates both secrets, marks Sent, resets expiry using lifetimeDays or the conference default, and invalidates both old links.
- REVOKE: preserves the record/history and invalidates both actions. Legacy lists may hide it; operations lists retain it.
- REINVITE: declined/revoked only; creates a new identity and preserves the previous response. Rejects another active invitation or an existing reviewer membership.

Version conflicts return 409. Retrying the same integration requestId/payload is safe; reusing it for different input returns 409. Replays return current safe state and URLs only if currently active. Session organizer actions use version checks; refresh after an ambiguous network response.

`POST /invitation-extensions` accepts `{operations:[{invitationId,requestId,version,action:"EXTEND",lifetimeDays}]}` (1–100). Each row commits independently with its access audit and returns success/state or its failure; reuse row requestIds on retry. After 30 seconds the request starts no further rows and reports remaining rows as retryable 503 failures.

`PATCH /invitation-settings` accepts `{lifetimeDays:7}`. Session settings also support `invitationLifetimeDays`; the organizer invitation panel can save the conference default. Changing the default does not modify existing invitations.

## Link behavior and public decline

Accept URLs use the **existing Generate Link format**: `/sign-in?reviewerInvite=<invitation-secret>`. They contain no embedded email and require sign-in with the invited email/account. They are not authentication magic credentials. Platform-email sending separately uses the existing identity-bound passwordless flow; authentication credential expiry and invitation expiry are independent. Extending an invitation does not extend an old login credential.

Decline URLs use `/reviewer-invite/decline#token=<purpose-bound-secret>`. The fragment does not reach the page server. The page posts the token in JSON to `/api/v1/reviewer-invitations/public/status` and `/decline` (both return 200). Lookup is read-only; confirmation changes state. A reason is optional (maximum 1,000 characters). Go back makes no mutation. Confirmation works without login and with another account signed in; it grants no account access. Accepted, declined, expired, revoked and invalid links return calm state messages.

Public limits are 30 requests/IP/minute and 10/token/minute. Behind an ingress, configure `API_TRUSTED_PROXY_CIDRS` with only the trusted proxy ranges; the default does not trust forwarded addresses. Origins, when present, must match configured WEB_URL. Responses are no-store/no-referrer, tracking is excluded, and token values are absent from limiter keys/logs. Restrict proxy access logs to paths without query strings; old acceptance/auth URLs necessarily retain their compatible query format.

## Assignment actions and coverage

`POST /assignments/:id/actions` accepts `{requestId,version,action,reason,reviewerId?,dueAt?}`. RELEASE, REPLACE and EXTEND require a nonempty reason. REPLACE uses an **integration-specific opaque reviewerId**, not a user ID. Due dates are ISO timestamps; extension must be future and later than the current effective deadline.

Only unfinished active assignments in the current open cycle can change. Release preserves the assignment and draft, sets releasedAt/releaseReason, and uses legacy retirement status REPLACED. It leaves active workload, submission eligibility, reminder eligibility and coverage immediately. REPLACE is atomic and preserves conflicts/bids checks. A retired same-reviewer assignment cannot silently be recreated in the same cycle. Legacy organizer removal delegates to release, retaining its response contract and recording a compatibility reason.

`GET /coverage?limit=25&cursor=<paper-uuid>` returns a consistent observedAt and definitionVersion `1`:

- Eligible: SUBMITTED/UNDER_REVIEW papers with no decision/released current cycle.
- Active: assignments excluding DECLINED/REPLACED; submitted reviews counted from submittedAt.
- Zero-active, one-active and two-or-more-active partition the eligible set.
- Overdue-only: at least one active assignment, no submitted review, all active assignments unfinished and overdue.
- Operationally uncovered: zero-active + overdue-only. Inconsistent COMPLETED-without-submission records are flagged separately.

Existing underCoveredPapers semantics remain unchanged. Overdue is a signal; no automatic release occurs.
