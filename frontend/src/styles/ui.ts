// Shared style tokens so every page reads as one system.
// Semantic color roles:
//   coral      – brand / primary action
//   eucalyptus – success / published
//   red        – danger / destructive
//   tan/dusk   – brand accents on dashboards only
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-coral-deep px-4 py-2.5 text-sm font-semibold text-white shadow-warm-sm transition-all hover:-translate-y-0.5 hover:shadow-warm hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-warm-sm';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-tan/30 bg-white/85 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:text-coral-deep';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100';

export const btnPillActive = 'rounded-full border border-coral-deep bg-coral-deep px-3 py-1.5 text-sm font-medium text-white transition';
export const btnPillInactive =
  'rounded-full border border-tan/30 bg-white/85 px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-coral/40 hover:text-ink';
export const btnPillDanger = 'rounded-full border border-red-500 bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition';

export const inputBase =
  'w-full rounded-2xl border border-tan/30 bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/45 outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30';

export const labelBase = 'mb-1.5 block text-xs font-semibold text-ink';

export const cardBase = 'rounded-[24px] border border-tan/15 bg-white/85 p-6 shadow-warm-sm';

export const listRow =
  'flex flex-col gap-3 rounded-2xl border border-tan/15 bg-white/80 p-4 transition hover:bg-white sm:flex-row sm:items-center sm:justify-between';

export const errorText = 'rounded-xl border border-coral-deep/30 bg-coral-deep/10 px-4 py-2.5 text-sm text-coral-deep';
export const successText = 'rounded-xl border border-eucalyptus/30 bg-eucalyptus/10 px-4 py-2.5 text-sm text-eucalyptus-dark';

export const inputError =
  'w-full rounded-2xl border border-red-400 bg-red-50/60 px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/45 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200';
export const fieldErrorText = 'mt-1.5 text-xs font-medium text-red-600';

// Shared table shell used by every list page (Staff/Groups/Shift Templates/
// Responsibilities/Rosters) so the visual refresh only has to be defined once.
export const tableShell = 'overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm';
export const tableHeaderRow = 'border-b border-tan/15 bg-sand/60 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft';
export const tableHeaderCell = 'px-5 py-3.5';
export const tableCell = 'px-5 py-3.5';
export const tableRow = 'transition-colors hover:bg-sand/50';

// Multi-select list pattern: header/row checkboxes plus the bar that appears
// once at least one row is selected (Staff list, Group's available-staff list).
export const checkboxBase = 'h-4 w-4 rounded border-tan/40 accent-coral cursor-pointer';
export const bulkActionBar =
  'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-medium text-ink';
