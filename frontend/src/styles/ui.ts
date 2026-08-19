// Shared style tokens so every page reads as one system.
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-coral-deep px-4 py-2.5 text-sm font-semibold text-white shadow-warm-sm transition-all hover:-translate-y-0.5 hover:shadow-warm hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-warm-sm';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-tan/30 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:text-coral-deep';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100';

export const btnPillActive = 'rounded-full border border-coral-deep bg-coral-deep px-3 py-1.5 text-sm font-medium text-white transition';
export const btnPillInactive =
  'rounded-full border border-tan/30 bg-white/70 px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-coral/40 hover:text-ink';

export const inputBase =
  'w-full rounded-2xl border border-tan/30 bg-white/70 px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/40 outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30';

export const labelBase = 'mb-1.5 block text-xs font-semibold text-ink-soft';

export const cardBase = 'rounded-[24px] border border-tan/15 bg-white/70 p-5 shadow-warm-sm';

export const listRow =
  'flex flex-col gap-3 rounded-2xl border border-tan/15 bg-white/60 p-4 transition hover:bg-white/90 sm:flex-row sm:items-center sm:justify-between';

export const errorText = 'rounded-xl border border-coral-deep/30 bg-coral-deep/10 px-4 py-2.5 text-sm text-coral-deep';
export const successText = 'rounded-xl border border-eucalyptus/30 bg-eucalyptus/10 px-4 py-2.5 text-sm text-eucalyptus-dark';
