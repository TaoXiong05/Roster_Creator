import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail, AssignmentEntry, Responsibility, RosterShift, Staff } from '../api/client';
import { formatDate } from '../utils/date';
import {
  DAYS_PER_PAGE,
  datesBetween,
  formatMonthLabel,
  monthGridDates,
  monthsInRange,
  todayISODate,
  ViewLength,
  weekdayLabel,
} from '../utils/calendarGrid';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { DayAssignmentDialog } from '../components/DayAssignmentDialog';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { StatusPill } from '../components/StatusPill';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import { btnPillActive, btnPillInactive, btnPrimary, btnSecondary, cardBase, errorText, successText } from '../styles/ui';

interface ShiftGroupSummary {
  shiftTemplate: RosterShift['shiftTemplate'];
  roles: { responsibilityId: string; responsibilityName: string; filledNames: string[]; unfilledCount: number }[];
}

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const weekdays = getDictionary(language).weekdaysShort;
  const [roster, setRoster] = useState<RosterDetail | null>(null);
  const [members, setMembers] = useState<Staff[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingSeconds, setGeneratingSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingStaffId, setSendingStaffId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [viewLength, setViewLength] = useState<ViewLength>('weekly');
  const [pageIndex, setPageIndex] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'unfilled'>('calendar');

  const loadRoster = async () => {
    if (!id) return;
    const r = await api.rosters.get(id);
    setRoster(r);
    setAssignments(r.rosterShifts.flatMap((rs) => rs.assignments));
    const groupMembers = await api.groups.listMembers(r.groupId);
    setMembers(groupMembers);
    setDirty(false);
  };

  useEffect(() => {
    loadRoster();
  }, [id]);

  useEffect(() => {
    api.responsibilities.list().then(setResponsibilities);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    setPageIndex(0);
  }, [viewLength, roster?.id]);

  useEffect(() => {
    if (!generating) return;
    setGeneratingSeconds(0);
    const interval = setInterval(() => setGeneratingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  const handleGenerate = async () => {
    if (!id) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await api.rosters.generateAssignments(id);
      setAssignments(result.assignments);
      setRoster((prev) => (prev ? { ...prev, status: result.status } : prev));
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rosters.aiFailedError'));
    } finally {
      setGenerating(false);
    }
  };

  const updateAssignment = (assignmentId: string, patch: Partial<AssignmentEntry>) => {
    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      const result = await api.rosters.saveAssignments(
        id,
        assignments.map((a) => ({ id: a.id, staffId: a.staffId, unfilledTag: a.unfilledTag }))
      );
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      const updated = await api.rosters.publish(id);
      setRoster((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } finally {
      setPublishing(false);
    }
  };

  const handleSendAll = async () => {
    if (!id) return;
    setEmailStatus(null);
    setSendingAll(true);
    try {
      const result = await api.rosters.sendEmails(id);
      setEmailStatus(t('rosters.sentToCount', { count: result.sentTo.length }));
    } finally {
      setSendingAll(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendOne = async (staffId: string) => {
    if (!id) return;
    setEmailStatus(null);
    setSendingStaffId(staffId);
    try {
      const result = await api.rosters.sendEmails(id, [staffId]);
      setEmailStatus(t('rosters.sentToCount', { count: result.sentTo.length }));
    } finally {
      setSendingStaffId(null);
    }
  };

  if (!roster)
    return (
      <AppShell width="wide">
        <PageSkeleton rows={5} />
      </AppShell>
    );

  const dateRangeStart = roster.dateRangeStart.slice(0, 10);
  const dateRangeEnd = roster.dateRangeEnd.slice(0, 10);
  const availableDates = datesBetween(dateRangeStart, dateRangeEnd);
  const availableDatesSet = new Set(availableDates);
  // Printing renders the whole roster (not just whatever page is currently on screen), chunked into
  // 7-day weeks with a page break between them — same "one week per page" convention as the PDF export.
  const printWeeks: string[][] = [];
  for (let i = 0; i < availableDates.length; i += 7) {
    printWeeks.push(availableDates.slice(i, i + 7));
  }
  const months = monthsInRange(dateRangeStart, dateRangeEnd);
  const isMonthly = viewLength === 'monthly';
  const daysPerPage = DAYS_PER_PAGE[viewLength];
  const totalPages = isMonthly ? Math.max(1, months.length) : Math.max(1, Math.ceil(availableDates.length / daysPerPage!));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageDates = isMonthly
    ? monthGridDates(months[clampedPageIndex] ?? dateRangeStart.slice(0, 7))
    : availableDates.slice(clampedPageIndex * daysPerPage!, clampedPageIndex * daysPerPage! + daysPerPage!);
  const today = todayISODate();

  const rosterShiftsByDate = new Map<string, RosterShift[]>();
  for (const rs of roster.rosterShifts) {
    const date = rs.date.slice(0, 10);
    const list = rosterShiftsByDate.get(date) ?? [];
    list.push(rs);
    rosterShiftsByDate.set(date, list);
  }

  // unfilledOnly narrows each day's roles down to the ones still missing staff — used to drive the
  // Unfilled tab, which reuses this exact same grid/pagination rather than a separate layout.
  const summarizeDate = (date: string, unfilledOnly = false): ShiftGroupSummary[] => {
    const dayShifts = rosterShiftsByDate.get(date) ?? [];
    const byTemplate = new Map<string, RosterShift[]>();
    for (const rs of dayShifts) {
      const list = byTemplate.get(rs.shiftTemplate.id) ?? [];
      list.push(rs);
      byTemplate.set(rs.shiftTemplate.id, list);
    }
    return Array.from(byTemplate.values())
      .map((group) => ({
        shiftTemplate: group[0].shiftTemplate,
        roles: group
          .map((rs) => {
            const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
            return {
              responsibilityId: rs.responsibilityId,
              responsibilityName: responsibilities.find((r) => r.id === rs.responsibilityId)?.name ?? t('rosters.unknownResponsibility'),
              filledNames: rows.filter((r) => r.staffId).map((r) => members.find((m) => m.id === r.staffId)?.name ?? r.staff?.name ?? '?'),
              unfilledCount: rows.filter((r) => !r.staffId).length,
            };
          })
          .filter((role) => !unfilledOnly || role.unfilledCount > 0),
      }))
      .filter((group) => group.roles.length > 0);
  };

  const dayHasUnfilled = (date: string): boolean =>
    (rosterShiftsByDate.get(date) ?? []).some((rs) => assignments.some((a) => a.rosterShiftId === rs.id && !a.staffId));

  const editingDayShifts = editingDate ? rosterShiftsByDate.get(editingDate) ?? [] : [];

  const totalUnfilledCount = assignments.filter((a) => !a.staffId).length;

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <div className="print:hidden">
          <BackLink to="/rosters" label={t('rosters.backToRosters')} />
        </div>
        <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink">{roster.name}</h1>
              <StatusPill status={roster.status} />
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDate(roster.dateRangeStart)} ~ {formatDate(roster.dateRangeEnd)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleGenerate} disabled={generating} className={`gap-2 ${btnSecondary}`}>
              {generating && <Spinner className="h-4 w-4" />}
              {generating ? t('rosters.generating', { seconds: generatingSeconds }) : t('rosters.generateButton')}
            </button>
            <button type="button" onClick={handleSave} disabled={!dirty || saving} className={`gap-2 ${btnPrimary}`}>
              {saving && <Spinner className="h-4 w-4" />}
              {t('rosters.saveButton')}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={roster.status !== 'preview' || publishing}
              title={roster.status === 'draft' || roster.status === 'generating' ? t('rosters.publishRequiresPreviewHint') : undefined}
              className={`gap-2 ${btnSecondary}`}
            >
              {publishing && <Spinner className="h-4 w-4" />}
              {t('rosters.publishButton')}
            </button>
            <button
              type="button"
              onClick={handleSendAll}
              disabled={sendingAll || roster.status !== 'published'}
              title={roster.status !== 'published' ? t('rosters.sendExportRequiresPublishHint') : undefined}
              className={`gap-2 ${btnSecondary}`}
            >
              {sendingAll && <Spinner className="h-4 w-4" />}
              {t('rosters.sendAllButton')}
            </button>
            <button type="button" onClick={handlePrint} className={`gap-2 ${btnSecondary}`}>
              {t('rosters.printButton')}
            </button>
          </div>
        </div>

        {generating && <p className="text-sm text-ink-soft print:hidden">{t('rosters.generateHint')}</p>}

        {error && (
          <p role="alert" className={`${errorText} print:hidden`}>
            {error}
          </p>
        )}
        {emailStatus && <p className={`${successText} print:hidden`}>{emailStatus}</p>}

        {roster.status !== 'published' && (
          <p className="text-sm text-ink-soft print:hidden">{t('rosters.sendExportRequiresPublishHint')}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm print:hidden">
          {(['ics', 'csv', 'pdf'] as const).map((format) =>
            roster.status === 'published' ? (
              <a
                key={format}
                href={api.rosters.exportUrl(roster.id, format, undefined, activeTab === 'unfilled')}
                className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline"
              >
                {t(`rosters.export${format === 'ics' ? 'Ics' : format === 'csv' ? 'Csv' : 'Pdf'}`)}
              </a>
            ) : (
              <span key={format} className="cursor-not-allowed text-ink-soft/50">
                {t(`rosters.export${format === 'ics' ? 'Ics' : format === 'csv' ? 'Csv' : 'Pdf'}`)}
              </span>
            )
          )}
        </div>

        {activeTab === 'unfilled' && roster.status === 'published' && (
          <p className="text-sm text-ink-soft print:hidden">{t('rosters.exportUnfilledOnlyHint')}</p>
        )}

        <div className="flex gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={activeTab === 'calendar' ? btnPillActive : btnPillInactive}
          >
            {t('rosters.tabCalendar')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unfilled')}
            className={activeTab === 'unfilled' ? btnPillActive : btnPillInactive}
          >
            {t('rosters.tabUnfilled')}
            {totalUnfilledCount > 0 && (
              <span
                aria-hidden="true"
                className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"
              >
                {totalUnfilledCount}
              </span>
            )}
          </button>
        </div>

        <div className={`${cardBase} space-y-3 print:hidden`}>
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
              const groups = summarizeDate(date, activeTab === 'unfilled');
              const isToday = date === today;
              const hasUnfilled = dayHasUnfilled(date);
              const dayHasAnyShifts = (rosterShiftsByDate.get(date) ?? []).length > 0;
              const emptyMessage =
                activeTab === 'unfilled' && dayHasAnyShifts ? t('rosters.dayFullyStaffed') : t('rosters.noShiftsScheduled');
              const cellContent = (
                <>
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
                  {groups.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-soft/60">{emptyMessage}</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {groups.map((g) => (
                        <li key={g.shiftTemplate.id} className="text-xs text-ink">
                          <p className="font-medium">{g.shiftTemplate.name}</p>
                          {g.roles.map((role) => (
                            <p key={role.responsibilityId} className="text-ink-soft">
                              {role.responsibilityName}
                              {t('common.colon')}
                              {role.filledNames.join(t('common.listSeparator'))}
                              {role.unfilledCount > 0 && (
                                <span className="ml-1 font-medium text-amber-700">
                                  {t('rosters.unfilledCountBadge', { count: role.unfilledCount })}
                                </span>
                              )}
                            </p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );
              if (groups.length === 0) {
                return (
                  <div
                    key={date}
                    className={`min-h-[6.5rem] rounded-2xl border p-3 text-left ${
                      isToday ? 'border-coral-deep/50 bg-coral-deep/5 ring-1 ring-coral-deep/20' : 'border-tan/15 bg-white/40'
                    }`}
                  >
                    {cellContent}
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => setEditingDate(date)}
                  className={`min-h-[6.5rem] rounded-2xl border p-3 text-left transition hover:border-coral/40 hover:bg-white ${
                    hasUnfilled
                      ? 'border-amber-400/60 bg-amber-50/60'
                      : isToday
                      ? 'border-coral-deep/50 bg-coral-deep/5 ring-1 ring-coral-deep/20'
                      : 'border-tan/15 bg-white/60'
                  }`}
                >
                  {cellContent}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-xl font-semibold text-ink">
            {roster.name}
            {activeTab === 'unfilled' ? ` — ${t('rosters.tabUnfilled')}` : ''}
          </h1>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            {formatDate(roster.dateRangeStart)} ~ {formatDate(roster.dateRangeEnd)}
          </p>
          {printWeeks.map((week, weekIndex) => (
            <div key={week[0]} style={weekIndex > 0 ? { breakBefore: 'page' } : undefined}>
              <h2 className="mb-2 mt-4 text-sm font-semibold text-ink">
                {formatDate(week[0])} ~ {formatDate(week[week.length - 1])}
              </h2>
              {week.map((date) => {
                const groups = summarizeDate(date, activeTab === 'unfilled');
                if (groups.length === 0) return null;
                return (
                  <div key={date} className="mb-3">
                    <p className="text-sm font-medium text-ink">
                      {formatDate(date)} ({weekdayLabel(date, weekdays)})
                    </p>
                    {groups.map((g) => (
                      <div key={g.shiftTemplate.id} className="pl-3">
                        {g.roles.map((role) => (
                          <p key={role.responsibilityId} className="text-sm text-ink-soft">
                            {g.shiftTemplate.name} · {role.responsibilityName} ({g.shiftTemplate.startTime}-{g.shiftTemplate.endTime}) —{' '}
                            {role.filledNames.join(t('common.listSeparator')) || t('rosters.unassigned')}
                            {role.unfilledCount > 0 && ` (${t('rosters.unfilledCountBadge', { count: role.unfilledCount })})`}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <DayAssignmentDialog
        open={editingDate !== null}
        date={editingDate}
        rosterId={roster.id}
        dayRosterShifts={editingDayShifts}
        assignments={assignments}
        members={members}
        responsibilities={responsibilities}
        sendingStaffId={sendingStaffId}
        canSend={roster.status === 'published'}
        onAssignmentChange={updateAssignment}
        onSendOne={handleSendOne}
        onClose={() => setEditingDate(null)}
      />
    </AppShell>
  );
}
