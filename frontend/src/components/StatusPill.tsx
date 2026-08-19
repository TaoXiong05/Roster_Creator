const STATUS_MAP: Record<string, { label: string; tone: string; dot: string }> = {
  published: { label: '已发布', tone: 'bg-eucalyptus/15 text-eucalyptus-dark', dot: 'bg-eucalyptus-dark' },
  draft: { label: '草稿', tone: 'bg-tan/20 text-tan', dot: 'bg-tan' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: 'bg-tan/20 text-tan', dot: 'bg-tan' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
