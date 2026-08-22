import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, Responsibility, RosterShiftInput, ShiftTemplate, StaffGroup } from '../api/client';
import { formatDate } from '../utils/date';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { DayShiftDialog, DayShiftRow } from '../components/DayShiftDialog';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import {
  btnPillActive,
  btnPillInactive,
  btnPrimary,
  btnSecondary,
  bulkActionBar,
  cardBase,
  checkboxBase,
  errorText,
  fieldErrorText,
  inputBase,
  inputError,
  labelBase,
} from '../styles/ui';
import {
  DAYS_PER_PAGE,
  datesBetween,
  formatMonthLabel,
  monthGridDates,
  monthKeyOf,
  monthsInRange,
  todayISODate,
  ViewLength,
  weekdayLabel,
} from '../utils/calendarGrid';

export function RosterCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const weekdays = getDictionary(language).weekdaysShort;
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [groupId, setGroupId] = useState('');
  const [hoursPerShift, setHoursPerShift] = useState(8);
  const [dayShifts, setDayShifts] = useState<Record<string, DayShiftRow[]>>({});
  const [viewLength, setViewLength] = useState<ViewLength>('weekly');
  const [pageIndex, setPageIndex] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [clipboardDate, setClipboardDate] = useState<string | null>(null);
  const [pasteTargets, setPasteTargets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; date?: string; group?: string }>({});
  const [creating, setCreating] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(isEdit);

  const nameFieldError = fieldErrors.name ?? null;
  const dateFieldError = fieldErrors.date ?? null;
  const groupFieldError = fieldErrors.group ?? null;

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.responsibilities.list().then(setResponsibilities);
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
          const rows = byDate[date] || (byDate[date] = []);
          let row = rows.find((row) => row.shiftTemplateId === rs.shiftTemplate.id);
          if (!row) {
            row = { shiftTemplateId: rs.shiftTemplate.id, requirements: [] };
            rows.push(row);
          }
          row.requirements.push({ responsibilityId: rs.responsibilityId, headcount: rs.headcount });
        }
        setDayShifts(byDate);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('rosters.loadFailedError')))
      .finally(() => {
        if (!cancelled) setLoadingRoster(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setPageIndex(0);
  }, [dateRangeStart, dateRangeEnd, viewLength]);

  const availableDates = datesBetween(dateRangeStart, dateRangeEnd);
  const availableDatesSet = new Set(availableDates);
  const months = monthsInRange(dateRangeStart, dateRangeEnd);
  const isMonthly = viewLength === 'monthly';
  const daysPerPage = DAYS_PER_PAGE[viewLength];
  const totalPages = isMonthly ? Math.max(1, months.length) : Math.max(1, Math.ceil(availableDates.length / daysPerPage!));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageDates = isMonthly
    ? monthGridDates(months[clampedPageIndex] ?? monthKeyOf(dateRangeStart))
    : availableDates.slice(clampedPageIndex * daysPerPage!, clampedPageIndex * daysPerPage! + daysPerPage!);
  const today = todayISODate();

  const addDayShift = (date: string, shiftTemplateId: string) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: [...(prev[date] || []), { shiftTemplateId, requirements: [{ responsibilityId: '', headcount: 1 }] }],
    }));
  };

  const removeDayShift = (date: string, rowIndex: number) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: (prev[date] || []).filter((_, i) => i !== rowIndex),
    }));
  };

  const addRequirement = (date: string, rowIndex: number) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: (prev[date] || []).map((row, i) =>
        i === rowIndex ? { ...row, requirements: [...row.requirements, { responsibilityId: '', headcount: 1 }] } : row
      ),
    }));
  };

  const removeRequirement = (date: string, rowIndex: number, reqIndex: number) => {
    setDayShifts((prev) => {
      const rows = prev[date] || [];
      const row = rows[rowIndex];
      if (!row) return prev;
      const nextRequirements = row.requirements.filter((_, i) => i !== reqIndex);
      if (nextRequirements.length === 0) {
        return { ...prev, [date]: rows.filter((_, i) => i !== rowIndex) };
      }
      return { ...prev, [date]: rows.map((r, i) => (i === rowIndex ? { ...r, requirements: nextRequirements } : r)) };
    });
  };

  const updateRequirement = (
    date: string,
    rowIndex: number,
    reqIndex: number,
    patch: Partial<{ responsibilityId: string; headcount: number }>
  ) => {
    setDayShifts((prev) => ({
      ...prev,
      [date]: (prev[date] || []).map((row, ri) =>
        ri === rowIndex
          ? { ...row, requirements: row.requirements.map((req, qi) => (qi === reqIndex ? { ...req, ...patch } : req)) }
          : row
      ),
    }));
  };

  const pasteMode = clipboardDate !== null;

  const startCopy = (date: string) => {
    setClipboardDate(date);
    setPasteTargets(new Set());
  };

  const cancelPaste = () => {
    setClipboardDate(null);
    setPasteTargets(new Set());
  };

  const togglePasteTarget = (date: string) => {
    setPasteTargets((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const confirmPaste = () => {
    if (!clipboardDate) return;
    const sourceRows = dayShifts[clipboardDate] || [];
    setDayShifts((prev) => {
      const next = { ...prev };
      for (const date of pasteTargets) {
        next[date] = sourceRows.map((row) => ({
          shiftTemplateId: row.shiftTemplateId,
          requirements: row.requirements.map((req) => ({ ...req })),
        }));
      }
      return next;
    });
    cancelPaste();
  };

  const handleDayClick = (date: string) => {
    if (pasteMode) {
      if (date === clipboardDate) return;
      togglePasteTarget(date);
    } else {
      setEditingDate(date);
    }
  };

  const buildShifts = (): RosterShiftInput[] => {
    const shifts: RosterShiftInput[] = [];
    for (const date of availableDates) {
      for (const row of dayShifts[date] || []) {
        const requirements = row.requirements.filter((req) => req.headcount > 0);
        if (requirements.length === 0) continue;
        shifts.push({ shiftTemplateId: row.shiftTemplateId, dates: [date], requirements });
      }
    }
    return shifts;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const nextFieldErrors: { name?: string; date?: string; group?: string } = {};
    if (!name.trim()) nextFieldErrors.name = t('rosters.nameRequiredError');
    if (!dateRangeStart || !dateRangeEnd) nextFieldErrors.date = t('rosters.dateRangeRequiredError');
    if (!groupId) nextFieldErrors.group = t('rosters.groupRequiredError');
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    const hasMissingResponsibility = availableDates.some((date) =>
      (dayShifts[date] || []).some((row) => row.requirements.some((req) => req.headcount > 0 && !req.responsibilityId))
    );
    if (hasMissingResponsibility) {
      setError(t('rosters.missingResponsibilityError'));
      return;
    }
    const shifts = buildShifts();
    if (shifts.length === 0) {
      setError(t('rosters.noShiftsError'));
      return;
    }
    setCreating(true);
    try {
      const payload = { name, dateRangeStart, dateRangeEnd, groupId, hoursPerShift, shifts };
      if (isEdit) {
        await api.rosters.update(id!, payload);
      } else {
        await api.rosters.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['rosters'] });
      navigate('/rosters');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rosters.createFailedError'));
      setCreating(false);
    }
  };

  if (loadingRoster) {
    return (
      <AppShell>
        <PageSkeleton rows={5} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-4">
        <BackLink to="/rosters" label={t('rosters.backToRosters')} />
        <PageHeader title={isEdit ? t('rosters.createPageTitleEdit') : t('rosters.createPageTitleCreate')} />
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}

          <div className={`${cardBase} space-y-4`}>
            <div>
              <label className={labelBase}>{t('rosters.nameLabel')}</label>
              <input
                placeholder={t('rosters.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={nameFieldError ? inputError : inputBase}
                required
              />
              {nameFieldError && (
                <p role="alert" className={fieldErrorText}>
                  {nameFieldError}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelBase}>{t('rosters.startDateLabel')}</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  aria-label={t('rosters.startDateLabel')}
                  className={dateFieldError ? inputError : inputBase}
                  required
                />
              </div>
              <div>
                <label className={labelBase}>{t('rosters.endDateLabel')}</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  aria-label={t('rosters.endDateLabel')}
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
                <label className={labelBase}>{t('rosters.groupLabel')}</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  aria-label={t('rosters.groupLabel')}
                  className={groupFieldError ? inputError : inputBase}
                  required
                >
                  <option value="">{t('rosters.selectGroupPlaceholder')}</option>
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
                <label className={labelBase}>{t('rosters.hoursPerShiftLabel')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hoursPerShift}
                  onChange={(e) => setHoursPerShift(Number(e.target.value))}
                  aria-label={t('rosters.hoursPerShiftLabel')}
                  className={inputBase}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">{t('rosters.shiftSchedulingHeading')}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{t('rosters.shiftSchedulingHint')}</p>
            </div>

            {templates.length === 0 ? (
              <div className={`${cardBase} flex flex-wrap items-center gap-2`}>
                <p className="text-sm text-ink-soft">{t('rosters.noTemplatesMessage')}</p>
                <Link to="/shift-templates" className={btnSecondary}>
                  {t('rosters.goSetUpTemplates')}
                </Link>
              </div>
            ) : responsibilities.length === 0 ? (
              <div className={`${cardBase} flex flex-wrap items-center gap-2`}>
                <p className="text-sm text-ink-soft">{t('rosters.noResponsibilitiesMessage')}</p>
                <Link to="/responsibilities" className={btnSecondary}>
                  {t('rosters.goSetUpResponsibilities')}
                </Link>
              </div>
            ) : availableDates.length === 0 ? (
              <p className={`${cardBase} text-sm text-ink-soft`}>{t('rosters.selectDatesMessage')}</p>
            ) : (
              <div className={`${cardBase} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewLength('weekly')}
                      className={viewLength === 'weekly' ? btnPillActive : btnPillInactive}
                    >
                      {t('rosters.viewWeekly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewLength('fortnightly')}
                      className={viewLength === 'fortnightly' ? btnPillActive : btnPillInactive}
                    >
                      {t('rosters.viewFortnightly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewLength('monthly')}
                      className={viewLength === 'monthly' ? btnPillActive : btnPillInactive}
                    >
                      {t('rosters.viewMonthly')}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                      disabled={clampedPageIndex === 0}
                      className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {t('rosters.prevPage')}
                    </button>
                    <span className="text-sm text-ink-soft">
                      {isMonthly ? formatMonthLabel(months[clampedPageIndex] ?? '', language) : t('rosters.pageIndicator', { current: clampedPageIndex + 1, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={clampedPageIndex >= totalPages - 1}
                      className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {t('rosters.nextPage')}
                    </button>
                  </div>
                </div>

                {pasteMode && (
                  <div className={bulkActionBar}>
                    <span>{t('rosters.pasteBannerText', { date: `${formatDate(clipboardDate!)} ${weekdayLabel(clipboardDate!, weekdays)}` })}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-soft">{t('common.selectedCount', { count: pasteTargets.size })}</span>
                      <button type="button" onClick={cancelPaste} className={btnSecondary}>
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={confirmPaste}
                        disabled={pasteTargets.size === 0}
                        className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {t('rosters.pasteButton')}
                      </button>
                    </div>
                  </div>
                )}

                {isMonthly && (
                  <div className="grid grid-cols-7 gap-2 px-1 text-center text-[11px] font-semibold text-ink-soft">
                    {weekdays.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-7 gap-2">
                  {pageDates.map((date) => {
                      if (!availableDatesSet.has(date)) {
                        return (
                          <div
                            key={date}
                            aria-hidden="true"
                            className="min-h-[6.5rem] rounded-2xl border border-dashed border-tan/10 p-3 opacity-40"
                          >
                            <span className="text-xs text-ink-soft">{date.slice(8, 10)}</span>
                          </div>
                        );
                      }
                      const rows = dayShifts[date] || [];
                      const isToday = date === today;
                      const isSource = date === clipboardDate;
                      const isSelectedTarget = pasteTargets.has(date);
                      return (
                        <div className="relative" key={date}>
                          <button
                            type="button"
                            onClick={() => handleDayClick(date)}
                            disabled={isSource}
                            className={`min-h-[6.5rem] w-full rounded-2xl border p-3 text-left transition hover:border-coral/40 hover:bg-white disabled:cursor-not-allowed disabled:hover:border-tan/15 ${
                              isSelectedTarget
                                ? 'border-coral-deep bg-coral-deep/10 ring-2 ring-coral-deep/40'
                                : isSource
                                ? 'border-tan/30 bg-sand/40'
                                : isToday
                                ? 'border-coral-deep/50 bg-coral-deep/5 ring-1 ring-coral-deep/20'
                                : 'border-tan/15 bg-white/60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                  isToday ? 'bg-coral-deep text-white' : 'bg-sand/70 text-ink'
                                }`}
                              >
                                {date.slice(8, 10)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink">{weekdayLabel(date, weekdays)}</p>
                                <p className="text-[11px] text-ink-soft/70">{formatDate(date)}</p>
                              </div>
                            </div>
                            {rows.length === 0 ? (
                              <p className="mt-2 text-xs text-ink-soft/60">{t('rosters.clickToSet')}</p>
                            ) : (
                              <ul className="mt-2 space-y-1">
                                {rows.map((row) => {
                                  const tpl = templates.find((t) => t.id === row.shiftTemplateId);
                                  const summary = row.requirements
                                    .filter((req) => req.headcount > 0)
                                    .map((req) => {
                                      const r = responsibilities.find((resp) => resp.id === req.responsibilityId);
                                      return `${r?.name ?? t('rosters.unselectedResponsibility')} × ${req.headcount}`;
                                    })
                                    .join(t('common.listSeparator'));
                                  return (
                                    <li key={row.shiftTemplateId} className="text-xs text-ink">
                                      {tpl?.name ?? '?'}{t('common.colon')}{summary || t('rosters.notSetHeadcount')}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </button>

                          {!pasteMode && rows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => startCopy(date)}
                              aria-label={t('rosters.copyDayAria', { date: formatDate(date) })}
                              title={t('rosters.copyDayAria', { date: formatDate(date) })}
                              className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-sm transition hover:bg-white hover:text-coral-deep"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="12" height="12" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          )}

                          {isSource && (
                            <span className="absolute right-2 top-2 z-10 rounded-full bg-coral-deep px-2 py-0.5 text-[10px] font-semibold text-white">
                              {t('rosters.copiedBadge')}
                            </span>
                          )}

                          {pasteMode && !isSource && (
                            <input
                              type="checkbox"
                              checked={isSelectedTarget}
                              onChange={() => togglePasteTarget(date)}
                              aria-label={t('rosters.selectPasteDateAria', { date: formatDate(date) })}
                              className={`absolute right-2 top-2 z-10 ${checkboxBase}`}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={creating} className={`gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            {isEdit ? t('rosters.saveSubmit') : t('rosters.createSubmit')}
          </button>
        </form>
      </div>

      <DayShiftDialog
        open={editingDate !== null}
        date={editingDate}
        templates={templates}
        responsibilities={responsibilities}
        rows={editingDate ? dayShifts[editingDate] || [] : []}
        onAddRow={(shiftTemplateId) => editingDate && addDayShift(editingDate, shiftTemplateId)}
        onRemoveRow={(rowIndex) => editingDate && removeDayShift(editingDate, rowIndex)}
        onAddRequirement={(rowIndex) => editingDate && addRequirement(editingDate, rowIndex)}
        onRemoveRequirement={(rowIndex, reqIndex) => editingDate && removeRequirement(editingDate, rowIndex, reqIndex)}
        onRequirementChange={(rowIndex, reqIndex, patch) =>
          editingDate && updateRequirement(editingDate, rowIndex, reqIndex, patch)
        }
        onClose={() => setEditingDate(null)}
      />
    </AppShell>
  );
}
