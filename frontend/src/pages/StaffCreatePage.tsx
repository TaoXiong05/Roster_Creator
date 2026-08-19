import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { PreferenceFields } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import {
  btnPrimary,
  btnPillActive,
  btnPillInactive,
  cardBase,
  errorText,
  inputBase,
  labelBase,
} from '../styles/ui';

export function StaffCreatePage() {
  const navigate = useNavigate();
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
  const [unavailableShifts, setUnavailableShifts] = useState<PreferredShift[]>([]);
  const [unavailableActiveWeekday, setUnavailableActiveWeekday] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.responsibilities.list().then(setResponsibilities);
  }, []);

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

  const toggleUnavailableShift = (day: number, shiftTemplateId: string) => {
    setUnavailableShifts((prev) =>
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
          unavailableShifts,
          unavailableDateRanges: [],
          minHours,
          maxHours,
          hoursPeriod,
          hoursUnit,
        });
      }
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-lg space-y-4">
        <BackLink to="/staff" label="返回员工管理" />
        <PageHeader title="创建员工" description="记录姓名、邮箱、职责和可安排时间" />

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
                unavailableShifts={unavailableShifts}
                unavailableActiveWeekday={unavailableActiveWeekday}
                onSelectUnavailableWeekday={setUnavailableActiveWeekday}
                onToggleUnavailableShift={toggleUnavailableShift}
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
      </div>
    </AppShell>
  );
}
