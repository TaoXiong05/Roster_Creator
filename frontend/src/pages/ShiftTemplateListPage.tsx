import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftTemplate } from '../api/client';

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
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">班次模板</h1>
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="名称（如：早班）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          aria-label="开始时间"
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          aria-label="结束时间"
          className="border rounded px-3 py-2"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          添加模板
        </button>
      </form>
      <ul className="divide-y">
        {templates.map((t) => (
          <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              {t.name}（{t.startTime} - {t.endTime}）
            </span>
            <button onClick={() => handleDelete(t.id)} className="border rounded px-3 py-1 text-sm text-red-600">
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
