/** Skeleton shown while a page's data loads on a slow phone connection. */
export function LoadingCards({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-steel/50" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-steel/50" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
