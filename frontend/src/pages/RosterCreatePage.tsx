import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, RosterShiftInput, ShiftTemplate, StaffGroup } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { DayShiftDialog, DayShiftRow } from '../components/DayShiftDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { btnPrimary, btnSecondary, cardBase, errorText, fieldErrorText, inputBase, inputError, labelBase } from '../styles/ui';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const DAYS_PER_PAGE = 7;

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

function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function RosterCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [groupId, setGroupId] = useState('');
  const [hoursPerShift, setHoursPerShift] = useState(8);
  const [dayShifts, setDayShifts] = useState<Record<string, DayShiftRow[]>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const dateFieldError = error && /date/i.test(error) ? error : null;
  const groupFieldError = error && /group/i.test(error) ? error : null;
  const bannerError = error && !dateFieldError && !groupFieldError ? error : null;

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.groups.list().then(setGroups);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.rosters
      .get(id)
      .then((r) => {
        if (cancelled) return;
        setName(r.name);
        setDateRangeStart(r.dateRangeStart.slice(0, 10));
        setDateRangeEnd(r.dateRangeEnd.slice(0, 10));
        setGroupId(r.groupId);
        setHoursPerShift(r.hoursPerShift);
        const byDate: Record<string, DayShiftRow[]> = {};
        for (const rs of r.rosterShifts) {
          const date = rs.date.slice(0, 10);
          byDate[date] = [...(byDate[date] || []), { shiftTemplateId: rs.shiftTemplate.id, headcount: rs.headcount }];
        }
        setDayShifts(byDate);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load roster'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setPageIndex(0);
  }, [dateRangeStart, dateRangeEnd]);

  const availableDates = datesBetween(dateRangeStart, dateRangeEnd);
  const totalPages = Math.max(1, Math.ceil(availableDates.length / DAYS_PER_PAGE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageDates = availableDates.slice(
    clampedPageIndex * DAYS_PER_PAGE,
    clampedPageIndex * DAYS_PER_PAGE + DAYS_PER_PAGE
  );

  const addDayShift = (date: string, shiftTemplateId: string) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: [...(prev[date] || []), { shiftTemplateId, headcount: 1 }],
    }));
  };

  const removeDayShift = (date: string, index: number) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: (prev[date] || []).filter((_, i) => i !== index),
    }));
  };

  const updateDayShiftHeadcount = (date: string, index: number, value: number) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: (prev[date] || []).map((row, i) => (i === index ? { ...row, headcount: Math.max(0, value) } : row)),
    }));
  };

  const buildShifts = (): RosterShiftInput[] => {
    const shifts: RosterShiftInput[] = [];
    for (const date of availableDates) {
      for (const row of dayShifts[date] || []) {
        if (row.headcount <= 0) continue;
        shifts.push({ shiftTemplateId: row.shiftTemplateId, headcount: row.headcount, dates: [date], requiredSkills: [] });
      }
    }
    return shifts;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const shifts = buildShifts();
    if (shifts.length === 0) {
      setError('至少需要为一天设置一个班次的人数');
      return;
    }
    setCreating(true);
    try {
      const payload = { name, dateRangeStart, dateRangeEnd, groupId, hoursPerShift, shifts };
      if (isEdit) {
        await api.rosters.update(id!, payload);
        navigate(`/rosters/${id}`);
      } else {
        const roster = await api.rosters.create(payload);
        navigate(`/rosters/${roster.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roster');
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl space-y-4">
        <BackLink to="/rosters" label="返回排班表" />
        <PageHeader title={isEdit ? '编辑排班' : '创建排班'} />
        <form onSubmit={handleSubmit} className="space-y-6">
          {bannerError && (
            <p role="alert" className={errorText}>
              {bannerError}
            </p>
          )}

          <div className={`${cardBase} space-y-4`}>
            <div>
              <label className={labelBase}>排班名称</label>
              <input
                placeholder="排班名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputBase}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelBase}>开始日期</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  aria-label="开始日期"
                  className={dateFieldError ? inputError : inputBase}
                  required
                />
              </div>
              <div>
                <label className={labelBase}>结束日期</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  aria-label="结束日期"
                  className={dateFieldError ? inputError : inputBase}
                  required
                />
              </div>
            </div>
            {dateFieldError && (
              <p role="alert" className={fieldErrorText}>
                {dateFieldError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelBase}>员工小组</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  aria-label="员工小组"
                  className={groupFieldError ? inputError : inputBase}
                  required
                >
                  <option value="">选择员工小组</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {groupFieldError && (
                  <p role="alert" className={fieldErrorText}>
                    {groupFieldError}
                  </p>
                )}
              </div>
              <div>
                <label className={labelBase}>每个班次等于多少小时</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hoursPerShift}
                  onChange={(e) => setHoursPerShift(Number(e.target.value))}
                  aria-label="每个班次等于多少小时"
                  className={inputBase}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">班次安排</h2>
              <p className="mt-0.5 text-sm text-ink-soft">点击某一天，设置当天需要哪些班次、各需要几人。</p>
            </div>

            {templates.length === 0 ? (
              <div className={`${cardBase} flex flex-wrap items-center gap-2`}>
                <p className="text-sm text-ink-soft">还没有设置班次模板，需要先创建至少一个才能安排排班。</p>
                <Link to="/shift-templates" className={btnSecondary}>
                  去设置班次模板
                </Link>
              </div>
            ) : availableDates.length === 0 ? (
              <p className={`${cardBase} text-sm text-ink-soft`}>请先选择开始和结束日期。</p>
            ) : (
              <div className={`${cardBase} space-y-3`}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={clampedPageIndex === 0}
                    className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    ← 上一周
                  </button>
                  <span className="text-sm text-ink-soft">
                    第 {clampedPageIndex + 1} / {totalPages} 页
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={clampedPageIndex >= totalPages - 1}
                    className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    下一周 →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-2" style={{ minWidth: '42rem' }}>
                    {pageDates.map((date) => {
                      const rows = dayShifts[date] || [];
                      return (
                        <button
                          type="button"
                          key={date}
                          onClick={() => setEditingDate(date)}
                          className="min-h-[6.5rem] rounded-2xl border border-tan/15 bg-white/60 p-3 text-left transition hover:border-coral/40 hover:bg-white"
                        >
                          <p className="text-xs font-medium text-ink-soft">
                            {date.slice(5)} 周{weekdayLabel(date)}
                          </p>
                          {rows.length === 0 ? (
                            <p className="mt-2 text-xs text-ink-soft/60">点击设置班次</p>
                          ) : (
                            <ul className="mt-2 space-y-1">
                              {rows.map((row) => {
                                const t = templates.find((tpl) => tpl.id === row.shiftTemplateId);
                                return (
                                  <li key={row.shiftTemplateId} className="text-xs text-ink">
                                    {t?.name ?? '?'} × {row.headcount}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={creating} className={`gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            {isEdit ? '保存修改' : '创建排班'}
          </button>
        </form>
      </div>

      <DayShiftDialog
        open={editingDate !== null}
        date={editingDate}
        templates={templates}
        rows={editingDate ? dayShifts[editingDate] || [] : []}
        onAddRow={(shiftTemplateId) => editingDate && addDayShift(editingDate, shiftTemplateId)}
        onRemoveRow={(index) => editingDate && removeDayShift(editingDate, index)}
        onHeadcountChange={(index, value) => editingDate && updateDayShiftHeadcount(editingDate, index, value)}
        onClose={() => setEditingDate(null)}
      />
    </AppShell>
  );
}
