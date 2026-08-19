import { useLanguage } from '../i18n/LanguageContext';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  const target = language === 'en' ? 'zh' : 'en';
  const label = language === 'en' ? '中文' : 'English';

  return (
    <button
      type="button"
      onClick={() => setLanguage(target)}
      aria-label={`Switch to ${target === 'zh' ? 'Chinese' : 'English'}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-tan/30 bg-white/85 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-coral/40 hover:text-ink ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9s1.3-6.5 3.8-9Z" />
      </svg>
      {label}
    </button>
  );
}
