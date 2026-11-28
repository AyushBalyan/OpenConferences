# Decision log

Newest first. Each entry records what was decided, why, and what was rejected. A decision is changed by adding a new entry that replaces it, not by editing the old one.

## Board

The task board is a private page: <https://claude.ai/artifact/REW8XyPPQtyjuANUcM8yVY>

Columns are Backlog, Next, In progress (limit of three), Review and Done. Card keys such as `P2-3` mean phase 2, card 3.

---

## D16. No public conference page in this version

**Date:** 2026-11-29

**Decision:** The product does not build a public page for each conference. A conference keeps its own independent website, and the product links to it.

**Why:** Decided by the owner. The conferences run on the product already have their own sites, so a second public page would duplicate them.

**Rejected:** The public conference page planned for Phase 5 (call for papers, dates, tracks, fees and a submit button).

**Consequence:** The item is removed from Phase 5 of the plan and from its exit criteria, and card P5-5 is removed from the board. The conference profile gains one setting, the address of the conference's own website, shown in emails and on the page an author lands on from the submit link. That landing page still has to name the conference, which it does not do today.

## D15. The Phase 1 audit proposals are accepted, with three held back

**Date:** 2026-11-29

**Decision:** The owner accepts the proposals in the three audits as written: all five in `SETTINGS_AUDIT.md`, eleven of the twelve in `CUSTOMISATION_AUDIT.md`, and five of the eight in `SCREEN_INVENTORY.md`. Three are held back:

- **Reviewer assignment.** The owner names the spread of assignment work over five screens as one of the major problems of the product. The audit's proposal (merge two screens, cut one) is not adopted as the answer. A plan comes first (card P3-9).
- **Reviewer invitations.** How a reviewer is invited, accepts and signs in is to be discussed as a whole. This holds two proposals: one acceptance flow, and no longer accepting every pending invitation on sign-in (card P3-10).
- **The public conference page.** See D16.

**Why:** The owner's words: "rest proceed with proposed suggestions".

**Rejected:** Nothing else was changed.

**Consequence:** The verdicts in the three audits stand as the input to Phase 2 and Phase 3. The main ones: one registration deadline, kept as a phase date; reviews checked on the server against the review form; sender identity on the organisation with a contact address per conference; a time zone on the organisation that a conference can override; a payment account per organisation; a general "local price for one country" rule, off by default; two fee audiences and two periods in the first version; registration as a module; neutral email templates with a copy per conference; platform settings for the product name and support address; the chair's permissions settled in Phase 3; self-service organisation sign-up in Phase 5. The bidding and conflict screens are not built in the first version of `apps/web-v2`.

## D14. Ten building blocks and eleven modules

**Date:** 2026-11-29

**Decision:** Every conference has ten fixed building blocks: organisation, person and role, conference, phase, submission, review form, review, decision, email and track. Eleven features are modules with a switch per conference: reviewer bidding, conflict declaration, author response, revisions, final versions, registration and payment, student rate, multiple tracks, outreach campaigns, integrations and reminder digests. A new conference starts with revisions and final versions on and the rest off. The full list, with what each switch removes, is in [BUILDING_BLOCKS.md](BUILDING_BLOCKS.md).

**Why:** Agreed by the owner from the Phase 1 audits. Person and role, review, decision and email are in every flow but were missing from the list. Fee and registration cannot be fixed blocks, because a conference that charges nothing must still be able to accept papers.

**Rejected:** The eight blocks in the earlier ground rule 3.1, which listed fee and registration as fixed.

**Consequence:** Ground rules 3.1 and 3.4 are updated. Existing conferences are migrated to exactly what they do today. A module that is off must pass five tests: the menu does not show it, settings do not ask for it, the server refuses it in one place, nothing depends on it silently, and its emails and jobs stop.

## D13. Vercel does not build previews for redesign branches

**Date:** 2026-11-28

**Decision:** `apps/web/vercel.json` on `redesign` tells Vercel to skip the build when the branch is `redesign` or starts with `rd/`. Every other branch, including `main`, builds as before.

**Why:** Vercel builds a preview of the current web app for every pushed branch. The first pushes of `redesign` produced seven. They show nothing new, because the new frontend is `apps/web-v2`, which Vercel does not build. A preview may also be publicly reachable and may be pointed at the live API, which ground rule 1 is there to prevent. Chosen by the owner.

**Rejected:** Leaving the previews. A rule that skips every build from this file, which would also stop production builds after cutover and would have to be remembered and removed.

**Consequence:** The rule names the branches, so it is harmless on `main` after cutover and needs no removal step. A branch cut before this change still builds a preview until it includes it. When `apps/web-v2` needs previews, it gets its own Vercel project.

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
