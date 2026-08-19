import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { btnDanger, btnPrimary, btnSecondary } from '../styles/ui';

export function RosterListPage() {
  const [rosters, setRosters] = useState<RosterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<RosterListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setRosters(await api.rosters.list());

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
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
    <AppShell width="wide">
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

        {loading ? (
          <PageSkeleton />
        ) : rosters.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title="还没有排班表"
            description="创建一份排班，让 AI 帮你把班次分配到员工手上。"
            action={
              <Link to="/rosters/new" className={btnPrimary}>
                创建排班
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">排班名称</th>
                  <th className="hidden px-5 py-3 sm:table-cell">小组</th>
                  <th className="hidden px-5 py-3 md:table-cell">日期范围</th>
                  <th className="hidden px-5 py-3 lg:table-cell">班次</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {rosters.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/rosters/${r.id}`}
                          className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline"
                        >
                          {r.name}
                        </Link>
                        <StatusPill status={r.status} />
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-ink-soft sm:table-cell">{r.groupName}</td>
                    <td className="hidden px-5 py-3 font-mono text-xs text-ink-soft md:table-cell">
                      {r.dateRangeStart.slice(0, 10)} ~ {r.dateRangeEnd.slice(0, 10)}
                    </td>
                    <td className="hidden px-5 py-3 text-ink-soft lg:table-cell">{r.shiftCount} 个班次</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
