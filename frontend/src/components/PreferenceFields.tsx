import { Link } from 'react-router-dom';
import { HoursPeriod, HoursUnit, PreferredShift, ShiftTemplate } from '../api/client';
import { btnPillActive, btnPillDanger, btnPillInactive, inputBase, labelBase } from '../styles/ui';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const HOURS_PERIODS: { value: HoursPeriod; label: string }[] = [
  { value: 'weekly', label: '每周' },
  { value: 'fortnightly', label: '每两周' },
  { value: 'monthly', label: '每月' },
];
const HOURS_UNITS: { value: HoursUnit; label: string }[] = [
  { value: 'hours', label: '小时数' },
  { value: 'shifts', label: '班次数' },
];

interface WeekdayShiftSectionProps {
  heading: string;
  templates: ShiftTemplate[];
  entries: PreferredShift[];
  activeWeekday: number | null;
  onSelectWeekday: (day: number) => void;
  onToggleShift: (day: number, shiftTemplateId: string) => void;
  activeLabel: (weekday: number | null) => string;
  emptyHint: string;
  summaryHeading: string;
  activePillClass: string;
  weekdayAriaLabel?: (day: number) => string;
  shiftAriaLabel?: (name: string) => string;
}

function WeekdayShiftSection({
  heading,
  templates,
  entries,
  activeWeekday,
  onSelectWeekday,
  onToggleShift,
  activeLabel,
  emptyHint,
  summaryHeading,
  activePillClass,
  weekdayAriaLabel,
  shiftAriaLabel,
}: WeekdayShiftSectionProps) {
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
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, day) => {
            const configured = entries.some((p) => p.weekday === day);
            return (
              <button
                type="button"
                key={day}
                onClick={() => onSelectWeekday(day)}
                aria-label={weekdayAriaLabel?.(day)}
                className={`inline-flex items-center gap-1 ${activeWeekday === day ? activePillClass : btnPillInactive}`}
              >
                {configured && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={labelBase}>{activeLabel(activeWeekday)}</p>
        {templates.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            <span>还没有设置班次模板，先去创建一个吧</span>
            <Link to="/shift-templates" className="font-medium text-coral-deep hover:underline">
              去设置 →
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
        <div>
          <p className={labelBase}>{summaryHeading}</p>
          <ul className="space-y-1 rounded-2xl border border-tan/15 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            {summary.map(({ day, shiftNames }) => (
              <li key={day}>
                <span className="font-medium text-ink">{WEEKDAYS[day]}</span>：{shiftNames.join('、')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface PreferenceFieldsProps {
  templates: ShiftTemplate[];
  minHours: number;
  maxHours: number;
  onMinHoursChange: (value: number) => void;
  onMaxHoursChange: (value: number) => void;
  hoursPeriod: HoursPeriod;
  onHoursPeriodChange: (value: HoursPeriod) => void;
  hoursUnit: HoursUnit;
  onHoursUnitChange: (value: HoursUnit) => void;
  preferredShifts: PreferredShift[];
  activeWeekday: number | null;
  onSelectWeekday: (day: number) => void;
  onToggleShift: (day: number, shiftTemplateId: string) => void;
  unavailableShifts: PreferredShift[];
  unavailableActiveWeekday: number | null;
  onSelectUnavailableWeekday: (day: number) => void;
  onToggleUnavailableShift: (day: number, shiftTemplateId: string) => void;
}

export function PreferenceFields({
  templates,
  minHours,
  maxHours,
  onMinHoursChange,
  onMaxHoursChange,
  hoursPeriod,
  onHoursPeriodChange,
  hoursUnit,
  onHoursUnitChange,
  preferredShifts,
  activeWeekday,
  onSelectWeekday,
  onToggleShift,
  unavailableShifts,
  unavailableActiveWeekday,
  onSelectUnavailableWeekday,
  onToggleUnavailableShift,
}: PreferenceFieldsProps) {
  const minMaxLabel = hoursUnit === 'shifts' ? '班次数' : '工时';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="hours-period" className={labelBase}>
            工时周期
          </label>
          <select
            id="hours-period"
            value={hoursPeriod}
            onChange={(e) => onHoursPeriodChange(e.target.value as HoursPeriod)}
            className={inputBase}
          >
            {HOURS_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hours-unit" className={labelBase}>
            计算方式
          </label>
          <select
            id="hours-unit"
            value={hoursUnit}
            onChange={(e) => onHoursUnitChange(e.target.value as HoursUnit)}
            className={inputBase}
          >
            {HOURS_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelBase}>最小{minMaxLabel}</label>
          <input
            type="number"
            value={minHours}
            onChange={(e) => onMinHoursChange(Number(e.target.value))}
            className={inputBase}
          />
        </div>
        <div>
          <label className={labelBase}>最大{minMaxLabel}</label>
          <input
            type="number"
            value={maxHours}
            onChange={(e) => onMaxHoursChange(Number(e.target.value))}
            className={inputBase}
          />
        </div>
      </div>

      <WeekdayShiftSection
        heading="偏好上班的星期几"
        templates={templates}
        entries={preferredShifts}
        activeWeekday={activeWeekday}
        onSelectWeekday={onSelectWeekday}
        onToggleShift={onToggleShift}
        activeLabel={(day) => (day === null ? '想上的班次' : `${WEEKDAYS[day]}想上的班次`)}
        emptyHint="先选择上面偏好上班的星期几"
        summaryHeading="偏好总结"
        activePillClass={btnPillActive}
      />

      <div className="border-t border-tan/15 pt-4">
        <WeekdayShiftSection
          heading="不可工作的星期几"
          templates={templates}
          entries={unavailableShifts}
          activeWeekday={unavailableActiveWeekday}
          onSelectWeekday={onSelectUnavailableWeekday}
          onToggleShift={onToggleUnavailableShift}
          activeLabel={(day) => (day === null ? '不能上的班次' : `${WEEKDAYS[day]}不能上的班次`)}
          emptyHint="先选择上面不可工作的星期几"
          summaryHeading="不可用总结"
          activePillClass={btnPillDanger}
          weekdayAriaLabel={(day) => `不可用 ${WEEKDAYS[day]}`}
          shiftAriaLabel={(name) => `不可用 ${name}`}
        />
      </div>
    </div>
  );
}
