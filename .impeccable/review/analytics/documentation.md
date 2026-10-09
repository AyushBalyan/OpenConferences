# Analytics — documentation handoff

Disposition: ordinary extension of the operational dashboard; no design-system change. The finished source preserves the incumbent Inter/slate/indigo identity and shared controls. `apps/web/DESIGN.md` and `apps/web/PRODUCT.md` remain unchanged; no design sidecar is created. This scoped evidence note establishes no new global tokens or prohibitions.

## Observed system

- Palette: white panels on the slate canvas, slate text and dividers, and indigo actions. Chart colors are indigo (`#4f46e5`), teal (`#0f766e`), amber (`#b45309`), rose (`#be123c`), and slate (`#64748b`). Review states also have full text labels, counts, and percentages; color is supplementary.
- Type ramp: the root applies Inter. The shared page title is 24px semibold; section headings are 18px semibold; panel headings are 16px semibold; body and category labels are 14px; metadata and chart ticks are 12px. Summary values are 20px, increasing to 24px at the small breakpoint, with semibold tabular numerals. No new display face is introduced.
- Shared-controls rule: PageHeader and Button remain authoritative. Refresh, chart modes, and author pagination use existing outline/default/ghost variants. Links and the search input have visible indigo focus treatment. Panels use white backgrounds, slate borders, 16px corners, and 20px padding increasing to 24px; panel depth comes from borders rather than new shadows.
- Exact-values rule: semantic HTML category rows retain wrapping names and right-aligned exact values above scaled bars. Review progress pairs its segmented strip with a labeled list. Recharts remains for paper activity, with whole-number axes, per-period/cumulative modes, UTC labels, and an expandable exact-data table. Financial categories can diverge around zero.
- Scope-and-containment rule: counting definitions precede the summary; units and decision denominators remain explicit. Charts use available width, grid children allow shrinking, controls wrap, and author names remain complete in the searchable, paginated table. Review attention links lead to the appropriate paper ledger or Reviewer Overview. Paper metrics remain separate from the financial transaction history.

## Evidence checked

Source: `apps/web/src/components/dashboard/analytics-overview.tsx`, `analytics/analytics-charts.tsx` in the same component directory, `apps/web/src/lib/analytics.ts`, `apps/web/src/lib/conference-nav.ts`, the analytics route, shared `page-header.tsx` and `ui/button.tsx`, root `layout.tsx`, `globals.css`, and `tailwind.config.ts`.

Context: `apps/web/PRODUCT.md`, `apps/web/DESIGN.md`, `docs/analytics-refresh.md`, and this directory's `capture-record.md`. Workflow references: Impeccable `SKILL.md`, `reference/document.md`, and the ordinary-extension/documentation clauses of `reference/new-work.md`.

The supplied finish review accepted `desktop.png`, `mobile.png`, `desktop-first.png`, `mobile-review.png`, `mobile-activity.png`, `mobile-people.png`, and `mobile-finance.png`, with disposition **ship** and no material fixes. Before captures remain comparison evidence. The capture record identifies all displayed people, institutions, conference details, and numbers as synthetic fixtures, with browser API requests intercepted by `e2e/analytics.spec.ts`. This documentation pass relies on that accepted visual review and performs no additional browser round, detector pass, or functional test run.

## Preserved drift and boundary

The existing DESIGN.md describes the marketing Conference Control Sheet, with blue/chartreuse, Barlow Condensed/Atkinson, and square geometry. The shipped dashboard uses Inter, slate/indigo, and rounded shared primitives. This pre-existing scope mismatch is reported without repair or adoption as dashboard guidance: the request refines analytics rather than replacing the product identity. No craft-floor defect is canonized by this note. Only this documentation file was written.
