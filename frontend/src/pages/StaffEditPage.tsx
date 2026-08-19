import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, HoursPeriod, HoursUnit, PreferredShift, Responsibility, ShiftTemplate, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageHeader } from '../components/PageHeader';
import { PreferenceFields } from '../components/PreferenceFields';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPillActive, btnPillInactive, btnPrimary, cardBase, errorText, inputBase, labelBase } from '../styles/ui';

export function StaffEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
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
    api.staff.get(id).then((s) => {
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
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff');
      setSaving(false);
    }
  };

  if (!staff)
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">{t('staff.loadingText')}</p>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="max-w-lg space-y-4">
        <BackLink to="/staff" label={t('staff.backToStaff')} />
        <PageHeader title={t('staff.editPageTitle')} />
        <form onSubmit={handleSubmit} className={`${cardBase} space-y-4`}>
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}
          <div>
            <label className={labelBase}>{t('staff.nameLabel')}</label>
            <input placeholder={t('staff.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className={inputBase} required />
          </div>
          <div>
            <label className={labelBase}>{t('staff.emailLabel')}</label>
            <input
              type="email"
              placeholder={t('staff.emailLabel')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              required
            />
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
          <div className="border-t border-tan/15 pt-4">
            <p className="mb-3 font-display text-sm font-semibold text-ink">{t('staff.preferencesHeading')}</p>
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
          <button type="submit" disabled={saving} className={`gap-2 ${btnPrimary}`}>
            {saving && <Spinner className="h-4 w-4" />}
            {t('staff.saveButton')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
