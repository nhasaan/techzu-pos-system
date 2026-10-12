import { cn } from '../../lib/utils';

/** Placeholder block with a soft shimmer, sized like the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-muted', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-foreground/6 to-transparent" />
    </div>
  );
}

/** Table-shaped loading state: keeps the layout stable instead of a jumping "Loading…" line. */
export function TableSkeleton({ rows = 6, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="appear-delayed space-y-3 py-2" role="status" aria-label="Loading">
      <div className="flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1 opacity-60" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4" style={{ opacity: 1 - r * 0.12 }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-5 flex-1', c === 0 && 'flex-[1.6]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Whole-page placeholder used while a route's code chunk loads. */
export function PageSkeleton() {
  return (
    <div className="appear-delayed space-y-6 p-6" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <div className="rounded-lg border border-border p-6">
        <TableSkeleton />
      </div>
    </div>
  );
}
