import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, StaffGroup } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, listRow } from '../styles/ui';

export function GroupListPage() {
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');

  const load = async () => setGroups(await api.groups.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.groups.create(name);
    setName('');
    await load();
  };

  const handleRename = async (id: string, currentName: string) => {
    const next = window.prompt('新的小组名称', currentName);
    if (!next) return;
    await api.groups.rename(id, next);
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.groups.remove(id);
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="小组管理" description="把员工分组，一次性排进同一份班表" />

        <form onSubmit={handleCreate} className={`${cardBase} flex gap-3`}>
          <input
            placeholder="小组名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputBase} flex-1`}
            required
          />
          <button type="submit" className={`${btnPrimary} shrink-0`}>
            创建小组
          </button>
        </form>

        {groups.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有小组，先在上面创建一个吧。</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id} className={listRow}>
                <div>
                  <p className="font-medium text-ink">{g.name}</p>
                  <p className="text-sm text-ink-soft">{g.memberCount} 名成员</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/groups/${g.id}`} className={btnSecondary}>
                    管理成员
                  </Link>
                  <button onClick={() => handleRename(g.id, g.name)} className={btnSecondary}>
                    重命名
                  </button>
                  <button onClick={() => handleDelete(g.id)} className={btnDanger}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
