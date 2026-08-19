import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { AmbientBackground } from './AmbientBackground';
import { KangarooMascot } from './KangarooMascot';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  children?: NavItem[];
  separatorBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/responsibilities', label: '职责模板' },
  {
    to: '/staff',
    label: '员工管理',
    children: [
      { to: '/staff', label: '员工列表', end: true },
      { to: '/staff/new', label: '创建员工' },
    ],
  },
  { to: '/groups', label: '小组管理' },
  { to: '/shift-templates', label: '班次模板' },
  {
    to: '/rosters',
    label: '排班表',
    children: [
      { to: '/rosters', label: '全部排班', end: true },
      { to: '/rosters/new', label: '创建排班' },
    ],
  },
  { to: '/help', label: '帮助', separatorBefore: true },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium transition ${
    isActive ? 'bg-coral-deep/10 text-coral-deep' : 'text-ink-soft hover:bg-white/60 hover:text-ink'
  }`;
}

function childNavLinkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-[44px] items-center rounded-lg px-3 text-sm transition ${
    isActive ? 'font-medium text-coral-deep' : 'text-ink-soft/80 hover:text-ink'
  }`;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
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
              {item.label}
            </NavLink>
            {item.children && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-tan/25 pl-3">
                {item.children.map((child) => (
                  <NavLink key={child.to} to={child.to} end={child.end} onClick={onNavigate} className={childNavLinkClass}>
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { mounted: drawerMounted, visible: drawerVisible } = useTransitionPresence(open, 300);

  return (
    <div className="min-h-screen bg-sand md:flex">
      <AmbientBackground />

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
        <button
          onClick={() => setOpen(true)}
          aria-label="打开导航菜单"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-tan/30 text-ink-soft"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
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
                aria-label="关闭导航菜单"
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
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
