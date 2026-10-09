# Reviewer Overview v1 — documentation handoff

Disposition: ordinary extension; no design-system change. The finished Reviewer Overview inherits the operational dashboard's white/slate/indigo world. The existing design files are preserved. This evidence note does not establish new global tokens or rules.

## System comparison

- Palette: white table surfaces, slate canvas/text/dividers, indigo primary actions, and rose/amber operational signals match the shared dashboard primitives. Status meaning is also stated in text.
- Type: the app root supplies Inter. The shared PageHeader uses a 24px semibold title and 14px supporting copy; the new panels use 18px semibold headings, 14px content, and 12px secondary data. Shared table headings retain their incumbent 11px treatment. The exact email uses the existing mail template's sans-serif stack, 21px heading, 15px body, and 13px supporting copy.
- Shared-primitives rule: PageHeader, DataTable, Button, and conference navigation remain the authority. ReviewViewSwitch is shared with the paper ledger; selected queues use the incumbent primary button treatment.
- Responsive-containment rule: filter controls stack on mobile and use two/three columns at existing breakpoints; the table scrolls within its container; expanded assignment actions stack; reminder panels wrap recipient addresses and plain-text email content.
- Explicit-action rule: reminder preparation exposes selected assignments, the subject, canonical HTML and plain-text previews, and confirmation before the request. Extend/replacement actions remain labeled and use the existing form/control language. These are observed surface behaviors, not new system-wide prohibitions.

## Evidence checked

Implementation and incumbent sources:

- `apps/web/src/components/dashboard/reviews/reviewer-overview.tsx`
- `apps/web/src/app/dashboard/conferences/[id]/reviews/reviewers/page.tsx`
- `apps/web/src/components/dashboard/reviews/review-view-switch.tsx`
- `apps/web/src/components/dashboard/reviews/review-ledger.tsx` (incumbent comparison, sampled)
- `apps/web/src/components/dashboard/page-header.tsx`
- `apps/web/src/components/dashboard/data-table.tsx`
- `apps/web/src/components/dashboard/data-table/index.ts`
- `apps/web/src/components/dashboard/data-table/data-table-core.tsx` (style scan)
- `apps/web/src/components/dashboard/data-table/data-table-pagination.tsx` (style scan)
- `apps/web/src/components/dashboard/data-table/data-table-toolbar.tsx` (style scan)
- `apps/web/src/components/dashboard/section-page-layout.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx` (root font application)
- `apps/web/tailwind.config.ts`
- `packages/db/src/notification-templates.ts` (canonical `reviewer.reminder_digest` and shared mail layout)
- `apps/web/PRODUCT.md`
- `apps/web/DESIGN.md`

All seven supplied captures were opened: `desktop.png`, `mobile.png`, `expanded-mobile.png`, `digest-desktop.png`, `digest-mobile.png`, `digest-mobile-email-end.png`, and `digest-mobile-confirm.png`, under this directory. The roster captures show the incumbent shell and table; expanded mobile shows stacked assignment actions; digest captures show the preview, internally scrolled email ending, wrapped plain text, and confirmation controls. The scrolled captures are state evidence, not full-page composition references. The later empty-search correction is present in source and does not change the captured composition.

Workflow references read: `/Users/lkbalyan/.agents/skills/impeccable/SKILL.md`, `reference/document.md` in full, and the ordinary-extension/documentation clauses of `reference/new-work.md`.

## Preserved drift and scope

`apps/web/DESIGN.md` describes the marketing Conference Control Sheet (blue/chartreuse, Barlow Condensed/Atkinson, square geometry), while the operational dashboard uses Inter, slate/indigo, and rounded shared primitives. This predates Reviewer Overview and is reported without repair or promotion into a new global system. Neither `.impeccable/design.json` nor `apps/web/.impeccable/design.json` exists in this checkout; neither was created. No inherited implementation defect is canonized by this note.

The supplied finish verdict is ship at the seven-correction scope only. This handoff does not broaden that verdict, repeat the detector, or claim independent functional testing. No production database access was performed. Only this documentation file was written.
