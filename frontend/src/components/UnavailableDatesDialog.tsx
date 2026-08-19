import { useEffect, useState } from 'react';
import { api, Staff } from '../api/client';
import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { Spinner } from './Spinner';
import { btnPrimary, btnSecondary, errorText, inputBase, labelBase } from '../styles/ui';

interface UnavailableDatesDialogProps {
  open: boolean;
  staff: Staff | null;
  onClose: () => void;
  onSaved: (updated: Staff) => void;
}

export function UnavailableDatesDialog({ open, staff, onClose, onSaved }: UnavailableDatesDialogProps) {
  const { mounted, visible } = useTransitionPresence(open, 300);
  const [ranges, setRanges] = useState<{ start: string; end: string }[]>([]);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRanges(staff?.preference?.unavailableDateRanges ?? []);
      setNewStart('');
      setNewEnd('');
      setError(null);
    }
  }, [open, staff]);

  if (!mounted || !staff) return null;

  const addRange = () => {
    if (!newStart || !newEnd) {
      setError('请选择开始和结束日期');
      return;
    }
    if (newStart > newEnd) {
      setError('开始日期不能晚于结束日期');
      return;
    }
    setError(null);
    setRanges((prev) => [...prev, { start: newStart, end: newEnd }]);
    setNewStart('');
    setNewEnd('');
  };

  const removeRange = (index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const preference = staff.preference;
      const updated = await api.staff.updatePreference(staff.id, {
        preferredShifts: preference?.preferredShifts ?? [],
        unavailableShifts: preference?.unavailableShifts ?? [],
        unavailableDateRanges: ranges,
        minHours: preference?.minHours ?? 0,
        maxHours: preference?.maxHours ?? 40,
        hoursPeriod: preference?.hoursPeriod ?? 'weekly',
        hoursUnit: preference?.hoursUnit ?? 'hours',
      });
      onSaved({ ...staff, preference: updated });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

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
        aria-labelledby="unavailable-dates-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-[24px] border border-tan/15 bg-white p-6 shadow-warm transition-all duration-300 ease-in-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <h2 id="unavailable-dates-dialog-title" className="font-display text-lg font-semibold text-ink">
          {staff.name} 的不可用日期
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">病假、年假等原因导致的不可安排时段</p>

        {error && (
          <p role="alert" className={`mt-3 ${errorText}`}>
            {error}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {ranges.length === 0 ? (
            <p className="text-sm text-ink-soft">还没有设置不可用日期。</p>
          ) : (
            ranges.map((r, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-2xl border border-tan/15 bg-white/60 px-3 py-2"
              >
                <span className="text-sm text-ink">
                  {r.start} ~ {r.end}
                </span>
                <button
                  type="button"
                  onClick={() => removeRange(index)}
                  aria-label={`移除 ${r.start} 至 ${r.end}`}
                  className="shrink-0 text-ink-soft transition hover:text-red-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <p className={labelBase}>添加不可用日期段</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="unavailable-range-start" className={labelBase}>
                开始日期
              </label>
              <input
                id="unavailable-range-start"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="unavailable-range-end" className={labelBase}>
                结束日期
              </label>
              <input
                id="unavailable-range-end"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className={inputBase}
              />
            </div>
            <button type="button" onClick={addRange} className={btnSecondary}>
              添加
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            取消
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={`gap-2 ${btnPrimary}`}>
            {saving && <Spinner className="h-4 w-4" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
