import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";
import { characterSeriesQuery, seriesStatusClass } from "@/lib/series";
import { useUiToggles } from "@/lib/ui-toggles";
import type { Entity } from "@/lib/entities";

/**
 * "Series appearances" block inside an entity dossier: every series the
 * character belongs to, with their per-series status badge. Badges deep-link
 * to that series' detail view.
 */
export function SeriesAppearances({ entity }: { entity: Entity }) {
  const { data: rows } = useQuery(characterSeriesQuery(entity.id));
  const ui = useUiToggles();
  const list = (rows ?? []).filter((r) => r.series);
  if (list.length === 0) return null;

  return (
    <div className="grid gap-3">
      <h4 className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <BookMarked className="h-3.5 w-3.5" /> Series appearances
      </h4>
      <div className="flex flex-wrap gap-2">
        {list.map((r) => {
          const s = r.series;
          if (!s) return null;
          const statusClass = seriesStatusClass[r.status] ?? "text-status-neutral";
          return (
            <Link
              key={r.id}
              to="/series"
              search={{ s: s.id }}
              className="group flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-3 pr-2 text-xs transition-colors hover:border-accent/60 hover:bg-secondary"
              title={r.role_in_series ?? undefined}
            >
              <span className="max-w-40 truncate font-medium">{s.title}</span>
              {ui.showArcRoles && r.arc_role && (
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                  {r.arc_role}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${statusClass}`}>
                <span className="h-1 w-1 rounded-full bg-current" />
                {r.status}
              </span>
            </Link>
          );
        })}
      </div>
      {(list.some((r) => r.role_in_series)) && (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {list.filter((r) => r.role_in_series && r.series).map((r) => (
            <li key={r.id}>
              <span className="text-foreground/80">{r.series!.title}:</span> {r.role_in_series}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
