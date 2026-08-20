# Roster Creator UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the layout/spacing/component patterns from the `roster-redesign.design/` mockups to all 16 frontend pages, re-expressed entirely in the existing coral/tan/sand/eucalyptus/ink palette and Fredoka/Noto Sans SC fonts, with zero changes to routes, API calls, or data fields.

**Architecture:** Centralize the visual refresh into a small set of shared style tokens (`frontend/src/styles/ui.ts`) and shared components (`AppShell`, `PageHeader`, new `StatCard`) so most pages inherit the new look automatically through the constants they already import. Page-level tasks then do targeted, mechanical replacements of the few literal (non-shared) className strings each page still has, roll out in dependency order (shared primitives first), and are verified against the existing test suites plus a manual browser pass after every task.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind CSS, Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-20-ui-redesign-design.md](../specs/2026-08-20-ui-redesign-design.md)

## Global Constraints

- No new colors, no new font-family values. Every visual change must map to values already defined in `frontend/tailwind.config.js` (`coral`, `tan`, `sand`, `eucalyptus`, `dusk`, `ink`, `Fredoka`, `Noto Sans SC`) or to the existing radius/shadow utility classes already in use (`rounded-2xl`, `rounded-[24px]`, `shadow-warm`, `shadow-warm-sm`).
- No new routes, no new API calls beyond ones already used elsewhere in the app, no new Prisma fields, no backend changes at all.
- No new nav items, no search box, no notifications/messages, no week/month roster view toggle, no shift-swap interaction, no new staff fields (id number, gender, birthdate, nationality, social security, address, department, grade, join date, emergency contact).
- Every task must leave both test suites green: frontend (`cd frontend && npm test -- --run`, currently 86 passing across 22 files) and backend (`cd backend && npm test`, currently 129 passing) — backend should be unaffected by any task in this plan, so re-running it once at the end (Task 16) is sufficient; run frontend tests after every task.
- `tsc --noEmit` (`cd frontend && npx tsc --noEmit`) must stay clean after every task.
- The i18n system (`useLanguage()`/`t()`), DD/MM/YYYY date formatting (`utils/date.ts`), and the `TimeInput` clock picker are not touched by this plan except where a task explicitly adds a new translation key (called out in that task).
- Two existing test files assert exact class names — `frontend/src/components/__tests__/PreferenceFields.test.tsx` and `frontend/src/pages/__tests__/StaffEditPage.test.tsx`, both asserting `toHaveClass('bg-coral-deep')` / `not.toHaveClass('bg-coral-deep')` on responsibility/shift pill buttons. This plan never changes `btnPillActive`/`btnPillInactive` in `styles/ui.ts`, so these assertions are expected to keep passing untouched — if any task's diff touches them, that task must explain why and update the assertion in the same commit.

---

## Task 1: Shared style tokens — table shell + card padding

**Files:**
- Modify: `frontend/src/styles/ui.ts`

**Interfaces:**
- Produces: five new exported string constants — `tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` — consumed by every list-page task (7, 9c, 10, 11, 12, 13) and by the roster shift table in Task 14.
- Produces: `cardBase` keeps its name and shape but its padding value changes from `p-5` to `p-6`; every existing consumer (all pages that already `import { cardBase } from '../styles/ui'`) picks this up automatically with no per-file edit required.

Six list/table pages in the current codebase (`StaffListPage.tsx`, `GroupListPage.tsx`, `GroupDetailPage.tsx`, `ShiftTemplateListPage.tsx`, `ResponsibilityListPage.tsx`, `RosterListPage.tsx`) each hardcode the identical table wrapper/header/row classes inline instead of importing a shared constant. This task extracts those into `styles/ui.ts` so later page tasks become one-line import + replace operations instead of raw Tailwind edits, and so the visual refresh (slightly larger row padding, softer header background, tighter uppercase tracking) only has to be decided once.

- [ ] **Step 1: Read the current file**

Read `frontend/src/styles/ui.ts` in full (already read during planning — current content is 40 lines, ending with `inputError` and `fieldErrorText`).

- [ ] **Step 2: Bump `cardBase` padding**

Edit (old → new, exact string match):
```ts
export const cardBase = 'rounded-[24px] border border-tan/15 bg-white/85 p-5 shadow-warm-sm';
```
→
```ts
export const cardBase = 'rounded-[24px] border border-tan/15 bg-white/85 p-6 shadow-warm-sm';
```

- [ ] **Step 3: Add the table token constants**

Append at the end of the file:
```ts

// Shared table shell used by every list page (Staff/Groups/Shift Templates/
// Responsibilities/Rosters) so the visual refresh only has to be defined once.
export const tableShell = 'overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm';
export const tableHeaderRow = 'border-b border-tan/15 bg-sand/60 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft';
export const tableHeaderCell = 'px-5 py-3.5';
export const tableCell = 'px-5 py-3.5';
export const tableRow = 'transition-colors hover:bg-sand/50';
```

- [ ] **Step 4: Run the frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: all 86 tests across 22 files still pass (this file has no direct tests; this run is a regression check because `cardBase`'s padding change touches every page that imports it).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/ui.ts
git commit -m "style: add shared table tokens and widen card padding"
```

---

## Task 2: AppShell — sidebar and mobile topbar polish

**Files:**
- Modify: `frontend/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: no new props, no new i18n keys. `AppShell`'s public signature (`{ children, width }`) is unchanged.
- Produces: nothing new consumed by later tasks — this is a leaf visual change.

The current sidebar (`aside` at line 173) uses `px-4 py-6`; nav items use `space-y-1` with `min-h-[44px]` rows. This task widens the sidebar's internal padding and nav rhythm slightly (matching the mockup's more generous vertical breathing room) without touching the nav item list, icons, routes, or the mobile drawer's open/close behavior.

- [ ] **Step 1: Widen desktop sidebar padding**

Edit (`frontend/src/components/AppShell.tsx`, exact string match):
```tsx
      <aside className="hidden w-64 shrink-0 border-r border-tan/15 bg-sand/60 px-4 py-6 md:block">
```
→
```tsx
      <aside className="hidden w-64 shrink-0 border-r border-tan/15 bg-sand/60 px-5 py-7 md:block">
```

- [ ] **Step 2: Widen nav item vertical rhythm**

Edit:
```tsx
      <nav className="mt-8 space-y-1">
```
→
```tsx
      <nav className="mt-8 space-y-1.5">
```

- [ ] **Step 3: Soften the active-item indicator bar for a subtler look**

Edit:
```tsx
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-coral-deep" />
```
→
```tsx
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-coral-deep" />
```

- [ ] **Step 4: Widen mobile top bar padding to match**

Edit:
```tsx
      <div className="flex items-center justify-between border-b border-tan/15 bg-sand/90 px-4 py-3 backdrop-blur md:hidden">
```
→
```tsx
      <div className="flex items-center justify-between border-b border-tan/15 bg-sand/90 px-5 py-3.5 backdrop-blur md:hidden">
```

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: 86/86 still pass — `App.test.tsx` and every page test render through `AppShell`, so this is the main regression surface for this task.

- [ ] **Step 6: Manual browser check**

Start the dev server (`cd frontend && npm run dev`), open `/dashboard`, confirm the sidebar renders with the wider padding and no layout overflow at both desktop width and a narrow (< 768px) mobile width (use the browser's responsive/device toolbar or resize the window). Confirm the mobile drawer still opens/closes via the hamburger button.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AppShell.tsx
git commit -m "style: widen AppShell sidebar and topbar spacing"
```

---

## Task 3: PageHeader polish

**Files:**
- Modify: `frontend/src/components/PageHeader.tsx`

**Interfaces:**
- Consumes: no new props. `PageHeader`'s signature (`{ title, description, action }`) is unchanged.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Widen the gap between title block and action slot, and loosen title tracking**

Edit (`frontend/src/components/PageHeader.tsx`, exact string match):
```tsx
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
```
→
```tsx
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-soft">{description}</p>}
      </div>
```

- [ ] **Step 2: Run the frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: 86/86 pass — `PageHeader` is used by every list/create/edit page, so this is a broad but low-risk regression check (no text content changed, only classes).

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PageHeader.tsx
git commit -m "style: polish PageHeader spacing and title tracking"
```

---

## Task 4: New StatCard component

**Files:**
- Create: `frontend/src/components/StatCard.tsx`
- Test: `frontend/src/components/__tests__/StatCard.test.tsx`

**Interfaces:**
- Produces: `StatCard` component with props `{ to: string; icon: ReactNode; label: string; value: number | string; accentBg: string; accentText: string; accentLine: string; border: string }`. Consumed by Task 6 (`DashboardPage.tsx`).

A small, purely presentational component — a clickable card showing an icon, a large value, and a label underneath, styled with the same accent-color props pattern `DashboardPage.tsx` already uses for its four nav cards (`accentBg`/`accentText`/`accentLine`/`border`), so Task 6 can reuse the existing per-card color assignments unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/__tests__/StatCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders the value, label, and links to the given route', () => {
    render(
      <MemoryRouter>
        <StatCard
          to="/staff"
          icon={<svg data-testid="icon" />}
          label="Staff"
          value={12}
          accentBg="bg-coral/15"
          accentText="text-coral-deep"
          accentLine="via-coral/50"
          border="border-coral/15"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /12/ })).toHaveAttribute('href', '/staff');
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run StatCard`
Expected: FAIL — `Cannot find module '../StatCard'`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/StatCard.tsx`:
```tsx
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  to: string;
  icon: ReactNode;
  label: string;
  value: number | string;
  accentBg: string;
  accentText: string;
  accentLine: string;
  border: string;
}

export function StatCard({ to, icon, label, value, accentBg, accentText, accentLine, border }: StatCardProps) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-4 rounded-[24px] border ${border} bg-white/85 p-6 shadow-warm-sm transition-all hover:-translate-y-1 hover:shadow-warm`}
    >
      <span className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${accentLine} to-transparent`} />
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accentBg} ${accentText} transition-transform group-hover:-translate-y-0.5`}
      >
        {icon}
      </span>
      <div>
        <p className="font-display text-2xl font-semibold text-ink">{value}</p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run StatCard`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/StatCard.tsx frontend/src/components/__tests__/StatCard.test.tsx
git commit -m "feat: add StatCard component"
```

---

## Task 5: Auth pages — AuthLayout + Login/Register/ForgotPassword/ResetPassword

**Files:**
- Modify: `frontend/src/components/AuthLayout.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/pages/ForgotPasswordPage.tsx`
- Modify: `frontend/src/pages/ResetPasswordPage.tsx`

**Interfaces:**
- Consumes: `AuthLayout`'s existing props (`headline`, `tagline`, `formEyebrow`, `formTitle`, `children`) — unchanged, so the four page files need no prop-shape changes, only className tweaks within their own form markup.
- Produces: nothing new consumed by later tasks.

All four auth pages already share `AuthLayout` and the shared `inputBase`/`btnPrimary`/`btnSecondary`/`errorText`/`fieldErrorText`/`inputError`/`labelBase` constants (confirmed by reading `LoginPage.tsx` and grepping the other three), so this task is scoped to `AuthLayout.tsx` itself plus one small, identical form-spacing tweak repeated in each of the four pages.

- [ ] **Step 1: Widen AuthLayout's form panel spacing**

Edit (`frontend/src/components/AuthLayout.tsx`, exact string match):
```tsx
      {/* form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm motion-safe:animate-rise-in" style={{ animationDelay: '150ms' }}>
          <p className="text-sm font-medium text-ink-soft">{formEyebrow}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{formTitle}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </div>
```
→
```tsx
      {/* form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm motion-safe:animate-rise-in" style={{ animationDelay: '150ms' }}>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">{formEyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink">{formTitle}</h1>
          <div className="mt-9">{children}</div>
        </div>
      </div>
```

- [ ] **Step 2: Widen the brand panel's mascot/text spacing**

Edit:
```tsx
        <div className="relative motion-safe:animate-hop-in">
          <div className="motion-safe:animate-bob">
            <KangarooMascot variant="hero" className="h-56 w-56 md:h-72 md:w-72 drop-shadow-2xl" />
          </div>
        </div>

        <h2 className="relative mt-6 max-w-sm text-2xl font-bold leading-snug text-white md:text-3xl">{headline}</h2>
```
→
```tsx
        <div className="relative motion-safe:animate-hop-in">
          <div className="motion-safe:animate-bob">
            <KangarooMascot variant="hero" className="h-56 w-56 md:h-72 md:w-72 drop-shadow-2xl" />
          </div>
        </div>

        <h2 className="relative mt-7 max-w-sm text-2xl font-bold leading-snug tracking-tight text-white md:text-3xl">{headline}</h2>
```

- [ ] **Step 3: Bump the form field gap in each of the four auth pages**

Each of these four files has its top-level `<form onSubmit={...} className="space-y-4">`. In each file, change `space-y-4` to `space-y-5` on that one `<form>` element only (do not touch `space-y-4` occurrences elsewhere, e.g. inside `ResetPasswordPage.tsx` if it has unrelated nested forms — verify by reading the file first that the edit targets the outer form).

Read each file first, then apply:
- `frontend/src/pages/LoginPage.tsx` line 42: `<form onSubmit={handleSubmit} className="space-y-4">` → `<form onSubmit={handleSubmit} className="space-y-5">`
- `frontend/src/pages/RegisterPage.tsx`: read the file, find its outer `<form onSubmit={...} className="space-y-4">`, apply the same `space-y-4` → `space-y-5` change.
- `frontend/src/pages/ForgotPasswordPage.tsx`: same — read, find the outer form, apply the same change.
- `frontend/src/pages/ResetPasswordPage.tsx`: same — read, find the outer form, apply the same change.

- [ ] **Step 4: Run the frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: 86/86 pass — `LoginPage.test.tsx`, `RegisterPage.test.tsx`, `ForgotPasswordPage.test.tsx`, `ResetPasswordPage.test.tsx`, and `App.test.tsx` all render through `AuthLayout`.

- [ ] **Step 5: Manual browser check**

Start the dev server, navigate to `/login`, `/register`, `/forgot-password`, and (with a dummy `?token=x` query) `/reset-password`. Confirm each renders correctly, the language toggle in the top-right still works, and form submission still works (log in with a test account if one exists, or just confirm the error path renders on bad credentials).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AuthLayout.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/ForgotPasswordPage.tsx frontend/src/pages/ResetPasswordPage.tsx
git commit -m "style: polish auth pages spacing and typography"
```

---

## Task 6: Dashboard — wire StatCard into DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/pages/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `StatCard` from Task 4 (`{ to, icon, label, value, accentBg, accentText, accentLine, border }`); `api.staff.list()`, `api.groups.list()`, `api.shiftTemplates.list()`, `api.rosters.list()` — all four already exist and are already called from `StaffListPage`, `GroupListPage`, `ShiftTemplateListPage`, and `RosterListPage` respectively, so this task adds no new API surface, only a new call site.
- Produces: nothing new consumed by later tasks.

The current `DashboardPage` renders four static nav cards (staff/groups/shift-templates/rosters) with no data fetched. This task keeps the same four destinations and the same icons/colors, but replaces the static cards with `StatCard`s showing the real count from each list endpoint, fetched on mount. While counts are loading, each card shows `'—'` instead of a number (no new loading-skeleton component needed).

- [ ] **Step 1: Read the current test file to know what must keep passing**

Read `frontend/src/pages/__tests__/DashboardPage.test.tsx` in full before editing anything, and identify every assertion that depends on the current card markup (e.g. `getByText` on card titles/descriptions, `getByRole('link')` on card hrefs). Keep every existing translation key the test asserts on (`dashboard.cards.staff.title`, etc.) — do not remove the `description` copy, only add a number above it.

- [ ] **Step 2: Add a failing test for the new count display**

Add to `frontend/src/pages/__tests__/DashboardPage.test.tsx` (adjust the mock shape to match however the file already mocks `api`; add `staff.list`, `groups.list`, `shiftTemplates.list`, `rosters.list` to the existing `vi.mock('../../api/client', ...)` block if not already present):
```tsx
it('shows real counts fetched from the four list endpoints', async () => {
  (api.staff.list as any).mockResolvedValue([{ id: '1' }, { id: '2' }]);
  (api.groups.list as any).mockResolvedValue([{ id: 'g1' }]);
  (api.shiftTemplates.list as any).mockResolvedValue([]);
  (api.rosters.list as any).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);

  renderPage();

  expect(await screen.findByText('2')).toBeInTheDocument(); // staff count
  expect(screen.getByText('1')).toBeInTheDocument(); // groups count
  expect(screen.getByText('0')).toBeInTheDocument(); // shift templates count
  expect(screen.getByText('3')).toBeInTheDocument(); // rosters count
});
```
(Match this to the file's existing `renderPage()` helper name and `api` import — read the file's existing tests first and follow the same render/mock pattern exactly.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm test -- --run DashboardPage`
Expected: FAIL — no counts are rendered yet.

- [ ] **Step 4: Update DashboardPage.tsx**

Replace the `cards` array's per-card `<Link>` rendering (the `<nav className="mt-10 grid ...">...</nav>` block) with `StatCard` usage, and add state + a `useEffect` fetching the four counts. Full replacement of the file's body from the `cards` array through the end of the component:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { KangarooMascot } from '../components/KangarooMascot';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { api } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const cards = [
  {
    to: '/staff',
    cardKey: 'staff' as const,
    accentBg: 'bg-coral/15',
    accentText: 'text-coral-deep',
    accentLine: 'via-coral/50',
    border: 'border-coral/15',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    to: '/groups',
    cardKey: 'groups' as const,
    accentBg: 'bg-eucalyptus/15',
    accentText: 'text-eucalyptus-dark',
    accentLine: 'via-eucalyptus/50',
    border: 'border-eucalyptus/15',
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9" r="3" />
        <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
        <path d="M15.5 14.8c2.6.3 4.5 2.3 4.5 5.2" />
      </svg>
    ),
  },
  {
    to: '/shift-templates',
    cardKey: 'shiftTemplates' as const,
    accentBg: 'bg-tan/20',
    accentText: 'text-tan',
    accentLine: 'via-tan/50',
    border: 'border-tan/20',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    to: '/rosters',
    cardKey: 'rosters' as const,
    accentBg: 'bg-dusk/15',
    accentText: 'text-dusk',
    accentLine: 'via-dusk/50',
    border: 'border-dusk/15',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18" />
        <path d="M8 3v4M16 3v4" />
        <path d="m8.5 15 2.2 2.2L16 12.5" />
      </svg>
    ),
  },
];

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const name = user?.email ? user.email.split('@')[0] : '';
  const [counts, setCounts] = useState<Record<string, number | null>>({
    staff: null,
    groups: null,
    shiftTemplates: null,
    rosters: null,
  });

  useEffect(() => {
    api.staff.list().then((list) => setCounts((prev) => ({ ...prev, staff: list.length })));
    api.groups.list().then((list) => setCounts((prev) => ({ ...prev, groups: list.length })));
    api.shiftTemplates.list().then((list) => setCounts((prev) => ({ ...prev, shiftTemplates: list.length })));
    api.rosters.list().then((list) => setCounts((prev) => ({ ...prev, rosters: list.length })));
  }, []);

  return (
    <AppShell>
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <span className="motion-safe:animate-sunburst-in pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-coral/50 via-tan/35 to-eucalyptus/35 blur-xl" />
            <KangarooMascot
              variant="badge"
              animated
              className="motion-safe:animate-hop-in h-16 w-16 md:h-[4.5rem] md:w-[4.5rem]"
            />
          </div>
          <div className="motion-safe:animate-rise-in" style={{ animationDelay: '220ms' }}>
            <h1 className="font-display text-xl font-semibold text-ink md:text-2xl">{t('dashboard.greeting', { name })}</h1>
            <p className="mt-0.5 text-sm text-ink-soft">{t('dashboard.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="motion-safe:animate-rise-in flex min-h-[44px] shrink-0 items-center rounded-full border border-tan/30 px-4 text-sm font-medium text-ink-soft transition hover:border-coral-deep/40 hover:text-coral-deep"
          style={{ animationDelay: '320ms' }}
        >
          {t('dashboard.logout')}
        </button>
      </header>

      <nav className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <div key={card.to} className="motion-safe:animate-rise-in" style={{ animationDelay: `${480 + i * 80}ms` }}>
            <StatCard
              to={card.to}
              icon={card.icon}
              label={t(`dashboard.cards.${card.cardKey}.title`)}
              value={counts[card.cardKey] ?? '—'}
              accentBg={card.accentBg}
              accentText={card.accentText}
              accentLine={card.accentLine}
              border={card.border}
            />
          </div>
        ))}
      </nav>
    </AppShell>
  );
}
```

Note this drops the `dashboard.cards.*.description` text from the visible card (StatCard has no description slot) — before applying this step, re-check Step 1's test file: if any test asserts on `dashboard.cards.staff.description` text being visible, do not silently drop it. Instead extend `StatCard` (Task 4) with an optional `description?: string` prop rendered under the label, and pass `t(\`dashboard.cards.${card.cardKey}.description\`)` through here, so no existing translation-key assertion breaks.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test -- --run DashboardPage`
Expected: PASS, including the new counts test from Step 2.

- [ ] **Step 6: Run the full frontend suite and type-check**

Run: `cd frontend && npm test -- --run && npx tsc --noEmit`
Expected: 86+ tests pass (86 plus the new StatCard test from Task 4 and the new Dashboard test from this task), no type errors.

- [ ] **Step 7: Manual browser check**

Start the dev server, log in, land on `/dashboard`, confirm all four cards show real counts matching what's on the corresponding list pages, and that clicking each card still navigates to the right route.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/__tests__/DashboardPage.test.tsx
git commit -m "feat: show real counts on dashboard cards via StatCard"
```

---

## Task 7: StaffListPage — table shell tokens

**Files:**
- Modify: `frontend/src/pages/StaffListPage.tsx`

**Interfaces:**
- Consumes: `tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` from Task 1.

- [ ] **Step 1: Add the import**

Edit line 11:
```tsx
import { btnPrimary, btnDanger, btnSecondary } from '../styles/ui';
```
→
```tsx
import { btnPrimary, btnDanger, btnSecondary, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';
```

- [ ] **Step 2: Replace the table wrapper**

Edit:
```tsx
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('staff.nameHeader')}</th>
                  <th className="hidden px-5 py-3 sm:table-cell">{t('staff.emailHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('staff.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {staff.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                    <td className="hidden px-5 py-3 text-ink-soft sm:table-cell">{s.email}</td>
                    <td className="px-5 py-3">
```
→
```tsx
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('staff.nameHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('staff.emailHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('staff.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {staff.map((s) => (
                  <tr key={s.id} className={tableRow}>
                    <td className={`${tableCell} font-medium text-ink`}>{s.name}</td>
                    <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{s.email}</td>
                    <td className={tableCell}>
```

- [ ] **Step 3: Run the frontend test suite**

Run: `cd frontend && npm test -- --run StaffListPage`
Expected: PASS — no text or structural changes, only classes.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StaffListPage.tsx
git commit -m "style: apply table tokens to StaffListPage"
```

---

## Task 8: StaffCreatePage — two-step wizard

**Files:**
- Modify: `frontend/src/pages/StaffCreatePage.tsx`
- Modify: `frontend/src/pages/__tests__/StaffCreatePage.test.tsx`
- Modify: `frontend/src/i18n/en.ts`
- Modify: `frontend/src/i18n/zh.ts`

**Interfaces:**
- Consumes: `PreferenceFields` (unchanged props), `cardBase`/`btnPrimary`/`btnSecondary`/`btnPillActive`/`btnPillInactive`/`inputBase`/`labelBase`/`errorText` (unchanged).
- Produces: nothing new consumed by later tasks.

Per the approved design decision, this page keeps its existing fields exactly as-is (name, email, responsibilities, then preferences) but presents them as a 2-step wizard instead of one long scrollable form with a collapsible preferences section. Step 1 = name/email/responsibilities. Step 2 = the `PreferenceFields` block. The existing "select at least one responsibility" validation moves from submit-time to the Step 1 → Step 2 transition (clicking "Next"), since responsibilities are a Step 1 field.

- [ ] **Step 1: Add the two new translation keys**

Edit `frontend/src/i18n/en.ts`, inside the `common` block (after `noResponsibilityTemplatesHint`):
```ts
    noResponsibilityTemplatesHint: 'No responsibility templates yet — create one first',
```
→
```ts
    noResponsibilityTemplatesHint: 'No responsibility templates yet — create one first',
    next: 'Next',
    back: 'Back',
```

Edit `frontend/src/i18n/en.ts`, inside the `staff` block (after `responsibilityRequiredError`):
```ts
    responsibilityRequiredError: 'Please select at least one responsibility',
```
→
```ts
    responsibilityRequiredError: 'Please select at least one responsibility',
    step1Title: 'Basic Info',
    stepIndicator: 'Step {{current}} of {{total}}',
```

Edit `frontend/src/i18n/zh.ts`, inside the `common` block (after `noResponsibilityTemplatesHint`):
```ts
    noResponsibilityTemplatesHint: '还没有设置职责模板，先去创建一个吧',
```
→
```ts
    noResponsibilityTemplatesHint: '还没有设置职责模板，先去创建一个吧',
    next: '下一步',
    back: '上一步',
```

Edit `frontend/src/i18n/zh.ts`, inside the `staff` block (find the line matching `responsibilityRequiredError`, its exact Chinese value — read the file first to copy it verbatim), and add directly after it:
```ts
    step1Title: '基本信息',
    stepIndicator: '第 {{current}} / {{total}} 步',
```

- [ ] **Step 2: Update the existing tests for the new step flow**

Edit `frontend/src/pages/__tests__/StaffCreatePage.test.tsx`. All three tests currently interact with Step 1 fields then immediately click "Add Staff" or interact with `PreferenceFields` buttons — after this change, `PreferenceFields` content only exists on Step 2, so a `Next` click must happen first, and `Add Staff` (the submit button) now only exists on Step 2.

Replace the file's three `it(...)` bodies (keep the `describe`/`beforeEach`/mock/`renderPage` scaffolding unchanged) with:
```tsx
  it('blocks advancing to step 2 with a clear message when no responsibility is selected', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please select at least one responsibility');
    expect(api.staff.create).not.toHaveBeenCalled();
  });

  it('creates a staff member with selected responsibilities', async () => {
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Staff' }));

    await waitFor(() =>
      expect(api.staff.create).toHaveBeenCalledWith({
        name: 'Bob',
        email: 'bob@b.com',
        responsibilityIds: ['resp-1'],
      })
    );
    expect(api.staff.updatePreference).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ unavailableShifts: [] })
    );
  });

  it('saves selected unavailable shifts alongside preferred shifts', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderPage();

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Unavailable Mon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Morning' }));

    await userEvent.click(screen.getByRole('button', { name: 'Add Staff' }));

    await waitFor(() =>
      expect(api.staff.updatePreference).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({ unavailableShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }] })
      )
    );
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test -- --run StaffCreatePage`
Expected: FAIL — `StaffCreatePage` doesn't have a "Next" button or step logic yet.

- [ ] **Step 4: Rewrite StaffCreatePage.tsx with step state**

Replace the full file content:
```tsx
import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { PreferenceFields } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import {
  btnPrimary,
  btnSecondary,
  btnPillActive,
  btnPillInactive,
  cardBase,
  errorText,
  inputBase,
  labelBase,
} from '../styles/ui';

export function StaffCreatePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [responsibilityIds, setResponsibilityIds] = useState<string[]>([]);
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(40);
  const [hoursPeriod, setHoursPeriod] = useState<HoursPeriod>('weekly');
  const [hoursUnit, setHoursUnit] = useState<HoursUnit>('hours');
  const [preferredShifts, setPreferredShifts] = useState<PreferredShift[]>([]);
  const [activeWeekday, setActiveWeekday] = useState<number | null>(null);
  const [unavailableShifts, setUnavailableShifts] = useState<PreferredShift[]>([]);
  const [unavailableActiveWeekday, setUnavailableActiveWeekday] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.responsibilities.list().then(setResponsibilities);
  }, []);

  const toggleResponsibility = (id: string) => {
    setResponsibilityIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const toggleShift = (day: number, shiftTemplateId: string) => {
    setPreferredShifts((prev) =>
      prev.some((p) => p.weekday === day && p.shiftTemplateId === shiftTemplateId)
        ? prev.filter((p) => !(p.weekday === day && p.shiftTemplateId === shiftTemplateId))
        : [...prev, { weekday: day, shiftTemplateId }]
    );
  };

  const toggleUnavailableShift = (day: number, shiftTemplateId: string) => {
    setUnavailableShifts((prev) =>
      prev.some((p) => p.weekday === day && p.shiftTemplateId === shiftTemplateId)
        ? prev.filter((p) => !(p.weekday === day && p.shiftTemplateId === shiftTemplateId))
        : [...prev, { weekday: day, shiftTemplateId }]
    );
  };

  const handleNext = () => {
    setError(null);
    if (responsibilityIds.length === 0) {
      setError(t('staff.responsibilityRequiredError'));
      return;
    }
    setStep(2);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await api.staff.create({ name, email, responsibilityIds });
      await api.staff.updatePreference(created.id, {
        preferredShifts,
        unavailableShifts,
        unavailableDateRanges: [],
        minHours,
        maxHours,
        hoursPeriod,
        hoursUnit,
      });
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-lg space-y-4">
        <BackLink to="/staff" label={t('staff.backToStaff')} />
        <PageHeader title={t('staff.createPageTitle')} description={t('staff.createPageDescription')} />

        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t('staff.stepIndicator', { current: step, total: 2 })}
        </p>

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        {step === 1 ? (
          <div className={`${cardBase} space-y-4`}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:flex-1">
                <label htmlFor="staff-name" className={labelBase}>
                  {t('staff.nameLabel')}
                </label>
                <input
                  id="staff-name"
                  placeholder={t('staff.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputBase}
                  required
                />
              </div>
              <div className="sm:flex-1">
                <label htmlFor="staff-email" className={labelBase}>
                  {t('staff.emailLabel')}
                </label>
                <input
                  id="staff-email"
                  type="email"
                  placeholder={t('staff.emailLabel')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelBase}>{t('staff.responsibilityLabel')}</label>
              {responsibilities.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
                  <span>{t('common.noResponsibilityTemplatesHint')}</span>
                  <Link to="/responsibilities" className="font-medium text-coral-deep hover:underline">
                    {t('common.goSetUp')}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {responsibilities.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => toggleResponsibility(r.id)}
                      className={responsibilityIds.includes(r.id) ? btnPillActive : btnPillInactive}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={handleNext} className={`w-full gap-2 ${btnPrimary}`}>
              {t('common.next')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className={`${cardBase} space-y-4`}>
            <p className="font-display text-sm font-semibold text-ink">{t('staff.preferencesHeading')}</p>
            <PreferenceFields
              templates={templates}
              minHours={minHours}
              maxHours={maxHours}
              onMinHoursChange={setMinHours}
              onMaxHoursChange={setMaxHours}
              hoursPeriod={hoursPeriod}
              onHoursPeriodChange={setHoursPeriod}
              hoursUnit={hoursUnit}
              onHoursUnitChange={setHoursUnit}
              preferredShifts={preferredShifts}
              activeWeekday={activeWeekday}
              onSelectWeekday={setActiveWeekday}
              onToggleShift={toggleShift}
              unavailableShifts={unavailableShifts}
              unavailableActiveWeekday={unavailableActiveWeekday}
              onSelectUnavailableWeekday={setUnavailableActiveWeekday}
              onToggleUnavailableShift={toggleUnavailableShift}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className={btnSecondary}>
                {t('common.back')}
              </button>
              <button type="submit" disabled={creating} className={`flex-1 gap-2 ${btnPrimary}`}>
                {creating && <Spinner className="h-4 w-4" />}
                {t('staff.addStaffButton')}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
```

Note this drops the `useTransitionPresence` collapse/expand animation import and the `staff.collapse`/`staff.expandPreferences` translation keys' usage on this page (they remain defined in `en.ts`/`zh.ts` but are no longer referenced from this file — leave them in the dictionaries; do not delete them, since removing dictionary keys is out of scope for this plan and they cost nothing to keep).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test -- --run StaffCreatePage`
Expected: PASS.

- [ ] **Step 6: Run the full frontend suite and type-check**

Run: `cd frontend && npm test -- --run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Manual browser check**

Start the dev server, go to `/staff/new`, fill name/email, try clicking "Next" without picking a responsibility (confirm the error shows and step doesn't advance), pick a responsibility, click "Next" (confirm step 2's preferences UI appears), click "Back" (confirm step 1 state — name/email/responsibility — is preserved), go forward again and submit, confirm the new staff member appears on `/staff`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/StaffCreatePage.tsx frontend/src/pages/__tests__/StaffCreatePage.test.tsx frontend/src/i18n/en.ts frontend/src/i18n/zh.ts
git commit -m "feat: turn staff creation into a two-step wizard"
```

---

## Task 9: StaffEditPage — form card polish

**Files:**
- Modify: `frontend/src/pages/StaffEditPage.tsx`

**Interfaces:**
- Consumes: nothing new — this page has no table, only a form inside `cardBase` (already widened by Task 1).

This page needs no structural change beyond what Task 1's `cardBase` padding bump already gives it for free. The only edit is a small spacing polish to match Task 8's step-1 form field gap.

- [ ] **Step 1: Read the file to confirm current state**

Read `frontend/src/pages/StaffEditPage.tsx` (already read in full during planning — 197 lines).

- [ ] **Step 2: Widen the top field-row gap**

Edit (exact string match, note this page has a single-column field layout, not the two-column `sm:flex-row` layout `StaffCreatePage` has):
```tsx
          <div>
            <label className={labelBase}>{t('staff.nameLabel')}</label>
            <input placeholder={t('staff.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className={inputBase} required />
          </div>
          <div>
            <label className={labelBase}>{t('staff.emailLabel')}</label>
```
→
```tsx
          <div className="space-y-4">
            <div>
              <label className={labelBase}>{t('staff.nameLabel')}</label>
              <input placeholder={t('staff.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className={inputBase} required />
            </div>
            <div>
              <label className={labelBase}>{t('staff.emailLabel')}</label>
```

This introduces a new wrapping `<div className="space-y-4">` around the name and email fields — the matching closing `</div>` must be added right after the email field's closing `</div>` (before the `responsibilityLabel` block). Read the surrounding lines (127–142 in the pre-edit file) carefully and place the new closing tag correctly; verify with `npx tsc --noEmit` that JSX tags balance.

- [ ] **Step 3: Run the frontend test suite**

Run: `cd frontend && npm test -- --run StaffEditPage`
Expected: PASS — this file has `toHaveClass('bg-coral-deep')` assertions (per Global Constraints) on responsibility pill buttons; this task does not touch `btnPillActive`/`btnPillInactive` or the responsibility buttons, so they must still pass unchanged.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (this step also confirms the JSX from Step 2 is balanced).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StaffEditPage.tsx
git commit -m "style: tighten StaffEditPage field grouping"
```

---

## Task 10: Groups — GroupListPage + GroupDetailPage

**Files:**
- Modify: `frontend/src/pages/GroupListPage.tsx`
- Modify: `frontend/src/pages/GroupDetailPage.tsx`

**Interfaces:**
- Consumes: `tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` from Task 1.

- [ ] **Step 1: GroupListPage — add the import**

Edit line 12:
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';
```
→
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';
```

- [ ] **Step 2: GroupListPage — replace the table wrapper**

Edit:
```tsx
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('groups.groupNameHeader')}</th>
                  <th className="px-5 py-3">{t('groups.memberCountHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('groups.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {groups.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3 font-medium text-ink">{g.name}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {g.memberCount} {t('groups.memberCountSuffix')}
                    </td>
                    <td className="px-5 py-3">
```
→
```tsx
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('groups.groupNameHeader')}</th>
                  <th className={tableHeaderCell}>{t('groups.memberCountHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('groups.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {groups.map((g) => (
                  <tr key={g.id} className={tableRow}>
                    <td className={`${tableCell} font-medium text-ink`}>{g.name}</td>
                    <td className={`${tableCell} text-ink-soft`}>
                      {g.memberCount} {t('groups.memberCountSuffix')}
                    </td>
                    <td className={tableCell}>
```

- [ ] **Step 3: GroupDetailPage — add the import**

Edit line 12:
```tsx
import { btnDanger, btnSecondary, cardBase } from '../styles/ui';
```
→
```tsx
import { btnDanger, btnSecondary, cardBase, tableRow } from '../styles/ui';
```

- [ ] **Step 4: GroupDetailPage — widen both table wrappers and row padding**

This page's two tables (members, available staff) don't have a `<thead>`, so only `tableRow` applies (there is no `tableHeaderRow`/`tableHeaderCell` to swap in). Edit the members table wrapper and rows:
```tsx
            <div className="overflow-hidden rounded-2xl border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {members.map((m) => {
                    const unavailableRanges = m.preference?.unavailableDateRanges ?? [];
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-sand/60">
                        <td className="px-4 py-2.5 text-ink">
```
→
```tsx
            <div className="overflow-hidden rounded-[24px] border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {members.map((m) => {
                    const unavailableRanges = m.preference?.unavailableDateRanges ?? [];
                    return (
                      <tr key={m.id} className={tableRow}>
                        <td className="px-5 py-3 text-ink">
```

And the matching action cell right below it:
```tsx
                        <td className="px-4 py-2.5 text-right">
```
→
```tsx
                        <td className="px-5 py-3 text-right">
```

Then the available-staff table (second table in the file):
```tsx
            <div className="overflow-hidden rounded-2xl border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {available.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-sand/60">
                      <td className="px-4 py-2.5 text-ink">{s.name}</td>
                      <td className="px-4 py-2.5 text-right">
```
→
```tsx
            <div className="overflow-hidden rounded-[24px] border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {available.map((s) => (
                    <tr key={s.id} className={tableRow}>
                      <td className="px-5 py-3 text-ink">{s.name}</td>
                      <td className="px-5 py-3 text-right">
```

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test -- --run GroupListPage GroupDetailPage`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/GroupListPage.tsx frontend/src/pages/GroupDetailPage.tsx
git commit -m "style: apply table tokens to Groups pages"
```

---

## Task 11: Templates — ShiftTemplateListPage + ResponsibilityListPage

**Files:**
- Modify: `frontend/src/pages/ShiftTemplateListPage.tsx`
- Modify: `frontend/src/pages/ResponsibilityListPage.tsx`

**Interfaces:**
- Consumes: `tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` from Task 1.

- [ ] **Step 1: ShiftTemplateListPage — add the import**

Edit line 12:
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';
```
→
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';
```

- [ ] **Step 2: ShiftTemplateListPage — replace the table wrapper, header, and non-editing row**

Edit:
```tsx
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('shiftTemplates.nameHeader')}</th>
                  <th className="px-5 py-3">{t('shiftTemplates.startHeader')}</th>
                  <th className="px-5 py-3">{t('shiftTemplates.endHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('shiftTemplates.actionsHeader')}</th>
                </tr>
              </thead>
```
→
```tsx
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('shiftTemplates.nameHeader')}</th>
                  <th className={tableHeaderCell}>{t('shiftTemplates.startHeader')}</th>
                  <th className={tableHeaderCell}>{t('shiftTemplates.endHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('shiftTemplates.actionsHeader')}</th>
                </tr>
              </thead>
```

Then the non-editing row (the `else` branch of the `editingId === tpl.id ? (...) : (...)` ternary):
```tsx
                    <tr key={tpl.id} className="transition-colors hover:bg-sand/70">
                      <td className="px-5 py-3 font-medium text-ink">{tpl.name}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{tpl.startTime}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{tpl.endTime}</td>
                      <td className="px-5 py-3">
```
→
```tsx
                    <tr key={tpl.id} className={tableRow}>
                      <td className={`${tableCell} font-medium text-ink`}>{tpl.name}</td>
                      <td className={`${tableCell} font-mono text-ink-soft`}>{tpl.startTime}</td>
                      <td className={`${tableCell} font-mono text-ink-soft`}>{tpl.endTime}</td>
                      <td className={tableCell}>
```

Leave the editing row (`<tr key={tpl.id} className="bg-sand/60">` with `colSpan={4}`) unchanged — it's a distinct inline-edit state, not part of the shared table shell pattern.

- [ ] **Step 3: ResponsibilityListPage — add the import**

Edit line 11:
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';
```
→
```tsx
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';
```

- [ ] **Step 4: ResponsibilityListPage — replace the table wrapper, header, and non-editing row**

Edit:
```tsx
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('responsibilities.nameHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('responsibilities.actionsHeader')}</th>
                </tr>
              </thead>
```
→
```tsx
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('responsibilities.nameHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('responsibilities.actionsHeader')}</th>
                </tr>
              </thead>
```

Then the non-editing row:
```tsx
                    <tr key={r.id} className="transition-colors hover:bg-sand/70">
                      <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                      <td className="px-5 py-3">
```
→
```tsx
                    <tr key={r.id} className={tableRow}>
                      <td className={`${tableCell} font-medium text-ink`}>{r.name}</td>
                      <td className={tableCell}>
```

Leave the editing row (`<tr key={r.id} className="bg-sand/60">`) unchanged, same reasoning as Step 2.

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test -- --run ShiftTemplateListPage ResponsibilityListPage`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ShiftTemplateListPage.tsx frontend/src/pages/ResponsibilityListPage.tsx
git commit -m "style: apply table tokens to Templates pages"
```

---

## Task 12: RosterListPage — table shell tokens

**Files:**
- Modify: `frontend/src/pages/RosterListPage.tsx`

**Interfaces:**
- Consumes: `tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` from Task 1.

- [ ] **Step 1: Add the import**

Edit line 13:
```tsx
import { btnDanger, btnPrimary, btnSecondary } from '../styles/ui';
```
→
```tsx
import { btnDanger, btnPrimary, btnSecondary, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';
```

- [ ] **Step 2: Replace the table wrapper, header, and row**

Edit:
```tsx
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('rosters.nameHeader')}</th>
                  <th className="hidden px-5 py-3 sm:table-cell">{t('rosters.groupHeader')}</th>
                  <th className="hidden px-5 py-3 md:table-cell">{t('rosters.dateRangeHeader')}</th>
                  <th className="hidden px-5 py-3 lg:table-cell">{t('rosters.shiftsHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('rosters.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {rosters.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/rosters/${r.id}`}
                          className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline"
                        >
                          {r.name}
                        </Link>
                        <StatusPill status={r.status} />
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-ink-soft sm:table-cell">{r.groupName}</td>
                    <td className="hidden px-5 py-3 font-mono text-xs text-ink-soft md:table-cell">
                      {formatDate(r.dateRangeStart)} ~ {formatDate(r.dateRangeEnd)}
                    </td>
                    <td className="hidden px-5 py-3 text-ink-soft lg:table-cell">{r.shiftCount} {t('rosters.shiftCountSuffix')}</td>
                    <td className="px-5 py-3">
```
→
```tsx
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('rosters.nameHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('rosters.groupHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} md:table-cell`}>{t('rosters.dateRangeHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} lg:table-cell`}>{t('rosters.shiftsHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('rosters.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {rosters.map((r) => (
                  <tr key={r.id} className={tableRow}>
                    <td className={tableCell}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/rosters/${r.id}`}
                          className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline"
                        >
                          {r.name}
                        </Link>
                        <StatusPill status={r.status} />
                      </div>
                    </td>
                    <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{r.groupName}</td>
                    <td className={`hidden ${tableCell} font-mono text-xs text-ink-soft md:table-cell`}>
                      {formatDate(r.dateRangeStart)} ~ {formatDate(r.dateRangeEnd)}
                    </td>
                    <td className={`hidden ${tableCell} text-ink-soft lg:table-cell`}>{r.shiftCount} {t('rosters.shiftCountSuffix')}</td>
                    <td className={tableCell}>
```

- [ ] **Step 3: Run the frontend test suite**

Run: `cd frontend && npm test -- --run RosterListPage`
Expected: PASS.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RosterListPage.tsx
git commit -m "style: apply table tokens to RosterListPage"
```

---

## Task 13: RosterCreatePage — apply shared tokens

**Files:**
- Modify: `frontend/src/pages/RosterCreatePage.tsx`

**Interfaces:**
- Consumes: `cardBase` (padding already widened for free by Task 1 — this file uses `cardBase` at 5 call sites per the codebase read during planning, so no per-file edit needed for those).

This is the largest and most bespoke page in the app (a calendar-grid roster builder), and unlike the list pages it does not duplicate the `tableShell`/`tableHeaderRow` pattern — it has no `<table>`. Its visual refresh comes almost entirely for free from Task 1's `cardBase` change. This task's job is to read the file fully and apply the same two mechanical rules used everywhere else in this plan, only where they actually match.

- [ ] **Step 1: Read the full file**

Read `frontend/src/pages/RosterCreatePage.tsx` in full (confirm current line count and structure — it was last known to be several hundred lines with a calendar grid, per-day requirement editor, and AI-assignment trigger).

- [ ] **Step 2: Search for and convert any literal table-shell pattern**

Grep the file for the literal string `rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm`. If found (e.g. wrapping a list of shift requirements), replace that wrapper with `tableShell` (add the import from `../styles/ui` if not already present) following the same before/after pattern used in Tasks 7/10/11/12. If not found, skip this step — do not invent a table wrapper that doesn't exist.

- [ ] **Step 3: Search for and widen any literal row-hover pattern**

Grep the file for the literal string `hover:bg-sand/70` or `hover:bg-sand/60`. If found on a `<tr>` or list-row element, replace it with the `tableRow` constant (`transition-colors hover:bg-sand/50`) the same way. If not found, skip.

- [ ] **Step 4: Widen the calendar-cell requirement-summary line spacing, if present**

The plan's earlier session context notes this page renders a per-day requirement summary using `t('common.colon')` and `t('common.listSeparator')` inside each calendar cell. If the calendar cell wrapper uses a tight `gap-1`/`gap-0.5` or `p-1`/`p-1.5` class, widen it by one Tailwind step (`gap-1` → `gap-1.5`, `p-1.5` → `p-2`) for breathing room consistent with the rest of this plan's spacing bumps — but only if you can identify the exact cell wrapper class after reading the file; do not guess at a class that isn't there.

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test -- --run RosterCreatePage`
Expected: PASS — no text/structural changes, only classes.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual browser check**

Start the dev server, go to `/rosters/new`, pick a group and date range, confirm the calendar grid renders correctly, add a shift requirement to a day, confirm the summary line still reads correctly, and confirm the roster still creates successfully.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/RosterCreatePage.tsx
git commit -m "style: apply shared tokens to RosterCreatePage"
```

---

## Task 14: RosterDetailPage — table shell tokens

**Files:**
- Modify: `frontend/src/pages/RosterDetailPage.tsx`

**Interfaces:**
- Consumes: `tableShell`, `tableRow` from Task 1 (confirmed via grep during planning: line 197 has the literal wrapper `overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm`; `cardBase` is not used on this page).

- [ ] **Step 1: Read the full file**

Read `frontend/src/pages/RosterDetailPage.tsx` in full, paying attention to the table starting at line 197 (the roster's shift/assignment table) — confirm whether it has a `<thead>` with the standard header-row literal (`border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft`) and a row with a hover literal (`hover:bg-sand/70` or similar).

- [ ] **Step 2: Add the import**

Add `tableShell` (and `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow` if their literal patterns are found in Step 1) to this file's existing `import { ... } from '../styles/ui'` line (currently `import { btnPrimary, btnSecondary, errorText, inputBase, successText } from '../styles/ui';`).

- [ ] **Step 3: Replace the table wrapper at line 197**

Edit:
```tsx
        <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
```
→
```tsx
        <div className={tableShell}>
```

- [ ] **Step 4: Replace the header row and body row, if the standard literals are present**

If Step 1 found the standard header-row literal, replace it with `tableHeaderRow` (and its `<th>` cells' `px-5 py-3` variants with `tableHeaderCell`, same pattern as Task 12). If it found a row-hover literal, replace it with `tableRow`. If this table uses a different, bespoke row structure (e.g. because each row also contains the `${inputBase} lg:w-64 lg:shrink-0` staff-assignment dropdown seen at line 231), only change the row/cell wrapper classes — never touch the `inputBase`-based dropdown or the `t('rosters.headcountLabel', {...})` text content.

- [ ] **Step 5: Run the frontend test suite**

Run: `cd frontend && npm test -- --run RosterDetailPage`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual browser check**

Start the dev server, open an existing roster's detail page, confirm the shift/assignment table renders, confirm assigning/reassigning staff via the dropdown still works, confirm publish/save still works.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/RosterDetailPage.tsx
git commit -m "style: apply table tokens to RosterDetailPage"
```

---

## Task 15: HelpPage polish

**Files:**
- Modify: `frontend/src/pages/HelpPage.tsx`

**Interfaces:**
- Consumes: `cardBase` (padding already widened for free by Task 1 — confirmed via grep this file uses `cardBase` at 3 call sites: the numbered step cards, the feature cards, and the FAQ cards).

This page is a fully custom layout (numbered steps, feature grid, FAQ list) with no table and no other literal duplicated pattern from the earlier tasks. Its visual refresh is almost entirely automatic via Task 1. This task only widens the gap between the numbered-step marker and its card, matching the spacing bump used elsewhere in this plan.

- [ ] **Step 1: Read the full file**

Read `frontend/src/pages/HelpPage.tsx` in full (confirmed via grep during planning: `content.steps.map(...)` renders a numbered circle marker at `h-9 w-9` next to a `cardBase` card, joined by a `w-px flex-1 bg-tan/20` connector line, inside a `<li className="flex gap-4">`).

- [ ] **Step 2: Widen the step-row gap**

Edit (exact string match, confirmed from the grep output during planning):
```tsx
              <li key={step.title} className="flex gap-4">
```
→
```tsx
              <li key={step.title} className="flex gap-5">
```

- [ ] **Step 3: Run the frontend test suite**

Run: `cd frontend && npm test -- --run HelpPage`
Expected: PASS.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Start the dev server, open `/help` in both English and Chinese (use the language toggle), confirm the steps/features/FAQ sections all still render correctly with the wider gap.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HelpPage.tsx
git commit -m "style: widen HelpPage step spacing"
```

---

## Task 16: Full regression pass

**Files:** none (verification only)

**Interfaces:** none — this task only runs and reads output.

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npm test -- --run`
Expected: every test passes (86 original + the new `StatCard.test.tsx` from Task 4 + the new counts test in `DashboardPage.test.tsx` from Task 6).

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all 129 tests pass (this plan never touches backend code, so this is a final confirmation, not expected to catch anything).

- [ ] **Step 4: Full manual browser walkthrough**

Start the dev server, log in, and visit every one of the 16 pages in order, in both English and Chinese via the language toggle: `/login`, `/register`, `/forgot-password`, `/dashboard`, `/staff`, `/staff/new`, `/staff/:id` (edit an existing staff member), `/groups`, `/groups/:id`, `/shift-templates`, `/responsibilities`, `/rosters`, `/rosters/new`, `/rosters/:id`, `/rosters/:id/edit`, `/help`. For each page, confirm: no visual overflow/breakage, no console errors, all buttons/links still perform their existing action (create/edit/delete/navigate), and the language toggle still switches all UI chrome correctly.

- [ ] **Step 5: Report**

Summarize the walkthrough (pages checked, any issues found and fixed) — no commit needed for this task since Step 1–3 are read-only verification and Step 4 is manual.

---

## Self-Review Notes

- **Spec coverage:** §4 (token mapping) → Task 1. §5 (shared component changes) → Tasks 1–4. §6 (rollout order) → Tasks 5–15, same batch order as the spec's 8 batches, split slightly finer where a batch's pages have distinct enough diffs to warrant their own task/review gate (Staff split into 3 tasks; Rosters split into 3 tasks). §7 (testing) → every task's steps plus Task 16. §8 (out of scope) → enforced via Global Constraints and explicitly called out in Tasks 6, 8, and 13 where the temptation to over-reach was highest (dashboard data-fetching, wizard step validation, and the large freeform RosterCreatePage).
- **Placeholder scan:** every step either names an exact file+line+before/after string pair, or (Tasks 13/14, the two files not fully read during planning) gives an exact grep pattern to search for and an exact replacement, with explicit "skip if not found — don't invent it" guardrails instead of a vague "restyle this file" instruction.
- **Type consistency:** `StatCard`'s prop names (`to`, `icon`, `label`, `value`, `accentBg`, `accentText`, `accentLine`, `border`) defined in Task 4 are used identically in Task 6's `DashboardPage.tsx` rewrite. The five `styles/ui.ts` token names defined in Task 1 (`tableShell`, `tableHeaderRow`, `tableHeaderCell`, `tableCell`, `tableRow`) are referenced by the exact same names in Tasks 7, 10, 11, 12, 13, 14.
