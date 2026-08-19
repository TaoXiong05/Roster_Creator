import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { btnPrimary, btnDanger, btnSecondary, listRow } from '../styles/ui';

export function StaffListPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setStaff(await api.staff.list());

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
    <AppShell>
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

        {staff.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有员工，点击右上角「创建员工」来添加一位吧。</p>
        ) : (
          <ul className="space-y-3">
            {staff.map((s) => (
              <li key={s.id} className={listRow}>
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-sm text-ink-soft">{s.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/staff/${s.id}`} className={btnSecondary}>
                    编辑
                  </Link>
                  <button onClick={() => setConfirmTarget(s)} className={btnDanger}>
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
        title="删除员工"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销，TA 在排班表中的分配记录也会一并移除。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
