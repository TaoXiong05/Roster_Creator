/**
 * Lightweight skeleton block for loading placeholders. Uses a soft pulse that
 * is disabled under prefers-reduced-motion.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-xl bg-tan/20 ${className}`}
    />
  );
}

/** A ready-made loading layout for data pages: header + stacked card placeholders. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="加载中">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
