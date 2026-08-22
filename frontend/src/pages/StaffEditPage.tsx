import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { HoursFields, PreferredShiftsFields, UnavailableShiftsFields, validateHoursRange } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { StepStepper } from '../components/StepStepper';
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

export function StaffEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [step, setStep] = useState<number>(0);
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
  const [saving, setSaving] = useState(false);
useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.responsibilities.list().then(setResponsibilities);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.staff.get(id).then((s) => {
      if (cancelled) return;
      setStaff(s);
      setName(s.name);
      setEmail(s.email);
      setResponsibilityIds(s.responsibilityIds);
      if (s.preference) {
        setMinHours(s.preference.minHours);
        setMaxHours(s.preference.maxHours);
        setHoursPeriod(s.preference.hoursPeriod);
        setHoursUnit(s.preference.hoursUnit);
        setPreferredShifts(s.preference.preferredShifts);
        if (s.preference.preferredShifts.length > 0) {
          setActiveWeekday(Math.min(...s.preference.preferredShifts.map((p) => p.weekday)));
        }
        setUnavailableShifts(s.preference.unavailableShifts);
        if (s.preference.unavailableShifts.length > 0) {
          setUnavailableActiveWeekday(Math.min(...s.preference.unavailableShifts.map((p) => p.weekday)));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleResponsibility = (respId: string) => {
    setResponsibilityIds((prev) => (prev.includes(respId) ? prev.filter((r) => r !== respId) : [...prev, respId]));
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

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!name.trim()) return t('staff.nameRequiredError');
      if (!email.trim()) return t('staff.emailRequiredError');
      if (responsibilityIds.length === 0) return t('staff.responsibilityRequiredError');
    }
    if (s === 1) return validateHoursRange(minHours, maxHours, t);
    return null;
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(target);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    if (responsibilityIds.length === 0) {
      setError(t('staff.responsibilityRequiredError'));
      return;
    }
    setSaving(true);
    try {
      await api.staff.update(id, { name, email, responsibilityIds });
      await api.staff.updatePreference(id, {
        preferredShifts,
        unavailableShifts,
        unavailableDateRanges: staff?.preference?.unavailableDateRanges ?? [],
        minHours,
        maxHours,
        hoursPeriod,
        hoursUnit,
      });
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('staff.saveFailedError'));
      setSaving(false);
    }
  };

  if (!staff)
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">{t('staff.loadingText')}</p>
      </AppShell>
    );

  const stepTitles = [t('staff.step1Title'), t('staff.step2Title'), t('staff.step3Title'), t('staff.step4Title')];

  return (
    <AppShell>
      <div className="max-w-xl space-y-4">
        <BackLink to="/staff" label={t('staff.backToStaff')} />
        <PageHeader title={t('staff.editPageTitle')} />

        <StepStepper
          steps={stepTitles}
          current={step}
          onStepClick={goToStep}
          freeSwitch
          ariaLabel={t('staff.stepIndicator', { current: step + 1, total: 4 })}
        />

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        {step === 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToStep(1);
            }}
            className={`${cardBase} space-y-4`}
          >
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
            <button type="submit" className={`w-full gap-2 ${btnPrimary}`}>
              {t('common.next')}
            </button>
          </form>
        )}
{step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToStep(2);
            }}
            className={`${cardBase} space-y-4`}
          >
            <h2 className="font-display text-base font-semibold text-ink">{t('staff.step2Title')}</h2>
            <HoursFields
              minHours={minHours}
              maxHours={maxHours}
              onMinHoursChange={setMinHours}
              onMaxHoursChange={setMaxHours}
              hoursPeriod={hoursPeriod}
              onHoursPeriodChange={setHoursPeriod}
              hoursUnit={hoursUnit}
              onHoursUnitChange={setHoursUnit}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => goToStep(0)} className={btnSecondary}>
                {t('common.back')}
              </button>
              <button type="submit" className={`flex-1 gap-2 ${btnPrimary}`}>
                {t('common.next')}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToStep(3);
            }}
            className={`${cardBase} space-y-4`}
          >
            <h2 className="font-display text-base font-semibold text-ink">{t('staff.step3Title')}</h2>
            <PreferredShiftsFields
              templates={templates}
              entries={preferredShifts}
              activeWeekday={activeWeekday}
              onSelectWeekday={setActiveWeekday}
              onToggleShift={toggleShift}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => goToStep(1)} className={btnSecondary}>
                {t('common.back')}
              </button>
              <button type="submit" className={`flex-1 gap-2 ${btnPrimary}`}>
                {t('common.next')}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className={`${cardBase} space-y-4`}>
            <h2 className="font-display text-base font-semibold text-ink">{t('staff.step4Title')}</h2>
            <UnavailableShiftsFields
              templates={templates}
              entries={unavailableShifts}
              activeWeekday={unavailableActiveWeekday}
              onSelectWeekday={setUnavailableActiveWeekday}
              onToggleShift={toggleUnavailableShift}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => goToStep(2)} className={btnSecondary}>
                {t('common.back')}
              </button>
              <button type="submit" disabled={saving} className={`flex-1 gap-2 ${btnPrimary}`}>
                {saving && <Spinner className="h-4 w-4" />}
                {t('staff.saveButton')}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}