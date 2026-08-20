import { api, AssignmentEntry, Responsibility, RosterShift, Staff } from '../api/client';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import { weekdayLabel } from '../utils/calendarGrid';
import { formatDate } from '../utils/date';
import { btnSecondary, inputBase } from '../styles/ui';
import { Spinner } from './Spinner';

const TAG_OPTIONS = ['AGENT', 'PICKUP'];

interface DayAssignmentDialogProps {
  open: boolean;
  date: string | null;
  rosterId: string;
  dayRosterShifts: RosterShift[];
  assignments: AssignmentEntry[];
  members: Staff[];
  responsibilities: Responsibility[];
  sendingStaffId: string | null;
  onAssignmentChange: (assignmentId: string, patch: Partial<AssignmentEntry>) => void;
  onSendOne: (staffId: string) => void;
  onClose: () => void;
}

export function DayAssignmentDialog({
  open,
  date,
  rosterId,
  dayRosterShifts,
  assignments,
  members,
  responsibilities,
  sendingStaffId,
  onAssignmentChange,
  onSendOne,
  onClose,
}: DayAssignmentDialogProps) {
  const { mounted, visible } = useTransitionPresence(open, 300);
  const { t, language } = useLanguage();
  const weekdays = getDictionary(language).weekdaysShort;
  if (!mounted || !date) return null;

  const byTemplate = new Map<string, RosterShift[]>();
  for (const rs of dayRosterShifts) {
    const list = byTemplate.get(rs.shiftTemplate.id) ?? [];
    list.push(rs);
    byTemplate.set(rs.shiftTemplate.id, list);
  }
  const groups = Array.from(byTemplate.values());

  return (
    <div
      role="presentation"
      onClick={onClose}
      className={`fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 transition-opacity duration-300 ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-assignment-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-tan/15 bg-white p-6 shadow-warm transition-all duration-300 ease-in-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <h2 id="day-assignment-dialog-title" className="font-display text-lg font-semibold text-ink">
          {formatDate(date)}（{weekdayLabel(date, weekdays)}）
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">{t('dayAssignmentDialog.subtitle')}</p>

        <div className="mt-4 space-y-3">
          {groups.map((group) => {
            const tpl = group[0].shiftTemplate;
            return (
              <div key={tpl.id} className="space-y-2.5 rounded-2xl border border-tan/15 bg-white/60 p-3">
                <p className="text-sm font-medium text-ink">
                  {tpl.name}（{tpl.startTime}-{tpl.endTime}）
                </p>
                <div className="space-y-3">
                  {group.map((rs) => {
                    const responsibilityName =
                      responsibilities.find((r) => r.id === rs.responsibilityId)?.name ?? t('rosters.unknownResponsibility');
                    const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
                    return (
                      <div key={rs.id} className="space-y-1.5">
                        <p className="text-xs font-semibold text-ink-soft">{responsibilityName}</p>
                        {rows.map((row) => (
                          <div key={row.id} className="flex flex-col gap-2 rounded-xl bg-sand/30 p-2 lg:flex-row lg:items-center">
                            <select
                              value={row.staffId ?? ''}
                              onChange={(e) => onAssignmentChange(row.id, { staffId: e.target.value || null, unfilledTag: null })}
                              aria-label={t('rosters.assignStaffAria')}
                              className={`${inputBase} lg:w-56 lg:shrink-0`}
                            >
                              <option value="">{t('rosters.unassigned')}</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            {!row.staffId && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {TAG_OPTIONS.map((tag) => (
                                  <button
                                    type="button"
                                    key={tag}
                                    onClick={() => onAssignmentChange(row.id, { unfilledTag: tag })}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                      row.unfilledTag === tag
                                        ? 'border-coral-deep bg-coral-deep text-white'
                                        : 'border-tan/30 bg-white/70 text-ink-soft hover:border-coral/40'
                                    }`}
                                  >
                                    {tag}
                                  </button>
                                ))}
                                <input
                                  placeholder={t('rosters.customTagPlaceholder')}
                                  value={row.unfilledTag && !TAG_OPTIONS.includes(row.unfilledTag) ? row.unfilledTag : ''}
                                  onChange={(e) => onAssignmentChange(row.id, { unfilledTag: e.target.value || null })}
                                  className="w-32 rounded-full border border-tan/30 bg-white/70 px-3 py-1 text-xs text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30"
                                />
                              </div>
                            )}
                            {row.staffId && (
                              <div className="flex shrink-0 items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => onSendOne(row.staffId!)}
                                  disabled={sendingStaffId === row.staffId}
                                  className="inline-flex items-center gap-1.5 font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline disabled:no-underline disabled:opacity-60"
                                >
                                  {sendingStaffId === row.staffId && <Spinner className="h-3.5 w-3.5" />}
                                  {t('rosters.sendToThem')}
                                </button>
                                <a
                                  href={api.rosters.exportUrl(rosterId, 'ics', row.staffId)}
                                  className="font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline"
                                >
                                  {t('rosters.personalIcs')}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
