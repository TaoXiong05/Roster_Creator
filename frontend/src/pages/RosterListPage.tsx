import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { btnDanger, btnPrimary, btnSecondary, listRow } from '../styles/ui';

export function RosterListPage() {
  const [rosters, setRosters] = useState<RosterListItem[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<RosterListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => api.rosters.list().then(setRosters);

  useEffect(() => {
    load();
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.rosters.remove(confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

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
                  <div className="flex items-center gap-2">
                    <Link to={`/rosters/${r.id}`} className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline">
                      {r.name}
                    </Link>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {r.groupName} · {r.dateRangeStart.slice(0, 10)} ~ {r.dateRangeEnd.slice(0, 10)} · {r.shiftCount} 个班次
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link to={`/rosters/${r.id}/edit`} className={btnSecondary}>
                    编辑时间和偏好
                  </Link>
                  <Link to={`/rosters/${r.id}`} className={btnPrimary}>
                    准备发布
                  </Link>
                  <button onClick={() => setConfirmTarget(r)} className={btnDanger}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除排班表"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
