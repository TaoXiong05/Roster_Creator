import { useQuery } from '@tanstack/react-query';
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

  // Same query keys/functions used by StaffListPage, GroupListPage,
  // ShiftTemplateListPage and RosterListPage, so the cache is shared with
  // those pages instead of re-fetching every time the dashboard mounts.
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: () => api.staff.list() });
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: () => api.groups.list() });
  const shiftTemplatesQuery = useQuery({ queryKey: ['shift-templates'], queryFn: () => api.shiftTemplates.list() });
  const rostersQuery = useQuery({ queryKey: ['rosters'], queryFn: () => api.rosters.list() });

  const counts: Record<string, number | null> = {
    staff: staffQuery.data ? staffQuery.data.length : null,
    groups: groupsQuery.data ? groupsQuery.data.length : null,
    shiftTemplates: shiftTemplatesQuery.data ? shiftTemplatesQuery.data.length : null,
    rosters: rostersQuery.data ? rostersQuery.data.length : null,
  };

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
