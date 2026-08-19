import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { btnPrimary, btnDanger, btnSecondary, cardBase, errorText, inputBase, listRow } from '../styles/ui';

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
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="员工管理" description="记录姓名、邮箱、技能和可安排时间" />

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row`}>
          <input
            placeholder="姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputBase} sm:flex-1`}
            required
          />
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputBase} sm:flex-1`}
            required
          />
          <button type="submit" className={`${btnPrimary} shrink-0`}>
            添加员工
          </button>
        </form>

        {staff.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有员工，先在上面添加一位吧。</p>
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
                  <button onClick={() => handleDelete(s.id)} className={btnDanger}>
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
