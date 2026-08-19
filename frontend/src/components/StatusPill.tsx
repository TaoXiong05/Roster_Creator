export function StatusPill({ status }: { status: string }) {
  const isPublished = status === 'published';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isPublished ? 'bg-eucalyptus/15 text-eucalyptus-dark' : 'bg-tan/20 text-tan'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? 'bg-eucalyptus-dark' : 'bg-tan'}`} />
      {status}
    </span>
  );
}
