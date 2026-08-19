import { Link } from 'react-router-dom';
import { Responsibility, ShiftTemplate } from '../api/client';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { btnPillInactive, btnSecondary, labelBase } from '../styles/ui';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
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
        className={`w-full max-w-md rounded-[24px] border border-tan/15 bg-white p-6 shadow-warm transition-all duration-300 ease-in-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <h2 id="day-shift-dialog-title" className="font-display text-lg font-semibold text-ink">
          {date.slice(5)}（周{weekdayLabel(date)}）
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">设置这一天需要的班次、职责和人数</p>

        {responsibilities.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
            <span>还没有设置职责模板，需要先创建至少一个职责才能设置人数</span>
            <Link to="/responsibilities" className="font-medium text-coral-deep hover:underline">
              去设置 →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-ink-soft">还没有添加班次。</p>
              ) : (
                rows.map((row, rowIndex) => {
                  const t = templates.find((tpl) => tpl.id === row.shiftTemplateId);
                  return (
                    <div
                      key={row.shiftTemplateId}
                      className="space-y-2.5 rounded-2xl border border-tan/15 bg-white/60 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-ink">{t?.name ?? '未知班次'}</p>
                          {t && (
                            <p className="text-xs text-ink-soft">
                              {t.startTime}-{t.endTime}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveRow(rowIndex)}
                          aria-label={`移除${t?.name ?? ''}`}
                          className="shrink-0 text-ink-soft transition hover:text-red-600"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {row.requirements.map((req, reqIndex) => {
                          const respName = responsibilities.find((r) => r.id === req.responsibilityId)?.name ?? '职责';
                          return (
                            <div key={reqIndex} className="flex items-center gap-2">
                              <select
                                value={req.responsibilityId}
                                onChange={(e) => onRequirementChange(rowIndex, reqIndex, { responsibilityId: e.target.value })}
                                aria-label={`${t?.name ?? ''} 职责 ${reqIndex + 1}`}
                                className="flex-1 rounded-lg border border-tan/30 bg-white/70 px-2 py-1 text-sm text-ink outline-none transition focus:border-coral focus:ring-1 focus:ring-coral/30"
                              >
                                <option value="">选择职责</option>
                                {responsibilities.map((r) => (
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
                                aria-label={`${t?.name ?? ''} ${respName} 所需人数`}
                                className="w-16 rounded-lg border border-tan/30 bg-white/70 px-2 py-1 text-center text-sm text-ink outline-none transition focus:border-coral focus:ring-1 focus:ring-coral/30"
                              />
                              <button
                                type="button"
                                onClick={() => onRemoveRequirement(rowIndex, reqIndex)}
                                aria-label={`移除${t?.name ?? ''}的${respName}需求`}
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
                        + 添加更多职责需求
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4">
              <p className={labelBase}>添加班次</p>
              {templates.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-tan/30 bg-white/40 px-3 py-2.5 text-sm text-ink-soft">
                  <span>还没有设置班次模板，先去创建一个吧</span>
                  <Link to="/shift-templates" className="font-medium text-coral-deep hover:underline">
                    去设置 →
                  </Link>
                </div>
              ) : availableTemplates.length === 0 ? (
                <p className="text-sm text-ink-soft">已经把所有班次都加上了。</p>
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
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
