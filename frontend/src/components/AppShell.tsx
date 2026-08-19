import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { useLanguage } from '../i18n/LanguageContext';
import { AmbientBackground } from './AmbientBackground';
import { KangarooMascot } from './KangarooMascot';
import { LanguageToggle } from './LanguageToggle';

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
  children?: NavItem[];
  separatorBefore?: boolean;
  icon?: ReactNode;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const NAV_ITEMS: NavItem[] = [
  {
    to: '/responsibilities',
    labelKey: 'nav.responsibilities',
    icon: (
      <svg {...iconProps}>
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    to: '/staff',
    labelKey: 'nav.staff',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
    children: [
      { to: '/staff', labelKey: 'nav.staffList', end: true },
      { to: '/staff/new', labelKey: 'nav.staffCreate' },
    ],
  },
  {
    to: '/groups',
    labelKey: 'nav.groups',
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
    labelKey: 'nav.shiftTemplates',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    to: '/rosters',
    labelKey: 'nav.rosters',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18" />
        <path d="M8 3v4M16 3v4" />
        <path d="m8.5 15 2.2 2.2L16 12.5" />
      </svg>
    ),
    children: [
      { to: '/rosters', labelKey: 'nav.rostersAll', end: true },
      { to: '/rosters/new', labelKey: 'nav.rosterCreate' },
    ],
  },
  { to: '/help', labelKey: 'nav.help', separatorBefore: true, icon: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.7-.9 1.3v.4" />
      <path d="M12 17h.01" />
    </svg>
  ) },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `relative flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition ${
    isActive ? 'bg-coral-deep/10 text-coral-deep' : 'text-ink-soft hover:bg-white/70 hover:text-ink'
  }`;
}

function childNavLinkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-[44px] items-center rounded-lg px-3 text-sm transition ${
    isActive ? 'font-medium text-coral-deep' : 'text-ink-soft/80 hover:text-ink'
  }`;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <>
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-1">
        <KangarooMascot variant="badge" animated={false} className="h-9 w-9" />
        <span className="font-display text-base font-semibold text-ink">Roster Creator</span>
      </Link>
      <nav className="mt-8 space-y-1">
        {NAV_ITEMS.map((item) => (
          <div key={item.to} className={item.separatorBefore ? 'mt-4 border-t border-tan/15 pt-4' : undefined}>
            <NavLink to={item.to} end={item.end} onClick={onNavigate} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-coral-deep" />
                  )}
                  <span className="shrink-0 opacity-80">{item.icon}</span>
                  {t(item.labelKey)}
                </>
              )}
            </NavLink>
            {item.children && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-tan/25 pl-3">
                {item.children.map((child) => (
                  <NavLink key={child.to} to={child.to} end={child.end} onClick={onNavigate} className={childNavLinkClass}>
                    {t(child.labelKey)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="mt-6">
        <LanguageToggle />
      </div>
    </>
  );
}

export function AppShell({
  children,
  width = 'default',
}: {
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
}) {
  const [open, setOpen] = useState(false);
  const { mounted: drawerMounted, visible: drawerVisible } = useTransitionPresence(open, 300);
  const { t } = useLanguage();

  const containerWidth =
    width === 'wide' ? 'max-w-7xl' : width === 'narrow' ? 'max-w-2xl' : 'max-w-4xl';

  return (
    <div className="min-h-screen bg-sand md:flex">
      <AmbientBackground subtle />

      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-tan/15 bg-sand/60 px-4 py-6 md:block">
        <SidebarContent />
      </aside>

      {/* mobile top bar */}
      <div className="flex items-center justify-between border-b border-tan/15 bg-sand/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <KangarooMascot variant="badge" animated={false} className="h-8 w-8" />
          <span className="font-display text-base font-semibold text-ink">Roster Creator</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            onClick={() => setOpen(true)}
            aria-label={t('nav.openMenu')}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-tan/30 text-ink-soft"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {drawerMounted && (
        <div className="fixed inset-0 z-20 md:hidden">
          <div
            className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ease-in-out ${
              drawerVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute inset-y-0 left-0 w-72 max-w-[80%] overflow-y-auto bg-sand px-4 py-6 shadow-warm transition-transform duration-300 ease-in-out ${
              drawerVisible ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                aria-label={t('nav.closeMenu')}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-tan/30 text-ink-soft"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 px-4 py-8 sm:px-6 md:px-10 md:py-10">
        <div className={`mx-auto ${containerWidth}`}>{children}</div>
      </main>
    </div>
  );
}
