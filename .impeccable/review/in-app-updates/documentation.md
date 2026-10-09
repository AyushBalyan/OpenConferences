# In-app updates — documentation handoff

Disposition: ordinary extension in Operate mode; no design-system change. The finished Updates feed inherits the operational dashboard's shared primitives and familiar controls. `apps/web/PRODUCT.md` and `apps/web/DESIGN.md` are preserved. This scoped evidence note creates no global tokens, rules, or sidecar.

## System comparison

- Palette: white list surfaces, slate canvas/text/dividers, indigo selected controls and unread signals, and rose error feedback match the dashboard primitives. Read state is also written explicitly as “Unread” or “Read”.
- Type ramp: the app root supplies Inter. PageHeader uses a 24px semibold title and 14px supporting copy. Update statements and subjects use 14px text; read labels, timestamps and supporting counts use 12px; the bell badge uses the compact 11px count treatment.
- Shared-primitives rule: PageHeader and the default, outline and ghost Button variants remain the authority. The bell uses Lucide, the existing top bar and conference-scoped navigation; there is no new visual world or raster imagery.
- Responsive-containment rule: the page is bounded at 64rem, controls wrap, and the header stacks below the existing small breakpoint. Full statements and subjects wrap within the list rather than truncate; subjects have a bounded reading measure and 24px line height. Rounded white containers and slate dividing lines preserve the dashboard's form language.
- Explicit-state-and-action rule: concise chronological statements pair source context with timestamps, written read state and labeled source links. All/Unread filters, Mark read, Mark all read, Refresh and pagination use real buttons or links. The coordinator bell exposes its unread count through an accessible label. These are observed surface patterns, not new system-wide prohibitions.

## Evidence checked

Implementation and incumbent sources checked:

- `apps/web/src/app/dashboard/conferences/[id]/inbox/page.tsx`
- `apps/web/src/components/dashboard/conference-update-bell.tsx`
- `apps/web/src/components/dashboard/dashboard-topbar.tsx`
- `apps/web/src/lib/conference-nav.ts`
- `apps/web/src/components/dashboard/page-header.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/tailwind.config.ts`
- `apps/web/src/app/layout.tsx` (font source/application)
- `apps/web/PRODUCT.md`
- `apps/web/DESIGN.md`
- `docs/in-app-updates.md`
- `.impeccable/review/in-app-updates/capture-record.md`

The supplied capture record validates `desktop.png` (1440px) and `mobile.png` (390px), with `before-desktop.png` and `before-mobile.png` as baselines, all in this directory. The screenshots use synthetic fixtures and intercepted local APIs. This handoff relies on that accepted capture evidence and the supplied finish review; it does not claim a new visual review or capture pass.

The supplied fresh finish review returned **ship**: persistence passed, fidelity matched, the ceiling was reached for this operational extension, and no material fixes remained. Its retained constraints are concise copy, mobile wrapping, explicit read state, familiar controls and privacy. The reported detector pass returned no findings. Functional checks reported by the implementation handoff include 15 database/inbox regression tests, 29 web tests, 18 shared-schema tests, five browser flows, API/web typechecks and API build. Those checks were not rerun for documentation; the frontend build was still in progress at this handoff.

The feature documentation describes coordinator-only conference activity alongside the preserved private participant inboxes. Activity statements exclude review text, scores and private comments; this extension introduces no email delivery path. These are scoped product behaviors, not visual-system tokens.

Workflow references checked: `/Users/lkbalyan/.agents/skills/impeccable/SKILL.md`, `reference/document.md` in full, the ordinary-extension/documentation clauses of `reference/new-work.md`, and the documenter role instructions.

## Preserved drift and scope

`apps/web/DESIGN.md` describes the marketing Conference Control Sheet (blue/chartreuse, Barlow Condensed/Atkinson, square geometry), while the operational dashboard uses Inter, slate/indigo and rounded shared primitives. This predates the extension and remains outside scope. Neither `.impeccable/design.json` nor `apps/web/.impeccable/design.json` exists; neither was created. No inherited defect or unrelated marketing/dashboard drift is canonized or repaired by this note. Only this documentation file was written.
