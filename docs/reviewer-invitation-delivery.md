# Reviewer invitation delivery

The Invitations tab offers two explicit actions for an email address:

- **Send invitation email** creates the normal pending invitation and sends the existing reviewer invitation email.
- **Generate link** creates the same pending invitation without sending email, and displays a selectable link for manual sharing.

Pending, unexpired invitations have a **Copy link** action. **Send email** is separate and works for manually generated invitations too. Sending renews the invitation's seven-day expiry using the existing resend behavior. Accepted or declined invitations cannot be shared or sent again; removed invitations stop working. After expiry, organizers can generate a fresh invitation for the same email address without sending mail, or renew the existing invitation through Send email.

Manual links open the existing sign-in/sign-up invitation flow. They do not contain an authentication magic-link token. The recipient must authenticate with the invited email address; new accounts still complete normal email verification. Generating or copying an invitation does not send any email. Choosing to create an account can trigger the usual account verification email.

## API

`POST /api/v1/conferences/:conferenceId/reviewer-invitations` accepts optional `delivery: "EMAIL" | "LINK_ONLY"`. Omission preserves the previous email behavior. The response keeps all existing invitation fields and adds `invitationUrl`.

`GET /api/v1/conferences/:conferenceId/reviewer-invitations/:invitationId/link` returns `invitationUrl`, `email`, and `expiresAt` only for an unexpired pending invitation. It uses the same organizer authorization and tenant checks as invitation creation. Both link-bearing responses set `Cache-Control: no-store`. List responses continue to omit tokens and links.

The existing `/resend`, removal, and acceptance endpoints retain their contracts. No database migration is needed for this change. Audit records include the chosen delivery mode without recording the link.

## Verification

API integration tests cover mail-free creation, pending-list visibility, duplicate prevention, later email delivery, organizer and conference boundaries, expired/removed links, invalid delivery values, and acceptance by the invited account only. The existing invitation email and reviewer workflow regressions run in the same suite.

Browser tests cover both actions, copy after reload, later email delivery, removal, duplicate errors, clipboard fallback, keyboard focus, and desktop/mobile layouts:

```sh
corepack pnpm exec playwright test --config playwright.reviewer-invitations.config.ts
```

Browser tests use synthetic API fixtures. API tests were run with repository environment loading disabled against a fresh task-owned PostgreSQL database and Redis instance on localhost. No production database or mail worker was used.

Verified on October 12, 2026: 41 API tests passed (8 existing skipped tests), all 3 browser tests passed, schema/contract/API/web builds passed, typechecks and targeted lint passed. The UI finish review returned `ship` with no material fixes for this extension. Temporary test services were stopped after verification.
