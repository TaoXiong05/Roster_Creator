import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { KangarooMascot } from './KangarooMascot';

const NAV_ITEMS = [
  { to: '/staff', label: '员工管理' },
  { to: '/groups', label: '小组管理' },
  { to: '/shift-templates', label: '班次模板' },
  { to: '/rosters', label: '排班表' },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-10 border-b border-tan/15 bg-sand/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
            <KangarooMascot variant="badge" animated={false} className="h-8 w-8" />
            <span className="hidden font-display text-base font-semibold text-ink sm:inline">Roster Creator</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-coral-deep/10 text-coral-deep' : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-10">{children}</main>
    </div>
  );
}
