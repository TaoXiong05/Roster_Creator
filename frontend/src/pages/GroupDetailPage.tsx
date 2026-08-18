import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Staff } from '../api/client';

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
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">小组成员</h1>
      <div>
        <h2 className="font-medium mb-2">组内成员</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between">
              <span>{m.name}</span>
              <button onClick={() => handleRemove(m.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                移出
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-medium mb-2">其他员工</h2>
        <ul className="divide-y">
          {available.map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between">
              <span>{s.name}</span>
              <button onClick={() => handleAdd(s.id)} className="border rounded px-3 py-1 text-sm">
                加入
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
