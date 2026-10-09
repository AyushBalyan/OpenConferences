# In-app updates capture record

Captured 9 October 2026 from the local application with all `/api/v1/` browser requests intercepted by `e2e/in-app-updates.spec.ts`. Systems & Society 2026, all people, paper details, dates and counts in these screenshots are authored synthetic fixtures; no production data appears.

Before: `before-desktop.png` (1440px) and `before-mobile.png` (390px). After: `desktop.png` (1440px) and `mobile.png` (390px). Full-page capture expands the dashboard's scroll container; the confirmation capture hides Next.js development chrome only. All captures were opened and validated. The operational production page does not carry a synthetic-data disclaimer.

Direction: ordinary extension in Operate mode. Preserve the established Inter/slate/indigo dashboard, shared PageHeader/Button/navigation and rounded bordered containers. Show a concise chronological list with exact unread/read labels, a visible bell count, clear source context and useful links. Full names and long paper titles wrap on mobile. No world replacement, new imagery, comp or system redesign is authorized. PRODUCT.md and DESIGN.md are preserved; known marketing/dashboard drift remains outside scope.

## Red notification pill refinement — 10 October 2026

The Updates navigation item and bell now use a red unread-count pill, as requested. Updated desktop/mobile captures use the same synthetic intercepted APIs. Additional `collapsed-sidebar.png` and `mobile-navigation.png` captures verify navigation variants. Browser checks cover synchronized count changes and hiding the pill at zero; no database or mail provider is used for this refinement.
