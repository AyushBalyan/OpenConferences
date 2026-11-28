# Ground rules

These apply to all redesign work. A rule changes only through an entry in [DECISIONS.md](DECISIONS.md).

## 1. Production is untouchable

1. **`main` is the live product.** Every push to `main` runs CI, builds images, migrates the production database and redeploys. Only fixes for the running conferences go there.
2. **`redesign` never merges into `main` before cutover.** A merge would migrate production and deploy the redesign in one step. The only merge in that direction is the planned cutover in Phase 6.
3. **`main` merges into `redesign` regularly.** Every fix shipped to production is merged into `redesign` within a week, so the product never loses a fix and the two migration histories stay compatible.
4. **Redesign code never connects to production.** The redesign uses its own database, its own object storage bucket and its own environment file. The root `.env` points at production and is not used on the `redesign` branch.
5. **No real participant data in the redesign database.** Seed data is invented. A production copy is used once, for the cutover rehearsal, and deleted afterwards.
6. **No real emails or payments from the redesign.** Email uses the log adapter and payments use the mock provider until a staging environment exists.

## 2. Database changes

1. **Migrations are append-only.** Never edit or delete a migration that exists on `main`. New redesign migrations are added after them.
2. **Every redesign migration must run on existing data.** A migration that only works on an empty database is not finished, because production data has to pass through it at cutover.
3. **Destructive changes happen in two steps.** Add the new shape and move the data first. Drop the old column or table in a later migration, after the code stops reading it.
4. **Avoid schema changes on `main`.** If a production fix needs one, the same migration is merged into `redesign` the same day.

## 3. A rigid core

1. **One fixed set of building blocks:** organisation, conference, track, submission, review form, phase, fee, registration. New concepts need a decision log entry.
2. **Differences between conferences are settings, not code.** No conference name, organiser name, country or currency appears in code, seed templates or copy.
3. **Every setting has a schema and a default.** Free-form JSON columns are validated on write and on read. A conference created with no settings changed must work.
4. **Optional features are modules with a switch.** Outreach, student verification, bot integrations and reminder digests can each be turned off per conference, and the product works with all of them off.
5. **Nothing is built for one customer.** A request that only one organiser needs is either turned into a general setting or declined.
6. **Contracts first.** Each API change starts with its schema and contract in `packages/contracts`. Both frontends build against the same contract.

## 4. A calm interface

1. **Each role gets its own shell.** Authors, reviewers, chairs and organisation admins see only what belongs to their role.
2. **One primary action per screen.** Everything else is secondary or behind a menu.
3. **Navigation follows the conference lifecycle.** The current phase is prominent; past and future phases are collapsed.
4. **Components come from the design system.** `apps/web-v2` uses only tokens and components defined there. A missing component is added to the system first, then used.
5. **A screen is carried over only when the screen check marks it as proven.** Those are restyled with the design system and keep their behaviour. Every other screen is redesigned from the task it serves, and removed from the plan if nothing needs it.
6. **Every screen works on a phone, in light and dark themes, and with a keyboard.**
7. **`apps/web` gets no redesign work.** It only receives production fixes on `main`.

## 5. How work moves

1. **Every piece of work is a card on the board** before it starts. One card is one reviewable change.
2. **A card moves through:** Backlog, Next, In progress, Review, Done. At most three cards are In progress at once.
3. **Each card is its own branch** cut from `redesign`, named `redesign/<short-name>`, merged back by pull request into `redesign`.
4. **Commits follow the existing convention** (`feat(scope): …`, `fix(scope): …`), enforced by commitlint.
5. **A card is Done when:**
   - typecheck, lint and tests pass for what it touched;
   - database tests ran against the local test database, not production;
   - a frontend change was checked in the browser at phone and desktop width;
   - the relevant document in `docs/redesign` is updated;
   - nothing in it names a specific conference or organiser.
6. **Phases finish before the next one starts.** Each phase has exit criteria in [PLAN.md](PLAN.md). Work from a later phase is not started early because it looks easy.

## 6. Documentation

1. **Decisions are written down when they are made,** with the reason and what was rejected.
2. **Documents describe the current state.** History belongs in the decision log and in git.
3. **This repository is public.** No secrets, credentials, participant data or unreleased pricing go in these documents.
