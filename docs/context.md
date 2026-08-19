# Roster Creator — Project Context

> Auto-generated summary for reuse in future conversations. Last updated: 2026-08-20.

## Stack

- **Frontend:** React + Vite + TypeScript SPA, Tailwind CSS. Lives in `frontend/`.
- **Backend:** Express + TypeScript + Prisma ORM + PostgreSQL. Lives in `backend/`.
- **Repo:** `D:\claude\projects\Roster_Creator`, GitHub `TaoXiong05/Roster_Creator`.
- Commit only when the user explicitly asks — do not commit proactively.

## What the app does

A staff rostering tool: manage staff, groups, shift templates, responsibility templates, and build/publish rosters (with AI-assisted generation, CSV/PDF/ICS export, email sending).

## i18n system (English default, Chinese toggle)

Custom-built, no external library.

- `frontend/src/i18n/en.ts` / `zh.ts` — parallel nested dictionaries, namespaced (`common`, `nav`, `auth.*`, `dashboard.cards.*`, `staff`, `groups`, `shiftTemplates`, `responsibilities`, `rosters`, `dayShiftDialog`, `unavailableDatesDialog`, `preferenceFields`, `timeInput`, `mascot`, `weekdaysShort` array).
- `frontend/src/i18n/LanguageContext.tsx`:
  - `translate(language, key, vars?)` — dot-path lookup + `{{var}}` interpolation, falls back to English dict, returns raw key if missing anywhere.
  - `getDictionary(language)` — full dict object, used for structured data like `weekdaysShort`.
  - `LanguageProvider` — Context provider, `language` state persisted to `localStorage` key `roster-creator-language`, defaults to `'en'`. Reads/writes wrapped in try/catch (handles jsdom tests and private-browsing).
  - `useLanguage()` — hook returning `{ language, setLanguage, t }`.
  - `LanguageContext` has a **non-throwing default value** (English) instead of `undefined`, so components work correctly even when rendered outside a `<LanguageProvider>` (e.g. tests that don't wrap render calls).
- `frontend/src/components/LanguageToggle.tsx` — single button showing the *other* language's name as its label; placed in `AppShell` (sidebar + mobile bar) for authenticated pages, and top-right of `AuthLayout` for pre-auth pages.
- Localized punctuation: `common.listSeparator` (en: `', '`, zh: `'、'`) and `common.colon` (en: `': '`, zh: `'：'`) — added after a grep sweep found hardcoded Chinese punctuation leaking into English strings. Always use these instead of literal `、`/`：`.
- Every page/component is translated; user-entered data (names, custom shift template names, etc.) is correctly left untouched.
- `frontend/src/pages/HelpPage.tsx` is the one exception to the generic `t()` lookup pattern — it defines its own `CONTENT: Record<'en'|'zh', HelpContent>` object since its content is large structured prose (steps/features/FAQs), not simple string keys.

## Date formatting — DD/MM/YYYY everywhere (Australian convention)

- `frontend/src/utils/date.ts` — `formatDate(value: string): string`, parses `YYYY-MM-DD` or ISO datetime, returns `DD/MM/YYYY`. Pure display formatter; native `<input type="date">` fields are left alone (browser-controlled).
- Backend CSV/PDF exports use a local `toDisplayDate()` helper in `backend/src/rosters/exportRoutes.ts`, applied only to CSV/PDF row mapping.
- **ICS export is deliberately excluded** — must stay in iCalendar's compact numeric format (`YYYYMMDDTHHMMSS`) for RFC 5545 compliance. Regression test asserts `DTSTART:20260817T060000` is unchanged.

## Time input — auto-colon + analog clock picker

`frontend/src/components/TimeInput.tsx` — combines:
1. Auto-colon text input: `autoFormatTime(raw)` strips non-digits (`raw.replace(/\D/g, '').slice(0,4)`), inserts `:` after 2 digits.
2. A clock-icon button opening an absolutely-positioned popover with a two-ring 24-hour analog dial — `OUTER_HOURS = [0..11]` (outerRadius=82), `INNER_HOURS = [12..23]` (innerRadius=50), computed via a shared `polar(index, count, radius, center)` trig helper. Plus a single-ring 12-position 5-minute-increment minute dial (`MINUTES = [0,5,...,55]`).
   - Clicking an hour commits it and switches `mode` to `'minute'`.
   - Clicking a minute commits and closes.
   - Click-outside-to-close via `document.addEventListener('mousedown', ...)` scoped to a `containerRef`.
   - This was the first anchored-popover pattern in the app (previously only full-screen modal dialogs existed).
- ARIA labels use `timeInput.hourAria: 'Hour {{value}}'` / `minuteAria: 'Minute {{value}}'` — must stay distinct from the picker header's bare hour/minute display text (an earlier bare `'{{value}}'` label caused an accessible-name collision in tests).

## Unavailable-dates feature (Group Management)

- `frontend/src/components/UnavailableDatesDialog.tsx` — dialog to set a staff member's unavailable date ranges from within Group Detail.
- Unavailable ranges now display directly on the member row in `frontend/src/pages/GroupDetailPage.tsx` (prefix + formatted ranges joined by `common.listSeparator`).
- **Bug fixed:** `GET /groups/:id/members` in `backend/src/groups/membershipRoutes.ts` used `include: { staff: true }`, which omitted the nested `staff.preference` relation. This silently wiped a member's `unavailableShifts`/`preferredShifts`/hours settings whenever saved via the Group Detail dialog (the dialog defaulted missing fields to blank/zero). Fixed to `include: { staff: { include: { preference: true } } }`. Verified live: set `unavailableShifts` via Staff Edit, made an unrelated save from Group Detail, confirmed data survived post-fix (was wiped pre-fix).

## Testing notes / gotchas

- All 22 frontend test files were migrated from hardcoded Chinese assertions to English (the new default).
- Backend: 129/129 passing. Frontend: 86/86 passing. `tsc --noEmit` clean on both.
- For bulk Chinese→English string replacement in test files: read the file fully, then use a `python3 - <<'EOF'` heredoc via Bash with `(old, new)` pairs — terminal echo shows mojibake for CJK text due to console codepage, but the underlying UTF-8 file writes are correct. Always verify via `grep -n` on the actual file content afterward, not the terminal echo.
- Watch for loop-variable shadowing of `t()` (the translation function) — e.g. `.map((t) => ...)` on a templates array; rename the loop variable (e.g. `tpl`) to avoid confusion, even where JS scoping technically saves you.

## Session norms / working agreements

- Only commit/push when the user explicitly asks (established from an earlier request: "今天先到这里，commit and push").
- User communicates primarily in Chinese; feature requests should be translated into concrete implementation plans and verified both via automated tests and live browser checks before being considered done.
- When making UI changes, verify in-browser (not just type-check/tests) before reporting complete.
