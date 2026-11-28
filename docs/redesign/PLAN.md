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
- Settings audit: every key in the free-form `reviewConfig` and `feeSchedule` columns, with the values used in production.
- Agree the list of fixed building blocks and optional modules.

**Exit criteria:** `CUSTOMISATION_AUDIT.md` and `SCREEN_INVENTORY.md` are complete, every item has a decision, and the Phase 2 and Phase 3 cards on the board are written from them.

## Phase 2: Rigid core

Apply the audit to the backend. Work through it one building block at a time.

- Strict schemas and defaults for every conference setting.
- A per-conference switch for each optional feature, replacing the flags fixed in code.
- A review form builder: criteria, scales, recommendation, confidence and text questions, versioned once reviews exist.
- Remove conference-specific text from seeded email and outreach templates; replace it with variables.
- Move organiser identity (legal name, address, tax number, sender name) onto the organisation.
- Make organisation membership the only link between a user and an organisation.
- Delete everything the audit marked **cut**.

**Exit criteria:** a conference created with default settings and all optional modules off passes the full lifecycle test from call for papers to registration, and a search of the codebase finds no conference or organiser name.

## Phase 3: Design

Agree the structure and the visual system before building screens.

- Information architecture: the navigation and screen list for each role.
- Design tokens: colour, type, spacing, radius, in light and dark.
- Core components, each with its states documented.
- One fully designed reference flow, the author submitting a paper, to prove the system.

**Exit criteria:** `INFORMATION_ARCHITECTURE.md` and `DESIGN_SYSTEM.md` are agreed, and the reference flow is built in `apps/web-v2` using only system components.

## Phase 4: New frontend

Build `apps/web-v2` one role at a time, each one complete before the next.

1. Sign-in, sign-up and account.
2. Author: submit, revise, respond to reviews, register and pay.
3. Reviewer: invitation, bidding, conflicts, reviewing.
4. Chair: assignments, decisions, communication.
5. Organiser: conference setup, phases, fees, members.

**Exit criteria:** every task in the screen inventory that was kept can be completed in `apps/web-v2`, and the end-to-end tests run against it.

## Phase 5: SaaS

Add what a stranger needs to use the product without us.

- Self-serve organisation creation, organisation switcher and admin invitations.
- Payment gateways owned by the organisation and linked per conference.
- Plans, usage limits and billing for the platform itself.
- A public page for each conference.
- A platform admin console.
- Data export and deletion for an organisation.

**Exit criteria:** a new user can sign up, create an organisation, connect their own payment account, publish a conference page and receive a paid registration, with no manual step from us.

## Phase 6: Cutover

Move production onto the redesign.

- Restore a copy of production into a rehearsal database and run every redesign migration against it.
- Fix what the rehearsal breaks and repeat until it runs clean.
- Pick a date with no conference in an active phase.
- Back up production, merge `redesign` into `main`, verify, and point the production frontend at `apps/web-v2`.
- Remove `apps/web` once the redesign has run in production for one full conference phase.

**Exit criteria:** production runs from `main` with the redesign merged, existing conferences are intact, and the old frontend is deleted.
