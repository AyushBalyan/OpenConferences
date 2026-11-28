# Plan

Seven phases. Each one finishes, against its exit criteria, before the next starts. Individual tasks live on the board, not here.

One exception, from decision D8: the visual style in Phase 3 is settled first, ahead of Phases 1 and 2.

| Phase | Name         | Outcome                                                        |
| ----- | ------------ | -------------------------------------------------------------- |
| 0     | Foundations  | A safe place to work that cannot touch production              |
| 1     | Audit        | A complete list of what exists and what happens to each part   |
| 2     | Rigid core   | The backend expresses every conference difference as a setting |
| 3     | Design       | Navigation per role and a design system, agreed before screens |
| 4     | New frontend | `apps/web-v2` covers every role end to end                     |
| 5     | SaaS         | A stranger can sign up, run a conference and get paid          |
| 6     | Cutover      | Production runs the redesign and `apps/web` is removed         |

## Phase 0: Foundations

Set up the branch, database and empty frontend app so later work has somewhere safe to land.

- Create the `redesign` branch from `main`.
- Create the `openconferences_redesign` database and an environment file that can only reach local services.
- Add a guard that refuses to start the API, worker or migrations on `redesign` when the database URL is not local.
- Scaffold `apps/web-v2` in the monorepo, wired to the shared contracts, with nothing in it but a health page.
- Run CI on pull requests into `redesign`, without any build or deploy step.
- Seed the redesign database with one invented organisation and conference.

**Exit criteria:** a fresh clone can start the API, worker and `apps/web-v2` against the redesign database with one documented command, and pointing them at production fails with a clear error.

## Phase 1: Audit

Find out what is there before changing it. This phase changes no behaviour.

- Customisation audit: every organiser-specific behaviour in the API, worker, database and templates, each marked **core**, **setting** or **cut**.
- Screen inventory: every current screen, which role uses it, for which task and how often.
- Settings audit: every setting, wherever it is stored (the free-form `reviewConfig` and `feeSchedule` columns, typed columns, environment variables and code constants), with the values used in production.
- Agree the list of fixed building blocks and optional modules.

Real values come from a backup restored locally, never from production (decision D11).

**Exit criteria:** `SETTINGS_AUDIT.md`, `CUSTOMISATION_AUDIT.md`, `SCREEN_INVENTORY.md` and `BUILDING_BLOCKS.md` are complete, every item has a decision, and the Phase 2 and Phase 3 cards on the board are written from them.

## Phase 2: Rigid core

Apply the audit to the backend. Work through it one building block at a time. The blocks and modules are in [BUILDING_BLOCKS.md](BUILDING_BLOCKS.md).

- Organisation and conference profiles: identity, time zone, locale, contact address, sender name, the conference's own website.
- A settings registry: one schema and default for every setting, validated on write and on read, with today's values migrated.
- Phases as rows, so status and dates have one source and there is one registration deadline.
- A review form: criteria, scales, recommendation, confidence and text questions, versioned once reviews exist, with reviews checked against it on the server.
- A switch per conference for each of the eleven modules, replacing the flags fixed in code.
- Registration as a module: a paper can be accepted with no fees set, and non-payment only flags a paper unless withdrawal is switched on.
- Neutral email templates with variables, with a copy per conference.
- Payments behind one provider interface, with an account per organisation.
- Organisation membership as the only link between a user and an organisation.
- Delete everything the audit marked **cut**.

**Exit criteria:** a conference created with default settings and all modules off passes the full lifecycle test from call for papers to decisions, the same test passes with registration switched on, and a search of the codebase finds no conference or organiser name.

## Phase 3: Design

Agree the structure and the visual system before building screens.

- Information architecture: the navigation and screen list for each role, built from the tasks by role in `SCREEN_INVENTORY.md`.
- A plan for the reviewer assignment workspace: one place for assigning, tracking and chasing reviews, replacing the five screens that share that work today. This is planned before any of its screens is designed.
- A decision on how reviewer invitations work, after discussion with the owner.
- Roles and permissions, including what a chair may do.
- Design tokens for both visual styles and every theme (decision D9).
- Core components, each with its states documented.
- The paper page, the busiest screen.
- One fully designed reference flow, the author submitting a paper, to prove the system.

**Exit criteria:** `INFORMATION_ARCHITECTURE.md` and `DESIGN_SYSTEM.md` are agreed, and the reference flow is built in `apps/web-v2` using only system components.

## Phase 4: New frontend

Build `apps/web-v2` one role at a time, each one complete before the next.

1. Sign-in, sign-up and account, including profile and security screens, which do not exist today.
2. Author: submit, revise, respond to reviews, register and pay.
3. Reviewer: invitation and reviewing. Bidding and conflict declaration are not built in the first version (decision D15).
4. Chair: assignments, decisions, communication.
5. Organiser: conference setup, phases, fees, and members with search by name or email.

**Exit criteria:** every task in the screen inventory that was kept can be completed in `apps/web-v2`, and the end-to-end tests run against it.

## Phase 5: SaaS

Add what a stranger needs to use the product without us.

- Self-serve organisation creation, organisation switcher and admin invitations.
- Payment gateways owned by the organisation and linked per conference.
- Plans, usage limits and billing for the platform itself.
- A platform admin console.
- Data export and deletion for an organisation.

There is no public page for each conference in this version: conferences keep their own websites (decision D16).

**Exit criteria:** a new user can sign up, create an organisation, connect their own payment account, share a conference's submit link and receive a paid registration, with no manual step from us.

## Phase 6: Cutover

Move production onto the redesign.

- Restore a copy of production into a rehearsal database and run every redesign migration against it.
- Fix what the rehearsal breaks and repeat until it runs clean.
- Pick a date with no conference in an active phase.
- Remove the local-database guard and the `.env.redesign` wiring in the change that merges `redesign` into `main` (decision D10). Production cannot start while they are in place.
- Back up production, merge `redesign` into `main`, verify, and point the production frontend at `apps/web-v2`.
- Remove `apps/web` once the redesign has run in production for one full conference phase.

**Exit criteria:** production runs from `main` with the redesign merged, existing conferences are intact, and the old frontend is deleted.
