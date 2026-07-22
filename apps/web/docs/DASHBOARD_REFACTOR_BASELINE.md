# Dashboard refactor baseline

## Smoke checklist (manual)

- [ ] Sign in
- [ ] `/me/dashboard` loads cross-conference summary
- [ ] Switch conference via sidebar
- [ ] Author: submissions list, new submission
- [ ] Reviewer: bidding, my assignments, COI declare
- [ ] Organizer: overview KPIs, assignments/invites resend, decisions, members grant, settings, notifications, audit
- [ ] Collapsible sidebar persists after reload
- [ ] Command menu (⌘K) navigates to sidebar destinations

## Route ownership (must remain reachable)

| Route                                      | Owner component            |
| ------------------------------------------ | -------------------------- |
| `/me/dashboard`                            | `me/dashboard/page.tsx`    |
| `/dashboard/conferences/new`               | `conferences/new/page.tsx` |
| `/dashboard/conferences/[id]`              | Role dashboards            |
| `.../submissions/*`                        | submissions pages          |
| `.../reviews/*`                            | reviews pages + panels     |
| `.../members/*`                            | members panels             |
| `.../settings/*`                           | settings panels            |
| `.../registrations/*`                      | registrations pages        |
| `.../notifications/*`                      | notifications pages        |
| `.../tracks`, `.../audit`, `.../analytics` | respective pages           |

## API client functions used by dashboard (no-delete)

All exports from `apps/web/src/lib/api-client.ts` referenced by dashboard pages must remain callable after refactor.
