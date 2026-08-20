import { useLanguage } from '../i18n/LanguageContext';

const STATUS_MAP: Record<string, { labelKey: string; tone: string; dot: string }> = {
  published: { labelKey: 'rosters.published', tone: 'bg-eucalyptus/15 text-eucalyptus-dark', dot: 'bg-eucalyptus-dark' },
  draft: { labelKey: 'common.draft', tone: 'bg-tan/20 text-tan', dot: 'bg-tan' },
  generating: { labelKey: 'rosters.statusGenerating', tone: 'bg-coral/15 text-coral-deep', dot: 'bg-coral-deep animate-pulse' },
  preview: { labelKey: 'rosters.statusPreview', tone: 'bg-dusk/15 text-dusk', dot: 'bg-dusk' },
};

export function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const s = STATUS_MAP[status];
  const label = s ? t(s.labelKey) : status;
  const tone = s?.tone ?? 'bg-tan/20 text-tan';
  const dot = s?.dot ?? 'bg-tan';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
