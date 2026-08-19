import { Link } from 'react-router-dom';
import { ShiftTemplate } from '../api/client';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { btnPillInactive, btnSecondary, labelBase } from '../styles/ui';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export interface DayShiftRow {
  shiftTemplateId: string;
  headcount: number;
}

interface DayShiftDialogProps {
  open: boolean;
  date: string | null;
  templates: ShiftTemplate[];
  rows: DayShiftRow[];
  onAddRow: (shiftTemplateId: string) => void;
  onRemoveRow: (index: number) => void;
  onHeadcountChange: (index: number, value: number) => void;
  onClose: () => void;
}

export function DayShiftDialog({
  open,
  date,
  templates,
  rows,
  onAddRow,
  onRemoveRow,
  onHeadcountChange,
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
        <p className="mt-0.5 text-sm text-ink-soft">设置这一天需要的班次和人数</p>

        <div className="mt-4 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-soft">还没有添加班次。</p>
          ) : (
            rows.map((row, index) => {
              const t = templates.find((tpl) => tpl.id === row.shiftTemplateId);
              return (
                <div
                  key={row.shiftTemplateId}
                  className="flex items-center gap-3 rounded-2xl border border-tan/15 bg-white/60 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{t?.name ?? '未知班次'}</p>
                    {t && (
                      <p className="text-xs text-ink-soft">
                        {t.startTime}-{t.endTime}
                      </p>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={row.headcount}
                    onChange={(e) => onHeadcountChange(index, Number(e.target.value))}
                    aria-label={`${t?.name ?? ''} 所需人数`}
                    className="w-16 rounded-lg border border-tan/30 bg-white/70 px-2 py-1 text-center text-sm text-ink outline-none transition focus:border-coral focus:ring-1 focus:ring-coral/30"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveRow(index)}
                    aria-label={`移除${t?.name ?? ''}`}
                    className="shrink-0 text-ink-soft transition hover:text-red-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
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

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
