import { cn } from "@/lib/utils";

/** Pulsing placeholder block matching the glass card aesthetic. */
function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-secondary/60", className)} />;
}

/** Grid of skeleton entity cards for archive list routes (characters, orgs, clans…). */
export function EntityGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading archive entries">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass flex gap-4 rounded-2xl p-4">
          <Bone className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/2" />
            <Bone className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton rows for list-style pages (vault documents, episodes…). */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="grid gap-3" aria-label="Loading documents">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="glass flex items-center gap-3 rounded-xl p-4">
          <Bone className="h-5 w-5 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Full-panel skeleton for graph/map style routes. */
export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass relative overflow-hidden rounded-2xl", className)} aria-label="Loading">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary/40 via-secondary/20 to-transparent" />
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
          Loading archive…
        </div>
      </div>
    </div>
  );
}
