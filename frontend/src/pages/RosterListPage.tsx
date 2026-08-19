import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { btnPrimary, listRow } from '../styles/ui';

export function RosterListPage() {
  const [rosters, setRosters] = useState<RosterListItem[]>([]);

  useEffect(() => {
    api.rosters.list().then(setRosters);
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="排班表"
          description="创建、AI 自动分配、发布并发送"
          action={
            <Link to="/rosters/new" className={btnPrimary}>
              创建排班
            </Link>
          }
        />

        {rosters.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有排班表，点击右上角创建第一份吧。</p>
        ) : (
          <ul className="space-y-3">
            {rosters.map((r) => (
              <li key={r.id} className={listRow}>
                <div>
                  <Link to={`/rosters/${r.id}`} className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline">
                    {r.name}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">
                    {r.groupName} · {r.dateRangeStart.slice(0, 10)} ~ {r.dateRangeEnd.slice(0, 10)} · {r.shiftCount} 个班次
                  </p>
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
