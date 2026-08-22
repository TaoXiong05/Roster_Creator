import { Link } from 'react-router-dom';
import { HoursPeriod, HoursUnit, PreferredShift, ShiftTemplate } from '../api/client';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import {
  btnPillActive,
  btnPillDanger,
  btnPillInactive,
  btnPillInactiveConfiguredDanger,
  btnPillInactiveConfiguredSuccess,
  inputBase,
  labelBase,
} from '../styles/ui';

const HOURS_PERIODS: { value: HoursPeriod; labelKey: string }[] = [
  { value: 'weekly', labelKey: 'preferenceFields.periodWeekly' },
  { value: 'fortnightly', labelKey: 'preferenceFields.periodFortnightly' },
  { value: 'monthly', labelKey: 'preferenceFields.periodMonthly' },
];
const HOURS_UNITS: { value: HoursUnit; labelKey: string }[] = [
  { value: 'hours', labelKey: 'preferenceFields.unitHoursOption' },
  { value: 'shifts', labelKey: 'preferenceFields.unitShiftsOption' },
];

interface WeekdayShiftSectionProps {
  heading: string;
  hint?: string;
  templates: ShiftTemplate[];
  entries: PreferredShift[];
  activeWeekday: number | null;
  onSelectWeekday: (day: number) => void;
  onToggleShift: (day: number, shiftTemplateId: string) => void;
  activeLabel: (weekday: number | null) => string;
  emptyHint: string;
  summaryHeading: string;
  activePillClass: string;
  configuredPillClass: string;
  weekdays: string[];
  noTemplatesHint: string;
  goSetUp: string;
  weekdayAriaLabel?: (day: number) => string;
  shiftAriaLabel?: (name: string) => string;
}

function WeekdayShiftSection({
  heading,
  hint,
  templates,
  entries,
  activeWeekday,
  onSelectWeekday,
  onToggleShift,
  activeLabel,
  emptyHint,
  summaryHeading,
  activePillClass,
  configuredPillClass,
  weekdays,
  noTemplatesHint,
  goSetUp,
  weekdayAriaLabel,
  shiftAriaLabel,
}: WeekdayShiftSectionProps) {
  const { t } = useLanguage();
  const activeShiftIds =
    activeWeekday === null ? [] : entries.filter((p) => p.weekday === activeWeekday).map((p) => p.shiftTemplateId);

  const summary = [...new Set(entries.map((p) => p.weekday))]
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      shiftNames: entries
        .filter((p) => p.weekday === day)
        .map((p) => templates.find((t) => t.id === p.shiftTemplateId)?.name)
        .filter((name): name is string => !!name),
    }))
    .filter((entry) => entry.shiftNames.length > 0);

  return (
    <div className="space-y-4">
      <div>
        <p className={labelBase}>{heading}</p>
        {hint && <p className="mb-2 text-xs text-ink-soft">{hint}</p>}
        <div className="flex flex-wrap gap-2">
          {weekdays.map((label, day) => {
            const configured = entries.some((p) => p.weekday === day);
            const dayPillClass =
              activeWeekday === day ? activePillClass : configured ? configuredPillClass : btnPillInactive;
            return (
              <button
                type="button"
                key={day}
                onClick={() => onSelectWeekday(day)}
                aria-label={weekdayAriaLabel?.(day)}
                className={`inline-flex items-center gap-1 ${dayPillClass}`}
              >
                {configured && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={activeWeekday === day ? undefined : 'text-eucalyptus'}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-tan/15 pt-4">
        <p className={labelBase}>{activeLabel(activeWeekday)}</p>
        {templates.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            <span>{noTemplatesHint}</span>
            <Link to="/shift-templates" className="font-medium text-coral-deep hover:underline">
              {goSetUp}
            </Link>
          </div>
        ) : activeWeekday === null ? (
          <p className="rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            {emptyHint}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onToggleShift(activeWeekday, t.id)}
                aria-label={shiftAriaLabel?.(t.name)}
                className={activeShiftIds.includes(t.id) ? activePillClass : btnPillInactive}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {summary.length > 0 && (
        <div className="border-t border-tan/15 pt-4">
          <p className={labelBase}>{summaryHeading}</p>
          <ul className="space-y-1 rounded-2xl border border-tan/15 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            {summary.map(({ day, shiftNames }) => (
              <li key={day}>
                <span className="font-medium text-ink">{weekdays[day]}</span>{t('common.colon')}{shiftNames.join(t('common.listSeparator'))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface HoursFieldsProps {
  minHours: number;
  maxHours: number;
  onMinHoursChange: (value: number) => void;
  onMaxHoursChange: (value: number) => void;
  hoursPeriod: HoursPeriod;
  onHoursPeriodChange: (value: HoursPeriod) => void;
  hoursUnit: HoursUnit;
  onHoursUnitChange: (value: HoursUnit) => void;
}

// 工作时长：周期、单位、上下限
export function HoursFields({
  minHours,
  maxHours,
  onMinHoursChange,
  onMaxHoursChange,
  hoursPeriod,
  onHoursPeriodChange,
  hoursUnit,
  onHoursUnitChange,
}: HoursFieldsProps) {
  const { t } = useLanguage();
  const minMaxLabel = hoursUnit === 'shifts' ? t('preferenceFields.unitShifts') : t('preferenceFields.unitHours');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="hours-period" className={labelBase}>
            {t('preferenceFields.hoursPeriodLabel')}
          </label>
          <select
            id="hours-period"
            value={hoursPeriod}
            onChange={(e) => onHoursPeriodChange(e.target.value as HoursPeriod)}
            className={inputBase}
          >
            {HOURS_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {t(period.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hours-unit" className={labelBase}>
            {t('preferenceFields.hoursUnitLabel')}
          </label>
          <select
            id="hours-unit"
            value={hoursUnit}
            onChange={(e) => onHoursUnitChange(e.target.value as HoursUnit)}
            className={inputBase}
          >
            {HOURS_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {t(unit.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-tan/15 pt-4">
        <div>
          <label className={labelBase}>{t('preferenceFields.minLabel', { unit: minMaxLabel })}</label>
          <input
            type="number"
            value={minHours}
            onChange={(e) => onMinHoursChange(Number(e.target.value))}
            className={inputBase}
          />
        </div>
        <div>
          <label className={labelBase}>{t('preferenceFields.maxLabel', { unit: minMaxLabel })}</label>
          <input
            type="number"
            value={maxHours}
            onChange={(e) => onMaxHoursChange(Number(e.target.value))}
            className={inputBase}
          />
        </div>
      </div>
    </div>
  );
}

export function validateHoursRange(
  minHours: number,
  maxHours: number,
  t: (key: string, vars?: Record<string, string | number>) => string
): string | null {
  if (minHours <= 0 || maxHours <= 0) return t('preferenceFields.minPositiveError');
  if (minHours > maxHours) return t('preferenceFields.minMaxError');
  return null;
}

interface ShiftsSectionProps {
  templates: ShiftTemplate[];
  entries: PreferredShift[];
  activeWeekday: number | null;
  onSelectWeekday: (day: number) => void;
  onToggleShift: (day: number, shiftTemplateId: string) => void;
}

// 希望上班的星期几 + 班次
export function PreferredShiftsFields({
  templates,
  entries,
  activeWeekday,
  onSelectWeekday,
  onToggleShift,
}: ShiftsSectionProps) {
  const { t, language } = useLanguage();
  const days = getDictionary(language).weekdaysShort;
  return (
    <WeekdayShiftSection
      heading={t('preferenceFields.preferredHeading')}
      hint={t('preferenceFields.preferredHint')}
      templates={templates}
      entries={entries}
      activeWeekday={activeWeekday}
      onSelectWeekday={onSelectWeekday}
      onToggleShift={onToggleShift}
      activeLabel={(day) =>
        day === null
          ? t('preferenceFields.preferredActiveLabelNull')
          : t('preferenceFields.preferredActiveLabel', { day: days[day] })
      }
      emptyHint={t('preferenceFields.selectDayFirst')}
      summaryHeading={t('preferenceFields.summaryHeading')}
      activePillClass={btnPillActive}
      configuredPillClass={btnPillInactiveConfiguredSuccess}
      weekdays={days}
      noTemplatesHint={t('common.noShiftTemplatesHint')}
      goSetUp={t('common.goSetUp')}
    />
  );
}

// 不希望在班的星期几 + 班次
export function UnavailableShiftsFields({
  templates,
  entries,
  activeWeekday,
  onSelectWeekday,
  onToggleShift,
}: ShiftsSectionProps) {
  const { t, language } = useLanguage();
  const days = getDictionary(language).weekdaysShort;
  return (
    <WeekdayShiftSection
      heading={t('preferenceFields.unavailableHeading')}
      hint={t('preferenceFields.unavailableHint')}
      templates={templates}
      entries={entries}
      activeWeekday={activeWeekday}
      onSelectWeekday={onSelectWeekday}
      onToggleShift={onToggleShift}
      activeLabel={(day) =>
        day === null
          ? t('preferenceFields.unavailableActiveLabelNull')
          : t('preferenceFields.unavailableActiveLabel', { day: days[day] })
      }
      emptyHint={t('preferenceFields.selectUnavailableDayFirst')}
      summaryHeading={t('preferenceFields.unavailableSummaryHeading')}
      activePillClass={btnPillDanger}
      configuredPillClass={btnPillInactiveConfiguredDanger}
      weekdays={days}
      noTemplatesHint={t('common.noShiftTemplatesHint')}
      goSetUp={t('common.goSetUp')}
      weekdayAriaLabel={(day) => t('preferenceFields.unavailableWeekdayAria', { day: days[day] })}
      shiftAriaLabel={(name) => t('preferenceFields.unavailableShiftAria', { name })}
    />
  );
}
