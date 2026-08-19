import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { btnDanger, btnPrimary, cardBase, inputBase, listRow } from '../styles/ui';

export function ShiftTemplateListPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const load = async () => setTemplates(await api.shiftTemplates.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.shiftTemplates.create({ name, startTime, endTime });
    setName('');
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.shiftTemplates.remove(id);
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="班次模板" description="设定好上下班时间，随时复用" />

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row`}>
          <input
            placeholder="名称（如：早班）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputBase} sm:flex-1`}
            required
          />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-label="开始时间"
            className={inputBase}
            required
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            aria-label="结束时间"
            className={inputBase}
            required
          />
          <button type="submit" className={`${btnPrimary} shrink-0`}>
            添加模板
          </button>
        </form>

        {templates.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有班次模板，先在上面添加一个吧。</p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id} className={listRow}>
                <span className="font-medium text-ink">
                  {t.name}（{t.startTime} - {t.endTime}）
                </span>
                <button onClick={() => handleDelete(t.id)} className={`${btnDanger} shrink-0`}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
