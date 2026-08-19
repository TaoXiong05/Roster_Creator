import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { btnDanger, btnSecondary, cardBase } from '../styles/ui';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<Staff[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);

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
    await api.groups.addMember(id, staffId);
    await load();
  };

  const handleRemove = async (staffId: string) => {
    if (!id) return;
    await api.groups.removeMember(id, staffId);
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-8">
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
                  <button onClick={() => handleRemove(m.id)} className={btnDanger}>
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
                  <button onClick={() => handleAdd(s.id)} className={btnSecondary}>
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
