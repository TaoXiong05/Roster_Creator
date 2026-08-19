import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { KangarooMascot } from '../components/KangarooMascot';
import { AppShell } from '../components/AppShell';

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
    title: '员工管理',
    description: '记录姓名、邮箱、技能和可安排时间',
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
    title: '小组管理',
    description: '把员工分组，一次性排进同一份班表',
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
    title: '班次模板',
    description: '设定好上下班时间，随时复用',
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
    title: '排班表',
    description: '创建、AI 自动分配、发布并发送',
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
  const name = user?.email ? user.email.split('@')[0] : '';

  return (
    <AppShell>
      <header className="flex items-center justify-between gap-4 motion-safe:animate-rise-in">
        <div className="flex items-center gap-4">
          <KangarooMascot variant="badge" animated className="h-16 w-16 shrink-0 md:h-[4.5rem] md:w-[4.5rem]" />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink md:text-2xl">你好呀，{name}</h1>
            <p className="mt-0.5 text-sm text-ink-soft">今天也要把团队安排得妥妥的</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="shrink-0 rounded-full border border-tan/30 px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-coral-deep/40 hover:text-coral-deep"
        >
          登出
        </button>
      </header>

      <nav className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Link
            key={card.to}
            to={card.to}
            className={`group relative flex flex-col gap-3 rounded-t-[28px] rounded-b-[18px] border ${card.border} bg-white/70 p-6 shadow-warm-sm transition-all hover:-translate-y-1 hover:shadow-warm motion-safe:animate-rise-in`}
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${card.accentLine} to-transparent`} />
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accentBg} ${card.accentText} transition-transform group-hover:-translate-y-0.5`}
            >
              {card.icon}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{card.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{card.description}</p>
            </div>
          </Link>
        ))}
      </nav>
    </AppShell>
  );
}
