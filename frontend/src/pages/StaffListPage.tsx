import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';

export function StaffListPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => setStaff(await api.staff.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.staff.create({ name, email, skills: [] });
      setName('');
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    }
  };

  const handleDelete = async (id: string) => {
    await api.staff.remove(id);
    await load();
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">员工管理</h1>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          添加员工
        </button>
      </form>
      <ul className="divide-y">
        {staff.map((s) => (
          <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">{s.email}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/staff/${s.id}`} className="border rounded px-3 py-1 text-sm">
                编辑
              </Link>
              <button onClick={() => handleDelete(s.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
