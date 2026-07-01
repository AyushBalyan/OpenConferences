# Frontend UI/UX Design Document: OpenConferences

## 1. Executive Summary

This document outlines the complete UI/UX overhaul for the OpenConferences platform. Moving beyond the initial wireframes, this design system establishes an **industry-standard, professional, and highly trustworthy** aesthetic suitable for global academic and professional conferences.

The design leverages **Next.js, Tailwind CSS, and shadcn/ui** to create a clean, accessible, and highly responsive interface that prioritizes data density, clear typography, and intuitive workflows for Organizers, Authors/Participants, and Reviewers.

---

## 2. Design System & Visual Language

### 2.1. Color Palette

To convey professionalism, academic integrity, and modern tech, we will use a refined color palette moving away from overly bright/neon colors to a more sophisticated corporate SaaS look.

- **Primary Brand (Indigo/Slate):** `bg-indigo-600` to `bg-indigo-700`. Used for primary actions, active states, and focus rings. Conveys trust and academic rigor.
- **Backgrounds:**
  - App Background: `bg-slate-50` (Very light gray for depth).
  - Card/Surface Background: `bg-white` (Pure white for content areas to maximize readability).
- **Text & Typography:**
  - Primary Text: `text-slate-900` (Almost black for headings).
  - Secondary Text: `text-slate-500` (For table headers, subtitles, meta-information).
- **Semantic Status Colors (Crucial for Conference Workflows):**
  - **Success/Accepted:** `bg-emerald-100 text-emerald-700` (e.g., Paper Accepted, Payment Paid).
  - **Pending/Review:** `bg-amber-100 text-amber-700` (e.g., Under Review, Pending Payment).
  - **Danger/Rejected:** `bg-rose-100 text-rose-700` (e.g., Paper Rejected, Missing Action).
  - **Info/Draft:** `bg-blue-100 text-blue-700` (e.g., Draft Submission).

### 2.2. Typography

- **Font Family:** Inter or Geist (Modern sans-serif, highly legible for data-heavy tables).
- **Hierarchy:**
  - Page Titles: `text-3xl font-semibold tracking-tight`
  - Section Headers: `text-lg font-medium`
  - Body Text: `text-sm` (Standard for SaaS dashboards to maximize data density).
  - Data/Numbers: `font-mono` for metrics and tabular data alignment.

### 2.3. Component Styling (shadcn/ui overrides)

- **Cards:** Subtle borders (`border-slate-200`), slight shadow (`shadow-sm`), rounded corners (`rounded-xl`). No heavy drop shadows.
- **Buttons:**
  - Primary: Solid Indigo, slight hover translation.
  - Secondary: Outline with slate text.
  - Ghost: For table row actions (e.g., "View", "Edit").
- **Data Tables:** Clean lines, sticky headers, hover states on rows (`hover:bg-slate-50`), and pagination controls aligned to the bottom right.

---

## 3. Global Layout Architecture

The application will utilize a classic, highly efficient **Sidebar + Topbar SaaS Layout**.

### 3.1. Global Sidebar (Left)

- **Width:** Fixed 250px (collapsible to icons on tablet, hidden behind hamburger menu on mobile).
- **Brand Area:** Top left, crisp logo and Conference Name. If the user is in a specific conference, the context is clearly shown here.
- **Navigation Links:**
  - Subtle hover states (`hover:bg-slate-100`).
  - Active state highlighted with a primary color left-border accent and slightly bolded text.
  - Grouped by logical domains (e.g., "Workspace", "Settings").
- **Bottom Area:** User profile summary, "Switch Conference" context menu, and a "Help/Support" link. (Replacing the generic "Keep you safe" block with actionable user settings).

### 3.2. Global Topbar

- **Height:** 64px.
- **Left:** Breadcrumbs (e.g., `Conferences / AI Summit 2026 / Submissions`).
- **Center:** Global Command Menu (Cmd+K / Ctrl+K) search bar for quickly finding papers, users, or settings.
- **Right:**
  - Contextual Actions (e.g., "Create Submission" button if applicable).
  - Notification Bell (with unread badge).
  - User Avatar Dropdown (Profile, Billing, Sign out).

---

## 4. Role-Based Dashboards Breakdown

### 4.1. Organizer Dashboard (The Control Center)

**Goal:** Provide a bird's-eye view of conference health, bottlenecks, and revenue.

- **Top Metrics Row (KPI Cards):**
  - _Active Submissions_ (Trend sparkline showing recent uploads).
  - _Reviews Pending_ (Highlighted in amber if approaching deadline).
  - _Registrations / Revenue_ (Progress bar towards target).
- **Main Content Area (Split 2/3 and 1/3):**
  - **Left Column (Actionable Data):**
    - **Recent Submissions Table:** Title, Track, Corresponding Author, Status Badge, Action (View).
    - **Reviewer Status:** A compact list showing reviewers who are lagging behind on assignments.
  - **Right Column (Insights & Team):**
    - **Upcoming Deadlines:** A timeline component showing phase transitions (e.g., "Camera-Ready Deadline in 3 days").
    - **Team Activity:** Recent audit log events (e.g., "Alice assigned 5 papers to Bob").

**Organizer Navigation Tabs:**

1.  **Overview:** The dashboard described above.
2.  **Submissions:** Advanced data table with robust filtering (by Track, Status, Decision), bulk actions (Assign, Reject), and export capabilities.
3.  **Peer Review:** Bidding status, COI matrices, and assignment interfaces.
4.  **Registrations & Payments:** Financial ledger, student verification queue, and refund processing.
5.  **Settings:** Phase windows, fee schedules, blinding modes.

### 4.2. Participant / Author Dashboard

**Goal:** Reduce anxiety for authors by making the status of their papers and required actions crystal clear.

- **Top Metrics Row:**
  - _My Submissions_ (Count).
  - _Action Required_ (e.g., "1 Camera-Ready upload pending").
  - _Payment Status_ (Clear Paid/Unpaid indicator).
- **Main Content Area:**
  - **My Papers (Primary Focus):** A visually rich card layout or clean table. Each paper shows:
    - Paper ID & Title.
    - Current Phase (e.g., "Under Review").
    - A prominent **Call to Action** if needed (e.g., "Upload Camera-Ready", "Pay Registration Fee").
  - **Schedule / Sessions:** A clean agenda view showing the dates, times, and rooms for their accepted presentations.
- **Side Panel:**
  - **Important Dates:** Conference timeline highlighting when decisions will be announced.

**Participant Navigation Tabs:**

1.  **Dashboard:** Overview.
2.  **My Submissions:** Detailed view of papers, upload interfaces (drag-and-drop zones), and rebuttal editors.
3.  **Registration:** The payment flow, invoice downloads, and student ID upload area.
4.  **Schedule:** Personalized itinerary.

### 4.3. Reviewer Dashboard

**Goal:** A distraction-free workspace optimized for reading and evaluating academic papers.

- **Top Metrics Row:**
  - _Assigned Papers_ (Total).
  - _Completed Reviews_ (Progress bar: e.g., 4/5 completed).
  - _Days until Deadline_ (Urgency indicator).
- **Main Content Area:**
  - **Action Queue:** A prioritized list of papers needing review.
    - Columns: Paper ID (Blinded), Track, Due Date, Status (Not Started, Draft, Submitted), Action (Start Review).
  - **Bidding & COI Area (If phase is active):** A dedicated section to swipe/click through papers to bid (Yes/Maybe/No) and declare Conflicts of Interest.
- **Review Editor Interface (Sub-page):**
  - Split-screen design: PDF viewer on the left, Review Form (Scores, Comments to Author, Comments to Chair) on the right. Autosave indicators prominently displayed.

---

## 5. UI/UX Best Practices & Polish

### 5.1. Data Tables (The Core UI Component)

Since conference management is highly tabular, tables must be flawless:

- **Sticky Headers:** Crucial for long lists of submissions.
- **Faceted Filtering:** Allow organizers to filter by multiple criteria (e.g., `Status: Under Review` AND `Track: AI`).
- **Row Actions:** Use an ellipsis (`...`) dropdown menu at the end of rows for secondary actions to keep the UI uncluttered.
- **Pagination:** Standardized cursor pagination at the bottom of every table.

### 5.2. Empty States & Onboarding

- Never show a blank white screen. If an author has no papers, show an illustration (e.g., a document graphic) with a clear primary button: "Submit your first paper".
- If an organizer has no active conferences, guide them to "Create a Conference" with a setup wizard.

### 5.3. Loading States & Feedback

- Use **Skeleton Loaders** matching the shape of the content rather than generic spinners. This reduces perceived latency.
- **Toast Notifications:** For all mutations (e.g., "Review saved successfully", "Payment captured"). Positioned bottom-right.

### 5.4. Forms & Validation

- **Inline Validation:** Show errors immediately as the user types (via Zod + React Hook Form), not just on submit.
- **Multi-step Wizards:** For complex actions like Paper Submission (Step 1: Details -> Step 2: Authors -> Step 3: Upload). Show a clear progress stepper at the top.

### 5.5. Accessibility (a11y)

- Full keyboard navigation support (Cmd+K menus, tab-trapping in modals).
- ARIA labels on all icon-only buttons.
- Color contrast ratios meeting WCAG AA standards (hence the shift away from low-contrast mint greens to deeper indigos and slates).
