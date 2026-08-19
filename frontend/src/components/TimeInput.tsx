import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { inputBase } from '../styles/ui';

const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
const OUTER_HOURS = Array.from({ length: 12 }, (_, i) => i); // 00-11
const INNER_HOURS = Array.from({ length: 12 }, (_, i) => i + 12); // 12-23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00,05,...,55

// Auto-inserts the ':' as the user types digits, e.g. "0600" -> "06:00".
function autoFormatTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function polar(index: number, count: number, radius: number, center: number) {
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  return { left: center + radius * Math.cos(angle), top: center + radius * Math.sin(angle) };
}

interface TimeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function TimeInput({ id, value, onChange, placeholder, required }: TimeInputProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const containerRef = useRef<HTMLDivElement>(null);

  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const currentHour = match ? Number(match[1]) : null;
  const currentMinute = match ? Number(match[2]) : null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const openPicker = () => {
    setMode('hour');
    setOpen(true);
  };

  const selectHour = (hour: number) => {
    onChange(`${pad(hour)}:${pad(currentMinute ?? 0)}`);
    setMode('minute');
  };

  const selectMinute = (minute: number) => {
    onChange(`${pad(currentHour ?? 0)}:${pad(minute)}`);
    setOpen(false);
  };

  const center = 100;
  const outerRadius = 82;
  const innerRadius = 50;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          pattern={TIME_PATTERN}
          title={t('timeInput.titleAttr', { example: '06:00' })}
          value={value}
          onChange={(e) => onChange(autoFormatTime(e.target.value))}
          className={inputBase}
          required={required}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          aria-label={t('timeInput.openPicker')}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl border border-tan/30 bg-white text-ink-soft transition hover:border-coral focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-40 mt-2 w-[240px] rounded-[24px] border border-tan/15 bg-white p-4 shadow-warm">
          <div className="mb-3 flex items-center justify-center gap-1.5 font-display text-2xl font-semibold text-ink">
            <button
              type="button"
              onClick={() => setMode('hour')}
              className={`rounded-lg px-2 py-0.5 transition ${mode === 'hour' ? 'bg-coral-deep text-white' : 'text-ink-soft hover:bg-sand'}`}
            >
              {pad(currentHour ?? 0)}
            </button>
            <span>:</span>
            <button
              type="button"
              onClick={() => setMode('minute')}
              className={`rounded-lg px-2 py-0.5 transition ${mode === 'minute' ? 'bg-coral-deep text-white' : 'text-ink-soft hover:bg-sand'}`}
            >
              {pad(currentMinute ?? 0)}
            </button>
          </div>

          <div className="relative mx-auto" style={{ width: center * 2, height: center * 2 }}>
            <div className="absolute inset-0 rounded-full border border-tan/20 bg-sand/40" />
            {mode === 'hour' ? (
              <>
                {OUTER_HOURS.map((h) => {
                  const pos = polar(h, 12, outerRadius, center);
                  const active = currentHour === h;
                  return (
                    <button
                      type="button"
                      key={h}
                      onClick={() => selectHour(h)}
                      aria-label={t('timeInput.hourAria', { value: pad(h) })}
                      style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ${
                        active ? 'bg-coral-deep text-white' : 'text-ink hover:bg-white'
                      }`}
                    >
                      {pad(h)}
                    </button>
                  );
                })}
                {INNER_HOURS.map((h) => {
                  const pos = polar(h - 12, 12, innerRadius, center);
                  const active = currentHour === h;
                  return (
                    <button
                      type="button"
                      key={h}
                      onClick={() => selectHour(h)}
                      aria-label={t('timeInput.hourAria', { value: pad(h) })}
                      style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition ${
                        active ? 'bg-coral-deep text-white' : 'text-ink-soft hover:bg-white'
                      }`}
                    >
                      {pad(h)}
                    </button>
                  );
                })}
              </>
            ) : (
              MINUTES.map((m, i) => {
                const pos = polar(i, 12, outerRadius, center);
                const active = currentMinute === m;
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => selectMinute(m)}
                    aria-label={t('timeInput.minuteAria', { value: pad(m) })}
                    style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ${
                      active ? 'bg-coral-deep text-white' : 'text-ink hover:bg-white'
                    }`}
                  >
                    {pad(m)}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-coral-deep hover:underline">
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
