import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, StaffGroup } from '../api/client';

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
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">小组管理</h1>
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          placeholder="小组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          创建小组
        </button>
      </form>
      <ul className="divide-y">
        {groups.map((g) => (
          <li key={g.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-gray-500">{g.memberCount} 名成员</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/groups/${g.id}`} className="border rounded px-3 py-1 text-sm">
                管理成员
              </Link>
              <button onClick={() => handleRename(g.id, g.name)} className="border rounded px-3 py-1 text-sm">
                重命名
              </button>
              <button onClick={() => handleDelete(g.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
