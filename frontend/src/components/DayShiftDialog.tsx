import { Link } from 'react-router-dom';
import { Responsibility, ShiftTemplate } from '../api/client';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../utils/date';
import { btnPillInactive, btnSecondary, labelBase } from '../styles/ui';

function weekdayLabel(date: string, weekdays: string[]): string {
  return weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export interface DayShiftRequirement {
  responsibilityId: string;
  headcount: number;
}

export interface DayShiftRow {
  shiftTemplateId: string;
  requirements: DayShiftRequirement[];
}

interface DayShiftDialogProps {
  open: boolean;
  date: string | null;
  templates: ShiftTemplate[];
  responsibilities: Responsibility[];
  rows: DayShiftRow[];
  onAddRow: (shiftTemplateId: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onAddRequirement: (rowIndex: number) => void;
  onRemoveRequirement: (rowIndex: number, reqIndex: number) => void;
  onRequirementChange: (rowIndex: number, reqIndex: number, patch: Partial<DayShiftRequirement>) => void;
  onClose: () => void;
}

export function DayShiftDialog({
  open,
  date,
  templates,
  responsibilities,
  rows,
  onAddRow,
  onRemoveRow,
  onAddRequirement,
  onRemoveRequirement,
  onRequirementChange,
  onClose,
}: DayShiftDialogProps) {
  const { mounted, visible } = useTransitionPresence(open, 300);
  const { t, language } = useLanguage();
  const weekdays = getDictionary(language).weekdaysShort;
  if (!mounted || !date) return null;

  const addedIds = new Set(rows.map((r) => r.shiftTemplateId));
  const availableTemplates = templates.filter((t) => !addedIds.has(t.id));

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
        aria-labelledby="day-shift-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-tan/15 bg-white p-6 shadow-warm transition-all duration-300 ease-in-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <h2 id="day-shift-dialog-title" className="font-display text-lg font-semibold text-ink">
          {formatDate(date)}（{weekdayLabel(date, weekdays)}）
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">{t('dayShiftDialog.subtitle')}</p>

        {responsibilities.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            <span>{t('common.noResponsibilityTemplatesHint')}</span>
            <Link to="/responsibilities" className="font-medium text-coral-deep hover:underline">
              {t('common.goSetUp')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-ink-soft">{t('dayShiftDialog.noRows')}</p>
              ) : (
                rows.map((row, rowIndex) => {
                  const tpl = templates.find((t) => t.id === row.shiftTemplateId);
                  return (
                    <div
                      key={row.shiftTemplateId}
                      className="space-y-2.5 rounded-2xl border border-tan/15 bg-white/60 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-ink">{tpl?.name ?? '?'}</p>
                          {tpl && (
                            <p className="text-xs text-ink-soft">
                              {tpl.startTime}-{tpl.endTime}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveRow(rowIndex)}
                          aria-label={t('dayShiftDialog.removeShiftAria', { name: tpl?.name ?? '' })}
                          className="shrink-0 text-ink-soft transition hover:text-red-600"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {row.requirements.map((req, reqIndex) => {
                          const respName =
                            responsibilities.find((r) => r.id === req.responsibilityId)?.name ??
                            t('dayShiftDialog.defaultResponsibilityLabel');
                          const usedIds = new Set(
                            row.requirements
                              .filter((_, i) => i !== reqIndex)
                              .map((r) => r.responsibilityId)
                              .filter(Boolean)
                          );
                          const availableResponsibilities = responsibilities.filter(
                            (r) => r.id === req.responsibilityId || !usedIds.has(r.id)
                          );
                          return (
                            <div key={reqIndex} className="flex items-center gap-2">
                              <select
                                value={req.responsibilityId}
                                onChange={(e) => onRequirementChange(rowIndex, reqIndex, { responsibilityId: e.target.value })}
                                aria-label={t('dayShiftDialog.responsibilityFieldAria', { shift: tpl?.name ?? '', index: reqIndex + 1 })}
                                className="flex-1 rounded-lg border border-tan/30 bg-white/70 px-2 py-1 text-sm text-ink outline-none transition focus:border-coral focus:ring-1 focus:ring-coral/30"
                              >
                                <option value="">{t('dayShiftDialog.selectResponsibility')}</option>
                                {availableResponsibilities.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={0}
                                value={req.headcount}
                                onChange={(e) =>
                                  onRequirementChange(rowIndex, reqIndex, { headcount: Math.max(0, Number(e.target.value)) })
                                }
                                aria-label={t('dayShiftDialog.headcountAria', { shift: tpl?.name ?? '', responsibility: respName })}
                                className="w-16 rounded-lg border border-tan/30 bg-white/70 px-2 py-1 text-center text-sm text-ink outline-none transition focus:border-coral focus:ring-1 focus:ring-coral/30"
                              />
                              <button
                                type="button"
                                onClick={() => onRemoveRequirement(rowIndex, reqIndex)}
                                aria-label={t('dayShiftDialog.removeRequirementAria', { shift: tpl?.name ?? '', responsibility: respName })}
                                className="shrink-0 text-ink-soft transition hover:text-red-600"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M6 6l12 12M18 6L6 18" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddRequirement(rowIndex)}
                        className="text-xs font-medium text-coral-deep hover:underline"
                      >
                        {t('dayShiftDialog.addMoreRequirement')}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4">
              <p className={labelBase}>{t('dayShiftDialog.addShiftHeading')}</p>
              {templates.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
                  <span>{t('common.noShiftTemplatesHint')}</span>
                  <Link to="/shift-templates" className="font-medium text-coral-deep hover:underline">
                    {t('common.goSetUp')}
                  </Link>
                </div>
              ) : availableTemplates.length === 0 ? (
                <p className="text-sm text-ink-soft">{t('dayShiftDialog.allAdded')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTemplates.map((t) => (
                    <button type="button" key={t.id} onClick={() => onAddRow(t.id)} className={btnPillInactive}>
                      + {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
