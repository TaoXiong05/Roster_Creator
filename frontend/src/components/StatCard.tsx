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
