import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { PreferenceFields } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import {
  btnPrimary,
  btnSecondary,
  btnPillActive,
  btnPillInactive,
  cardBase,
  errorText,
  inputBase,
  labelBase,
} from '../styles/ui';

export function StaffCreatePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [responsibilityIds, setResponsibilityIds] = useState<string[]>([]);
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

  const handleNext = () => {
    setError(null);
    if (responsibilityIds.length === 0) {
      setError(t('staff.responsibilityRequiredError'));
      return;
    }
    setStep(2);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await api.staff.create({ name, email, responsibilityIds });
      await api.staff.updatePreference(created.id, {
        preferredShifts,
        unavailableShifts,
        unavailableDateRanges: [],
        minHours,
        maxHours,
        hoursPeriod,
        hoursUnit,
      });
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
        <BackLink to="/staff" label={t('staff.backToStaff')} />
        <PageHeader title={t('staff.createPageTitle')} description={t('staff.createPageDescription')} />

        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t('staff.stepIndicator', { current: step, total: 2 })}
        </p>

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        {step === 1 ? (
          <div className={`${cardBase} space-y-4`}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:flex-1">
                <label htmlFor="staff-name" className={labelBase}>
                  {t('staff.nameLabel')}
                </label>
                <input
                  id="staff-name"
                  placeholder={t('staff.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputBase}
                  required
                />
              </div>
              <div className="sm:flex-1">
                <label htmlFor="staff-email" className={labelBase}>
                  {t('staff.emailLabel')}
                </label>
                <input
                  id="staff-email"
                  type="email"
                  placeholder={t('staff.emailLabel')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelBase}>{t('staff.responsibilityLabel')}</label>
              {responsibilities.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
                  <span>{t('common.noResponsibilityTemplatesHint')}</span>
                  <Link to="/responsibilities" className="font-medium text-coral-deep hover:underline">
                    {t('common.goSetUp')}
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
            <button type="button" onClick={handleNext} className={`w-full gap-2 ${btnPrimary}`}>
              {t('common.next')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className={`${cardBase} space-y-4`}>
            <p className="font-display text-sm font-semibold text-ink">{t('staff.preferencesHeading')}</p>
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
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className={btnSecondary}>
                {t('common.back')}
              </button>
              <button type="submit" disabled={creating} className={`flex-1 gap-2 ${btnPrimary}`}>
                {creating && <Spinner className="h-4 w-4" />}
                {t('staff.addStaffButton')}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
