# OpenConferences Bot API — endpoint reference

Contract version: **1.2.0**. Updated: **20 October 2026**.

This document describes every endpoint accessible with a conference-scoped bot API key. It includes paper/author reads, reviewer status and workload, assignment reads and writes, conference summaries, and reviewer invitation links. Examples use synthetic IDs and addresses.

## Connection and authentication

Replace `YOUR_API_HOST` and `CONFERENCE_ID` with your deployment's API host and conference UUID. The complete base URL is:

```text
https://YOUR_API_HOST/api/v1/integrations/v1/conferences/CONFERENCE_ID
```

Every endpoint below is relative to this base. The `/api/v1/integrations/v1` prefix is intentional; do not omit either version segment.

Send the key in the authorization header on every request:

```http
Authorization: Bearer YOUR_BOT_API_KEY
Accept: application/json
Content-Type: application/json
```

`Content-Type` is needed when sending a JSON body. Never put keys in query parameters, public prompts, or browser code. Store them privately on the bot/adapter server. A key belongs to one conference and expires after its configured lifetime, at most 90 days.

The deployment must have the bot API enabled and its migrations applied. A human creates the integration and issues its key in **Settings → Integrations**. Human credential-management endpoints use user authentication and are not bot endpoints.

Start with `GET /capabilities` and inspect the effective `scopes`. Permissions must be present on both the integration grant and the issued key. Adding a scope to a grant does not upgrade an existing key; issue a new appropriately scoped key.

## Permission scopes

- `papers:read`: paper metadata.
- `authors:read`: author names and affiliations; also requires `papers:read`.
- `authors:contacts:read`: author emails; also requires `authors:read` and `papers:read`.
- `reviewers:read`: reviewer aliases, membership status, invitation status, and workload.
- `reviewers:identity:read`: reviewer names; also requires `reviewers:read`.
- `reviewers:contacts:read`: reviewer/invitee emails and email searches; also requires `reviewers:identity:read` and `reviewers:read`.
- `assignments:read`: assignments and progress; also requires `papers:read` and `reviewers:read`.
- `assignments:write`: assign papers with individual deadlines; also requires `assignments:read`, `papers:read`, and `reviewers:read`.
- `invitations:read`: retrieve pending invitation links; also requires all three reviewer scopes.
- `invitations:write`: generate/remove invitations; also requires `invitations:read` and all three reviewer scopes.
- `analytics:read`: conference summary.

The dashboard selects dependency scopes together. Invitation permissions additionally require an **organizer or organization-admin authorizer with MFA**. A chair alone cannot grant, issue, or use invitation-link permissions. The human authorizer must retain the required role, MFA, and active account.

For all reviewer invitation, reviewer lookup, paper lookup, and assignment operations, the combined scope set is:

```json
[
  "papers:read",
  "reviewers:read",
  "reviewers:identity:read",
  "reviewers:contacts:read",
  "assignments:read",
  "assignments:write",
  "invitations:read",
  "invitations:write"
]
```

Grant author and analytics scopes separately if those endpoints are needed.

## IDs, timestamps, pagination, and filters

Resource path parameters and mutation `requestId` values are UUIDs. Use paper `id` values for assignment requests; a submission code such as `ICAMCDS2026-ABCD` is a display/search value, not a paper UUID.

Reviewer `id`/`reviewerId` values are opaque references specific to an integration. Obtain them from reviewer or accepted-invitation reads. They are not user account IDs or invitation IDs. Do not reuse them with another integration.

Timestamps returned by the API use UTC. Assignment `dueAt` input must be a future ISO timestamp with `Z` or an explicit offset.

List endpoints accept `limit` (1–100, default 25) and `cursor`. A typical list envelope is:

```json
{
  "data": [],
  "nextCursor": null,
  "meta": {
    "observedAt": "2026-10-20T12:00:00.000Z",
    "history": "CURRENT",
    "filters": {
      "limit": 25,
      "history": "CURRENT",
      "includeWithdrawn": false
    },
    "returnedCount": 0
  }
}
```

Pass the returned `nextCursor` as `cursor` to fetch another page; stop when it is null. URL-encode cursor and search values. Keep the integration, filters, and scopes unchanged between pages. Each page is its own consistent snapshot; concurrent changes may be visible on later pages.

Normal detail reads return `{ "data": OBJECT, "meta": OBJECT }`. Capabilities and invitation-link reads return their objects directly. Mutation response shapes are documented separately below.

Only send supported filters. Unknown fields and unsupported non-default filters return `400`; identity/contact searches without permission return `403`. Optional names/emails are omitted without the necessary scopes, rather than returned as empty strings.

Shared filter values:

- `history`: `CURRENT` (default), `ALL`, or `HISTORICAL`. Applies to reviewer workload and assignments. Current history excludes withdrawn papers; historical/all reads can include their retired assignments. Draft papers remain excluded.
- Paper `status`: `SUBMITTED`, `UNDER_REVIEW`, `DECISION_MADE`, `CAMERA_READY`, `WITHDRAWN`, or `WITHDRAWN_NONPAYMENT`.
- `attention`: `OVERDUE`, `REMAINING`, `UNASSIGNED`, or `COMPLETE`.
- Assignment `progress`: `NOT_STARTED`, `DRAFT`, `SUBMITTED`, `CLOSED`, `RETIRED`, or `INCONSISTENT`.
- `invitationStatus`: `PENDING`, `ACCEPTED`, `DECLINED`, or `EXPIRED`.
- Boolean query values: `true` or `false`.

## Accessible endpoints

### GET /capabilities

Required scope: no additional scope beyond a valid key. No query parameters.

Returns `apiVersion`, conference `id`/`name`/`timezone`, effective `scopes`, key `expiresAt`, request/page `limits`, and `observedAt`. The URL API version remains `1`; the documentation contract version is `1.2.0`.

### GET /papers

Required scope: `papers:read`.

Filters: `trackId`, `status`, `includeWithdrawn`, `q`, plus pagination. `q` searches title or submission code.

```http
GET /papers?q=ICAMCDS2026-ABCD&limit=25
```

Returns a list of paper records with `id`, `submissionNumber`, `title`, `abstract`, `keywords`, `track` (`id`, `name`), `status`, `submittedAt`, `createdAt`, `updatedAt`, and `currentCycle` (`id`, `number`, or null).

Drafts are never exposed. Withdrawals are excluded by default; request `includeWithdrawn=true` or an explicit withdrawal status to include them. Legacy `submittedAt` is null because a reliable submission timestamp was not stored.

### GET /papers/{paperId}

Required scope: `papers:read`.

Returns one paper in the detail envelope. Supports the same paper visibility filters as the list, including `includeWithdrawn=true` when reading a withdrawn paper. A missing, hidden, draft, or foreign paper returns `404`.

### GET /authors

Required scopes: `authors:read`, `papers:read`.

Filters: `paperId`, `trackId`, `status`, `includeWithdrawn`, `q`, `email`, plus pagination. Here `q` searches author names; `email` searches addresses and additionally requires `authors:contacts:read`.

```http
GET /authors?paperId=PAPER_UUID&limit=100
```

Returns authorship records with `id`, `paperId`, `submissionNumber`, `name`, `affiliation`, `order`, `isCorresponding`, and optionally `email`. These are paper-specific authorships, not a deduplicated directory of user accounts.

### GET /papers/{paperId}/authors

Required scopes: `authors:read`, `papers:read`.

Returns the same authorship list restricted to the path's paper. Supports `trackId`, `status`, `includeWithdrawn`, `q`, `email`, and pagination. Email access/search requires `authors:contacts:read`.

### GET /reviewers

Required scope: `reviewers:read`.

Filters: `trackId`, `paperId`, `history`, `cycleNumber`, `attention`, `q`, `email`, plus pagination. `q` searches names and requires `reviewers:identity:read`; `email` requires `reviewers:contacts:read`.

```http
GET /reviewers?email=reviewer%40example.com
GET /reviewers?attention=OVERDUE&history=CURRENT
```

Each record has `id`, `label`, `hasReviewerRole`, `status`, optional `name`/`email`, and `workload`.

`status: ACCEPTED` means the person currently has conference reviewer membership, including membership granted manually. `INACTIVE` means a historical reviewer no longer has that role. Pending invitees are listed through the invitation endpoint, not as assignable reviewers.

Workload fields: `assigned`, `submitted`, `remaining`, `notStarted`, `drafts`, `closedIncomplete`, `inconsistent`, `overdue`, `dueSoon`, and nullable `earliestDeadline`. Due soon means the next 72 hours. Submitted counts require a submitted review, not only a completed assignment flag.

### GET /reviewers/{reviewerId}

Required scope: `reviewers:read`.

Returns one reviewer and workload in the detail envelope. Use an integration-specific reviewer ID. Supports reviewer workload filters; omit name/email search and attention filters when retrieving a known ID unless intentionally filtering the result. Names and contacts remain scope-controlled.

### GET /reviewer-invitations

Required scope: `reviewers:read`.

Filters: `invitationStatus`, `email`, plus pagination. Email search requires `reviewers:contacts:read`.

```http
GET /reviewer-invitations?invitationStatus=PENDING&limit=25
GET /reviewer-invitations?email=reviewer%40example.com
```

Each record includes `id`, `status`, nullable `reviewerId`, `canAssign`, `createdAt`, and `expiresAt`; `email`/`name` are included only with the relevant reviewer contact/identity scopes.

An elapsed pending invitation is reported as `EXPIRED`. `canAssign` is true, with a non-null `reviewerId`, only when an accepted invitation belongs to a current reviewer member. This signals membership eligibility; a particular paper can still reject assignment because of conflicts, duplicates, or cycle state.

This list never includes invitation links. Use the separately scoped link endpoint below.

### GET /reviewer-invitations/{invitationId}/link

Required scopes: `invitations:read`, `reviewers:read`, `reviewers:identity:read`, `reviewers:contacts:read`. Organizer/org-admin authorizer required. No query parameters.

Returns a link record directly, without a `data` wrapper. Illustrative response:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "email": "reviewer@example.com",
  "status": "PENDING",
  "invitationUrl": "https://conference.example.com/sign-in?reviewerInvite=EXAMPLE_TOKEN",
  "expiresAt": "2026-10-27T12:00:00.000Z"
}
```

Only unexpired pending links are shareable. Accepted, declined, or expired invitations return `409`; missing, removed, or foreign IDs return `404`. Store/share actual returned URLs privately; do not construct them from this example. The recipient must authenticate as the invited email address.

### POST /reviewer-invitations

Required scopes: `invitations:write`, `invitations:read`, `reviewers:read`, `reviewers:identity:read`, `reviewers:contacts:read`. Organizer/org-admin authorizer required.

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "emails": ["reviewer@example.com", "another@example.com"]
}
```

Accepts 1–25 valid addresses per request. Addresses are trimmed, lowercased, deduplicated, and sorted. Any invalid address rejects the entire batch. An existing active pending invitation is reused without changing its expiry; otherwise a normal pending invitation with a seven-day expiry is created. All entries identify their email explicitly; do not rely on input order.

Returns `201 Created` with `data` (an array of link records), `replayed` (boolean), and `message`. **No invitation email is sent.** Fields such as `delivery` or `sendEmail` are unsupported and return `400`.

Invitations appear in the dashboard pending list. Accepting through the normal human invitation flow adds reviewer membership. For an existing registered author, it reuses their account and preserves the author role, profile, password, and submissions. This bot endpoint cannot accept an invitation on someone else's behalf.

### DELETE /reviewer-invitations/{invitationId}

Required scopes: `invitations:write`, `invitations:read`, `reviewers:read`, `reviewers:identity:read`, `reviewers:contacts:read`. Organizer/org-admin authorizer required. Send a JSON body even though the method is DELETE:

```json
{
  "requestId": "00000000-0000-4000-8000-000000000002"
}
```

Returns `200 OK`:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "removed": true,
  "replayed": false,
  "message": "Invitation removed. Its link can no longer be accepted."
}
```

Only records still stored as pending can be removed, including pending rows whose expiry has elapsed. Accepted, declined, and explicitly expired status records return `409`. Missing or foreign IDs return `404` for a new request. Successful deletion invalidates the link. No email is sent; reviewer memberships and review records are not removed.

### GET /assignments

Required scopes: `assignments:read`, `papers:read`, `reviewers:read`.

Filters: `trackId`, `paperId`, `reviewerId`, `history`, `cycleId`, `cycleNumber`, `progress`, `overdue`, plus pagination.

```http
GET /assignments?reviewerId=REVIEWER_REFERENCE_UUID&history=CURRENT
GET /assignments?paperId=PAPER_UUID&history=ALL
GET /assignments?overdue=true&limit=100
```

Each assignment includes `id`, `paperId`, `submissionNumber`, `reviewerId`, `cycleId`, `cycleNumber`, `isCurrentCycle`, `status`, `progress`, nullable `submittedAt`, `dueAt`, `deadlineSource`, `overdue`, and `retired`.

Deadline precedence is individual assignment, cycle, conference, then assignment creation plus seven days (`LEGACY`). Closed, retired, and inconsistent work is not counted as actionable overdue work.

### GET /assignments/{assignmentId}

Required scopes: `assignments:read`, `papers:read`, `reviewers:read`.

Returns one assignment in the detail envelope. Supports assignment visibility filters. Use `history=ALL` to retrieve an old-cycle or retired assignment that is outside the default current view.

### POST /assignments

Required scopes: `assignments:write`, `assignments:read`, `papers:read`, `reviewers:read`.

```json
{
  "requestId": "00000000-0000-4000-8000-000000000003",
  "paperId": "00000000-0000-4000-8000-000000000020",
  "reviewerId": "00000000-0000-4000-8000-000000000030",
  "dueAt": "2030-01-02T17:30:00+05:30"
}
```

Required fields: UUID `requestId`, UUID `paperId`, integration-specific UUID `reviewerId`, and future ISO `dueAt` with UTC/offset. Optional UUID `cycleId` must be the paper's current cycle. Replace example IDs and choose a deadline in the future when making the request.

Only accepted/current conference reviewer members and submitted/under-review papers in an open current cycle are eligible. An eligible paper without a cycle gets its first cycle atomically. Pending invitees, drafts, withdrawals, decided cycles, historical cycles, duplicates, declared conflicts, and conflict bids are rejected. Self-review is blocked using submitter ID, linked coauthor ID, and normalized author-email matching.

Returns `201 Created` with `data` (the saved assignment), `replayed`, `message`, and optional `notificationWarning`.

**A normal reviewer assignment email is queued after commit and includes this deadline.** If `notificationWarning` is present, the assignment exists but its email could not be queued. Inspect the dashboard/email log rather than attempting to create another assignment. Replaying a successful request never sends a second assignment email.

### GET /summary

Required scope: `analytics:read`.

Optional filter: `trackId`. No pagination; omit `limit` and `cursor`.

Returns a detail envelope containing `submissions` (`active`, `byStatus`, `withdrawn`), `reviews` (workload fields), `reviewersWithActiveWork`, and `underCoveredPapers`.

Active totals exclude drafts and withdrawals. The withdrawn count is reported separately. Review totals use current cycles and actual submitted reviews.

## Mutation retries and idempotency

Every POST/DELETE operation above requires a body `requestId` UUID. Generate a new UUID for a new operation; retain the original UUID and body for retries after a timeout or uncertain network result. There is no separate idempotency header.

- Successful identical retries return `replayed: true` with the original operation's result semantics.
- A request ID is shared across all mutation types for an integration and survives key rotation. Reusing it with different details or for another operation returns `409`.
- Assignment replays return the original saved assignment snapshot. They do not change the deadline or resend mail.
- Invitation generation retries with the same normalized email set reuse the original invitation IDs. Reordering or repeating addresses does not change the normalized set.
- Invitation URLs on a generation replay are live-state-aware: accepted, declined, expired, or removed entries have `invitationUrl: null`. Deleted entries have `status: REMOVED` and `expiresAt: null`.
- A replay never recreates a removed invitation or extends expiry. Use a new request ID when deliberately generating another invitation.
- Removal retries using the original request ID and invitation ID return success after deletion. A new request ID for an already removed invitation returns `404`.
- Credentials, scopes, and authorizer eligibility are checked again before replaying a result.

Business changes, the mutation audit, idempotency result, and success access record commit together. If those records cannot be written, the mutation rolls back. Assignment email queuing happens after commit and is reported separately through `notificationWarning`.

## Error handling and limits

- `400`: invalid body/query/path, unsupported field/filter, or invalid/past deadline.
- `401`: missing, invalid, expired, or revoked credential; authorizer account/MFA/eligible-role loss.
- `403`: missing operation scope, insufficient invitation authority, or unauthorized identity/contact search.
- `404`: missing, hidden, or foreign-conference/integration resource.
- `409`: assignment conflict, invalid invitation state, duplicate assignment, or request ID reused with different details.
- `429`: request/concurrency limit; honor the `Retry-After` header.
- `503`: API disabled or access controls, data access, or durable auditing unavailable.

Error responses use problem JSON with fields such as `type`, `title`, `status`, `detail`, and `instance`. Handle the HTTP status and available detail; do not infer success from a failed response.

Limits: 60 requests/key/minute, 300 requests/conference/minute, two concurrent requests/key, and ten concurrent requests/conference. Pre-authentication abuse limit: 60 requests/IP/minute. A rate-limit response includes `Retry-After: 60`.

Use bounded retries with backoff for `429`/`503` and transient transport failures. Preserve mutation request IDs. Correct `400`/`401`/`403`/`404`/`409` causes rather than repeatedly retrying an unchanged request.

Responses use `Cache-Control: no-store`. Keep keys, invitation URLs, and personal response data out of public logs and prompts.

## Typical bot workflow

1. Call `GET /capabilities` to check effective permissions.
2. Find a paper using `GET /papers?q=SUBMISSION_CODE`; keep its UUID.
3. Find a reviewer using `GET /reviewers?email=ENCODED_EMAIL`.
4. If they only have a pending invitation, read or generate its shareable link and send it manually. Wait for the person's acceptance.
5. Read reviewer/invitation status again and obtain the integration-specific reviewer reference.
6. Call `POST /assignments` with a new request UUID and an explicit future deadline.
7. Monitor `GET /assignments` and reviewer workload; paginate until `nextCursor` is null.

Example authenticated read, with the key already supplied through a private environment variable:

```sh
BOT_CONFERENCE_BASE='https://YOUR_API_HOST/api/v1/integrations/v1/conferences/CONFERENCE_ID'
curl --fail-with-body \
  -H "Authorization: Bearer $BOT_API_KEY" \
  -H 'Accept: application/json' \
  "$BOT_CONFERENCE_BASE/capabilities"
```

## API boundaries

The bot API does not expose review text, scores, private chair comments, conflict details, files/PDFs, storage keys, billing information, or user sessions. It cannot record decisions, accept invitations for people, change accounts/roles directly, edit reviews, replace/unassign reviewers, send reminders, extend existing assignment deadlines, or send invitation emails. The supported writes are paper assignment and invitation link generation/removal only.

Exact machine-readable schemas: [bot-v1.openapi.json](bot-v1.openapi.json). Deployment and credential operations: [bot-api-runbook.md](bot-api-runbook.md). No deployment availability is implied by this reference; verify the target instance with capabilities.

## Reviewer operations v3.1

The additive structured invitation, lifecycle, assignment intervention and coverage endpoints are documented in [Reviewer operations v3.1](reviewer-operations-v31.md). Existing 25-email invitation requests remain available. Generating links now records additive lifecycle **SENT**, while legacy status remains **PENDING**.
