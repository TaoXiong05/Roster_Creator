import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageSkeleton } from '../components/Skeleton';
import { btnPrimary, btnDanger, btnSecondary } from '../styles/ui';

export function StaffListPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStaff(await api.staff.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.staff.remove(confirmTarget.id);
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
          title="员工管理"
          description="查看、编辑和删除员工信息"
          action={
            <Link to="/staff/new" className={btnPrimary}>
              + 创建员工
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title="还没有员工"
            description="创建第一位员工，开始安排你的团队。"
            action={
              <Link to="/staff/new" className={btnPrimary}>
                + 创建员工
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">姓名</th>
                  <th className="hidden px-5 py-3 sm:table-cell">邮箱</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {staff.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                    <td className="hidden px-5 py-3 text-ink-soft sm:table-cell">{s.email}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/staff/${s.id}`} className={btnSecondary}>
                          编辑
                        </Link>
                        <button onClick={() => setConfirmTarget(s)} className={btnDanger}>
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
        title="删除员工"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销，TA 在排班表中的分配记录也会一并移除。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
