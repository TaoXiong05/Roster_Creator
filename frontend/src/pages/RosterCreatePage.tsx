import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ShiftTemplate, StaffGroup } from '../api/client';

interface ShiftRow {
  shiftTemplateId: string;
  headcount: number;
  requiredSkills: string;
  dates: string[];
}

function datesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function RosterCreatePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [groupId, setGroupId] = useState('');
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.groups.list().then(setGroups);
  }, []);

  const availableDates = datesBetween(dateRangeStart, dateRangeEnd);

  const addShiftRow = () => {
    if (templates.length === 0) return;
    setShifts((prev) => [...prev, { shiftTemplateId: templates[0].id, headcount: 1, requiredSkills: '', dates: [] }]);
  };

  const updateShiftRow = (index: number, patch: Partial<ShiftRow>) => {
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const toggleDate = (index: number, date: string) => {
    setShifts((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const dates = s.dates.includes(date) ? s.dates.filter((d) => d !== date) : [...s.dates, date];
        return { ...s, dates };
      })
    );
  };

  const removeShiftRow = (index: number) => {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const roster = await api.rosters.create({
        name,
        dateRangeStart,
        dateRangeEnd,
        groupId,
        shifts: shifts.map((s) => ({
          shiftTemplateId: s.shiftTemplateId,
          headcount: s.headcount,
          requiredSkills: s.requiredSkills
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          dates: s.dates,
        })),
      });
      navigate(`/rosters/${roster.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roster');
    }
  };

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">创建排班</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}
        <input
          placeholder="排班名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            aria-label="开始日期"
            className="border rounded px-3 py-2"
            required
          />
          <input
            type="date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            aria-label="结束日期"
            className="border rounded px-3 py-2"
            required
          />
        </div>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="员工小组"
          className="w-full border rounded px-3 py-2"
          required
        >
          <option value="">选择员工小组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">班次安排</h2>
            <button type="button" onClick={addShiftRow} className="border rounded px-3 py-1 text-sm">
              添加班次
            </button>
          </div>
          {shifts.map((shift, index) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={shift.shiftTemplateId}
                  onChange={(e) => updateShiftRow(index, { shiftTemplateId: e.target.value })}
                  aria-label="班次模板"
                  className="border rounded px-3 py-2 flex-1"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{t.startTime}-{t.endTime}）
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={shift.headcount}
                  onChange={(e) => updateShiftRow(index, { headcount: Number(e.target.value) })}
                  aria-label="所需人数"
                  className="border rounded px-3 py-2 w-24"
                />
                <input
                  placeholder="所需技能（逗号分隔）"
                  value={shift.requiredSkills}
                  onChange={(e) => updateShiftRow(index, { requiredSkills: e.target.value })}
                  className="border rounded px-3 py-2 flex-1"
                />
                <button type="button" onClick={() => removeShiftRow(index)} className="text-red-600 text-sm">
                  移除
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableDates.map((date) => (
                  <label key={date} className="text-xs flex items-center gap-1 border rounded px-2 py-1">
                    <input type="checkbox" checked={shift.dates.includes(date)} onChange={() => toggleDate(index, date)} aria-label={date} />
                    {date}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          创建排班
        </button>
      </form>
    </div>
  );
}
