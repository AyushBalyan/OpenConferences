# CFP deadlines and manual closure

A published call accepts new submissions only when `cfpOpensAt <= now < cfpClosesAt`. The closing instant is exclusive, and both timestamps must be valid. Phase settings are entered in UTC; ISO timestamps with offsets are compared as absolute instants. Draft conferences stay unpublished regardless of their dates.

After the cutoff, conference detail/list responses and the global dashboard report `CFP_CLOSED`, displayed as **CFP Closed**. No cron job or background worker is needed to enforce expiry. The raw stored status may remain `CFP_OPEN` for a naturally expired call; every submission write still checks the dates directly. Explicit reviewing/decision/finalization/terminal states are preserved.

Organizers and org admins can use **Overview → Conference status → Close CFP** to persist `CFP_CLOSED` immediately. The existing status API accepts `PATCH /api/v1/conferences/:id/status` with `{"status":"CFP_CLOSED"}`. Conference chairs and authors cannot use this organizer operation. Existing papers remain readable; closure does not delete or withdraw them.

**Reopen CFP** uses the same API with `CFP_OPEN`. A future closing date and a valid window are required; to reopen an expired call, extend its dates first. A manual closure remains in force when dates or other settings change, until explicitly reopened. An automatic expiry can be extended by changing the closing date while its raw state remains `CFP_OPEN`.

The backend gates draft creation, draft metadata/authorship changes, final submission and both submission-upload initiation and completion. A pre-signed upload cannot be finalized after the deadline. Revision and camera-ready uploads retain their separate eligibility/deadline rules. Conference row locks serialize submission writes against a manual close, and the cutoff is rechecked after the corresponding-author lock wait. Public author join tokens also check dates through the existing restricted security-definer lookup.

An already open conference page updates its visible status at the configured window boundaries and refreshes the server data. Author dashboards hide **New submission** when CFP is closed. Saving phase settings refreshes the workspace status.

## Deployment

Apply these migrations in order before deploying the updated API, web and shared packages:

1. `20261103120000_cfp_closed_status` adds the enum value.
2. `20261103120100_cfp_join_deadline` updates capability-token resolution without broadening table access.

Regenerate Prisma Client and rebuild schemas/contracts/database packages. Conferences with missing or invalid CFP dates no longer accept submissions; configure a valid window explicitly. Existing manually advanced conferences are not moved backwards by this migration.

## Verification

- Full API regression suite passed: 412 tests, with 45 environment-specific skips. This includes the global-dashboard and restricted production database-role probes.
- Shared phase tests cover exact closing instant, UTC/offset comparison, invalid windows, unpublished drafts and manual closure.
- Browser tests cover organizer closure and persistence, expired deadlines, live author cutoff updates, unauthorized controls and recoverable errors.

```sh
pnpm --filter @openconferences/schemas exec vitest run src/conference-phase.test.ts
SKIP_ENV_FILE=true DATABASE_URL='<isolated test PostgreSQL URL>' REDIS_URL='<isolated test Redis URL>' pnpm --filter @openconferences/api exec vitest run --config vitest.integration.config.ts src/tenancy/tenancy.mapper.test.ts src/submission/papers.service.test.ts test/integration/submission.test.ts test/integration/tenancy.test.ts test/integration/author-join.test.ts test/integration/dashboard.test.ts
pnpm exec playwright test --config playwright.cfp.config.ts
```

Integration tests require a dedicated migrated PostgreSQL test database and Redis; do not run against production data.
