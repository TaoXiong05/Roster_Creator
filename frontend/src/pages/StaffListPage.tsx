import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { PreferenceFields } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import {
  btnPrimary,
  btnDanger,
  btnPillActive,
  btnPillInactive,
  btnSecondary,
  cardBase,
  errorText,
  inputBase,
  labelBase,
  listRow,
} from '../styles/ui';

export function StaffListPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [responsibilityIds, setResponsibilityIds] = useState<string[]>([]);
  const [showPreferences, setShowPreferences] = useState(true);
  const { mounted: prefMounted, visible: prefVisible } = useTransitionPresence(showPreferences, 300);
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(40);
  const [hoursPeriod, setHoursPeriod] = useState<HoursPeriod>('weekly');
  const [hoursUnit, setHoursUnit] = useState<HoursUnit>('hours');
  const [preferredShifts, setPreferredShifts] = useState<PreferredShift[]>([]);
  const [activeWeekday, setActiveWeekday] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setStaff(await api.staff.list());

  useEffect(() => {
    load();
    api.shiftTemplates.list().then(setTemplates);
    api.responsibilities.list().then(setResponsibilities);
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setResponsibilityIds([]);
    setShowPreferences(true);
    setMinHours(0);
    setMaxHours(40);
    setHoursPeriod('weekly');
    setHoursUnit('hours');
    setPreferredShifts([]);
    setActiveWeekday(null);
  };

  const toggleResponsibility = (id: string) => {
    setResponsibilityIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const toggleShift = (day: number, shiftTemplateId: string) => {
    setPreferredShifts((prev) =>
      prev.some((p) => p.weekday === day && p.shiftTemplateId === shiftTemplateId)
        ? prev.filter((p) => !(p.weekday === day && p.shiftTemplateId === shiftTemplateId))
        : [...prev, { weekday: day, shiftTemplateId }]
    );
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (responsibilityIds.length === 0) {
      setError('请至少选择一个职责');
      return;
    }
    setCreating(true);
    try {
      const created = await api.staff.create({ name, email, responsibilityIds });
      if (showPreferences) {
        await api.staff.updatePreference(created.id, {
          preferredShifts,
          unavailableDateRanges: [],
          minHours,
          maxHours,
          hoursPeriod,
          hoursUnit,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.staff.remove(confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="员工管理" description="记录姓名、邮箱、职责和可安排时间" />

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        <form onSubmit={handleCreate} className={`${cardBase} space-y-4`}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="sm:flex-1">
              <label htmlFor="staff-name" className={labelBase}>
                姓名
              </label>
              <input
                id="staff-name"
                placeholder="姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputBase}
                required
              />
            </div>
            <div className="sm:flex-1">
              <label htmlFor="staff-email" className={labelBase}>
                邮箱
              </label>
              <input
                id="staff-email"
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelBase}>职责</label>
            {responsibilities.length === 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
                <span>还没有设置职责模板，先去创建一个吧</span>
                <Link to="/responsibilities" className="font-medium text-coral-deep hover:underline">
                  去设置 →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {responsibilities.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggleResponsibility(r.id)}
                    className={responsibilityIds.includes(r.id) ? btnPillActive : btnPillInactive}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {prefMounted ? (
            <div
              className={`space-y-4 border-t border-tan/15 pt-4 transition-all duration-300 ease-in-out ${
                prefVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-ink">排班偏好</p>
                <button type="button" onClick={() => setShowPreferences(false)} className="text-xs font-medium text-ink-soft hover:text-coral-deep">
                  收起
                </button>
              </div>
              <PreferenceFields
                templates={templates}
                minHours={minHours}
                maxHours={maxHours}
                onMinHoursChange={setMinHours}
                onMaxHoursChange={setMaxHours}
                hoursPeriod={hoursPeriod}
                onHoursPeriodChange={setHoursPeriod}
                hoursUnit={hoursUnit}
                onHoursUnitChange={setHoursUnit}
                preferredShifts={preferredShifts}
                activeWeekday={activeWeekday}
                onSelectWeekday={setActiveWeekday}
                onToggleShift={toggleShift}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setShowPreferences(true)} className="text-sm font-medium text-coral-deep hover:underline">
              + 填写排班偏好（可选）
            </button>
          )}

          <button type="submit" disabled={creating} className={`gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
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
                  <button onClick={() => setConfirmTarget(s)} className={btnDanger}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除员工"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销，TA 在排班表中的分配记录也会一并移除。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
