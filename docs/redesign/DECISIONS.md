# Decision log

Newest first. Each entry records what was decided, why, and what was rejected. A decision is changed by adding a new entry that replaces it, not by editing the old one.

## Board

The task board is a private page: <https://claude.ai/artifact/REW8XyPPQtyjuANUcM8yVY>

Columns are Backlog, Next, In progress (limit of three), Review and Done. Card keys such as `P2-3` mean phase 2, card 3.

---

## D12. Card branches are named `rd/<short-name>`

**Date:** 2026-11-28

**Decision:** Each card's branch is cut from `redesign` and named `rd/<short-name>`, for example `rd/p1-settings-audit`.

**Why:** Ground rule 5.3 asked for `redesign/<short-name>`. Git cannot hold a branch called `redesign/…` next to a branch called `redesign`, so the first card branch could not be created.

**Rejected:** Renaming the long-running branch, which is already written into the plan, the guard and the CI workflow.

**Consequence:** Ground rule 5.3 is updated.

## D11. Audit documents may quote real names, and may use a backup once

**Date:** 2026-11-28

**Decision:** Three rules for the Phase 1 audit, approved by the owner with the Phase 1 plan.

- The audit documents quote hard-coded conference and organiser names as evidence, with the file and line. This is an exception to ground rule 5.5.
- Real values come from a production backup file restored into a separate local database, `audit_snapshot`. Nothing connects to production. Tables that hold credentials are restored empty. The database is dropped when Phase 1 ends.
- From that copy, a document may contain setting values (fees, dates, keys) and counts. It may not contain participant names, email addresses, paper titles or payment records.

**Why:** An audit that cannot name what it found is not usable, and Phase 2 migrations have to be written against what production really holds. The repository is public, so what may be written down needs a firm line.

**Rejected:** A read-only query against production, which the owner declined in favour of a backup. Auditing from code and test data only, which would leave real values unknown.

**Consequence:** Ground rules 1.5 and 5.5 are updated. `infra/redesign/audit/snapshot.sh` restores and drops the copy; query results are written to a folder git ignores.

## D10. The local-database guard has no off switch and is removed at cutover

**Date:** 2026-11-28

**Decision:** On `redesign`, the API, the worker, the database client and every Prisma command refuse a `DATABASE_URL` that is not on `localhost`, `127.0.0.1` or `::1`. No environment variable turns the check off. The redesign runs on its own local Postgres server on port 55433, started by `infra/redesign/db.sh`, and reads `.env.redesign`, which is committed because it holds no secret.

**Why:** Ground rule 1.4 says redesign code never connects to production. A check that a variable can disable is one copied line away from being disabled. A server of its own keeps redesign migrations away from every other local database, and needs no Docker.

**Rejected:** A switch such as `ALLOW_REMOTE_DATABASE=true`. A check that only runs in development. Sharing the Postgres server of the main checkout. An ignored environment file copied from an example, which a fresh clone would have to create by hand.

**Consequence:**

- Production cannot start from this code as it is. The cutover has to remove the guard in the same change that merges `redesign` into `main`: the check in `packages/config`, the one in `packages/db`, `packages/db/prisma.config.ts`, and the scripts in `packages/db/package.json` that name `.env.redesign`. This is now a step in Phase 6 of the plan.
- A hosted staging database (D3) needs a decision that replaces this one before it can be used.
- The guard cannot see a tunnel that makes a remote database appear on `localhost`.

This entry was written during the Phase 0 work and confirmed by the owner on 2026-11-28.

## D9. Two visual styles, switchable per conference, with themes and a brand colour

**Date:** 2026-11-28

**Decision:** `apps/web-v2` ships two visual styles, Colour blocks and Ink and line. An organiser picks the style, one of its preset themes and optionally a brand colour in Settings, Appearance. Themes are Classic, Lighter, Pastel and Dark for Colour blocks, and Paper and Slate for Ink and line. A new conference starts on Colour blocks, Classic until the owner says otherwise.

**Why:** The owner could not choose between the palettes and asked for themes with an option to set your own. They approved the working switcher ("it works and i like this approach") and, after one rework, the Ink and line style ("Ink looks right"). This entry is recorded from those replies; the owner approved the look and the approach and did not separately say "ship both".

**Rejected:** One fixed style and palette. A full colour editor, because a free choice of every colour cannot be kept readable.

**Consequence:**

- Components never name a colour. They use named roles (background, surface, text, line, accent, attention and the section colours), and a theme is one set of values for those roles.
- A brand colour is adjusted automatically until text on it reaches a contrast of 4.5 to 1, and the organiser is told when that happens.
- Colours that carry meaning, such as error and success, do not change with the brand colour.
- Three parts exist once per style: the overview header, the section card and the illustrations. Everything else is one layout restyled by the roles.
- Every illustration is needed in a filled form and an outline form.
- Emails and PDFs cannot read the roles at display time, so they are given the resolved colours when they are generated.
- Both styles are covered by the browser tests.

The mockup is the "Style and theme switcher" artboard on the design canvas.

## D8. Visual design comes first, and it has to feel alive

**Date:** 2026-11-27

**Decision:** Settle the visual style of `apps/web-v2` before other redesign work. The style uses illustrations where they help: overview cards, empty states, first-run and confirmation moments.

**Why:** The owner's judgement is that the product is about 80% complete in function. What it lacks is taste: screens read as plain white boxes. The reference for the feel is Ex Ordo's dashboard cards, which pair one large figure with a line illustration.

**Rejected:** The greys-only style used in the structure mockups, which was chosen to compare navigation and was never meant as the final look.

**Consequence:** The visual half of Phase 3 runs ahead of Phases 1 and 2. Illustrations become part of the design system and need one consistent source.

## D7. Every conference can be customised without code

**Date:** 2026-11-27

**Decision:** Features are switched on or off per conference, each feature has typed settings with defaults, and the review form is built by the organiser.

**Why:** Reviewer bidding and conflict declaration had to be switched off in code for every conference, because there was no way to switch them off for one. The review form's criteria are stored per conference but no screen edits them and the review screen ignores them.

**Rejected:** Code constants and per-deployment flags.

**Consequence:** Phase 2 gains a settings registry, a feature switch per conference and a versioned review form builder. Existing conferences are migrated to exactly today's behaviour.

## D6. The second app stands, and proven screens are carried over

**Date:** 2026-11-27

**Decision:** D4 stands: the new frontend is `apps/web-v2`. Screens that already work well are carried into it and restyled, not redesigned from nothing: the decisions workspace, the registrations list, the reminder flow with its email preview, and the review form with autosave.

**Why:** Chosen by the owner. A check of all 65 current screens found these to be ahead of the mockups.

**Rejected:** Improving `apps/web` in place, which was proposed on 2026-11-27 and declined.

**Consequence:** Ground rule 4.5 changes from "no screen is ported as it is" to "a screen is carried over only when the screen check marks it as proven".

## D5. The task board is a private page, not GitHub Projects

**Date:** 2026-11-26

**Decision:** Track redesign work on a private board page.

**Why:** Chosen by the owner over the alternatives below. It also keeps the roadmap out of the public repository.

**Rejected:** GitHub Projects (linked to pull requests, but visible on a public repository); a markdown board in the repository (no drag and drop).

**Consequence:** Cards are not linked to pull requests automatically. Each pull request names its card key in the title.

## D4. The new frontend is a second app, not a restyle

**Date:** 2026-11-26

**Decision:** Build `apps/web-v2` beside `apps/web` in the same monorepo, against the same API contracts.

**Why:** The clutter comes from the navigation and screen structure, which mirror the database. Restyling pages inside the same structure would not remove it.

**Rejected:** Redesigning `apps/web` page by page; a separate frontend repository.

**Consequence:** Two frontends exist until cutover. `apps/web` receives production fixes only.

## D3. The redesign has its own database

**Date:** 2026-11-26

**Decision:** The redesign uses a local Postgres database, `openconferences_redesign`, with invented seed data.

**Why:** Redesign migrations would break the code serving the running conferences if they ran against production.

**Rejected:** Sharing the production database with backward-compatible migrations only, which would slow every schema change and put live reviews and payments at risk.

**Consequence:** The schemas drift on purpose and are brought together once, at cutover, after a rehearsal on a production copy. A hosted staging database is added when someone other than the developer needs to try the redesign.

## D2. `main` stays the live product

**Date:** 2026-11-26

**Decision:** `main` keeps serving the running conferences. The redesign lives on a long-running `redesign` branch that never deploys to production.

**Why:** CI, image builds, the production migration, Coolify and Vercel are all triggered by `main`. Leaving them alone means nothing on the server changes while conferences are in progress.

**Rejected:** Moving the live product to a release branch and making `main` the redesign, which would mean editing four workflows, the Vercel production branch and the image tags Coolify tracks.

**Consequence:** `redesign` must not be merged into `main` before cutover. Fixes on `main` are merged into `redesign` regularly.

## D1. Redesign in place, not in a forked repository

**Date:** 2026-11-26

**Decision:** Keep one repository and one backend. Change the backend where the audit says to, and replace the frontend.

**Why:** The organisation-scoped schema, row-level security, typed contracts, worker jobs and payment reconciliation are sound and expensive to rebuild. The problems are organiser-specific behaviour and the interface.

**Rejected:** A fork or a rewrite in a new repository, which would mean applying every fix twice and migrating existing conferences across repositories later.

**Consequence:** Every redesign migration has to work on existing production data.
