import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { btnDanger, btnSecondary, cardBase } from '../styles/ui';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<Staff[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    if (!id) return;
    const [memberList, staffList] = await Promise.all([api.groups.listMembers(id), api.staff.list()]);
    setMembers(memberList);
    setAllStaff(staffList);
  };

  useEffect(() => {
    load();
  }, [id]);

  const memberIds = new Set(members.map((m) => m.id));
  const available = allStaff.filter((s) => !memberIds.has(s.id));

  const handleAdd = async (staffId: string) => {
    if (!id) return;
    setPendingId(staffId);
    try {
      await api.groups.addMember(id, staffId);
      await load();
    } finally {
      setPendingId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!id || !confirmTarget) return;
    setRemoving(true);
    try {
      await api.groups.removeMember(id, confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <BackLink to="/groups" label="返回小组管理" />
        <PageHeader title="小组成员" />

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">组内成员</h2>
          {members.length === 0 ? (
            <p className="text-sm text-ink-soft">这个小组还没有成员。</p>
          ) : (
            <ul className="divide-y divide-tan/15">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-ink">{m.name}</span>
                  <button onClick={() => setConfirmTarget(m)} className={btnDanger}>
                    移出
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">其他员工</h2>
          {available.length === 0 ? (
            <p className="text-sm text-ink-soft">没有可添加的员工了。</p>
          ) : (
            <ul className="divide-y divide-tan/15">
              {available.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-ink">{s.name}</span>
                  <button onClick={() => handleAdd(s.id)} disabled={pendingId === s.id} className={`gap-2 ${btnSecondary}`}>
                    {pendingId === s.id && <Spinner className="h-4 w-4" />}
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="移出小组"
        message={`确定要把「${confirmTarget?.name ?? ''}」移出这个小组吗？`}
        confirmLabel="确认移出"
        loading={removing}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmRemove}
      />
    </AppShell>
  );
}
