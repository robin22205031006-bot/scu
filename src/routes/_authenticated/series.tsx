import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, FileText, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { seriesQuery, seriesByIdQuery, seriesCharactersQuery, seriesMembersQuery, seriesStatusClass, type Series, type SeriesCharacter } from "@/lib/series";
import { episodesQuery } from "@/lib/map";
import { useSectionStyle } from "@/hooks/use-typography";
import type { Entity } from "@/lib/entities";

export const Route = createFileRoute("/_authenticated/series")({
  validateSearch: (s: Record<string, unknown>): { s?: string } => ({
    ...(typeof s["s"] === "string" ? { s: s["s"] } : {}),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Series — Sentinels Cinematic Universe" },
      { name: "description", content: "Story arcs and series of the Sentinels Cinematic Universe." },
      { property: "og:title", content: "Series — SCU" },
      { property: "og:description", content: "Story arcs and series of the Sentinels Cinematic Universe." },
    ],
  }),
  component: SeriesPage,
});

interface MemberRow {
  row: SeriesCharacter;
  entity: Entity;
}

function SeriesDetail({ seriesId, onClose }: { seriesId: string; onClose: () => void }) {
  const { data: series } = useQuery(seriesByIdQuery(seriesId));
  const { data: rows } = useQuery(seriesCharactersQuery(seriesId));
  const { data: members } = useQuery(seriesMembersQuery(rows));

  const memberRows: MemberRow[] = useMemo(() => {
    const byId = new Map((members ?? []).map((e) => [e.id, e]));
    return (rows ?? [])
      .map((row) => ({ row, entity: byId.get(row.character_id) }))
      .filter((r): r is MemberRow => !!r.entity)
      .sort((a, b) => a.entity.name.localeCompare(b.entity.name));
  }, [rows, members]);

  const grouped = useMemo(() => {
    const order = ["Alive", "Missing", "Dead", "Unknown"];
    const map = new Map<string, MemberRow[]>();
    for (const r of memberRows) {
      const k = r.row.status || "Unknown";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [memberRows]);

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <section className="morph-in glass grid gap-6 rounded-2xl p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {series?.cover_image_url ? (
                <img src={series.cover_image_url} alt={series.title} loading="lazy" decoding="async" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <BookMarked className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Series</p>
                <h2 className="mt-1 text-3xl font-medium glow-text">{series?.title ?? "…"}</h2>
              </div>
            </div>
            <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          {series?.description && <p className="whitespace-pre-line text-sm text-foreground/85">{series.description}</p>}
          <div className="grid gap-4">
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No characters assigned yet.</p>
            ) : (
              grouped.map(([status, members]) => (
                <div key={status}>
                  <p className={`mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest ${seriesStatusClass[status] ?? "text-status-neutral"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />{status} · {members.length}
                  </p>
                  <div className="grid gap-2">
                    {members.map(({ row, entity }) => (
                      <Link
                        key={row.id}
                        to="/characters"
                        search={{ open: entity.id }}
                        className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary/70"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{entity.name}</span>
                          {row.role_in_series && (
                            <span className="block truncate text-xs text-muted-foreground">{row.role_in_series}</span>
                          )}
                        </span>
                        {entity.category && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{entity.category}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Cinematic hero carousel — full-bleed cover art, bold titles, metadata chips. */
function SeriesHero({ series, counts, onOpen }: { series: Series[]; counts: Map<string, number>; onOpen: (id: string) => void }) {
  if (series.length === 0) return null;
  return (
    <div className="mb-8">
      <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-accent">Now streaming</p>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {series.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="group relative w-[85vw] max-w-md shrink-0 snap-center overflow-hidden rounded-3xl text-left sm:w-[28rem]"
            style={{ minHeight: "16rem" }}
          >
            {s.cover_image_url ? (
              <img src={s.cover_image_url} alt={s.title} loading={i === 0 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-accent/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
            <div className="relative flex h-full min-h-[16rem] flex-col justify-end p-6">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/25 bg-black/50 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-white/90 backdrop-blur">SCU Canon</span>
                <span className="rounded-full border border-white/25 bg-black/50 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-white/90 backdrop-blur">
                  {counts.get(s.id) ?? 0} character{(counts.get(s.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <h2 className="font-display text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl">{s.title}</h2>
              {s.description && <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/80">{s.description}</p>}
              <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                ▶ Open saga
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SeriesPage() {
  const { s } = useSearch({ strict: false }) as { s?: string };
  const sectionStyle = useSectionStyle("series");
  const nav = useNavigate();
  const navigate = (o: { search: { s?: string } }) => nav({ to: ".", search: o.search as never });
  const [q, setQ] = useState("");
  const { data: series, isLoading } = useQuery(seriesQuery);
  const { data: episodes } = useQuery(episodesQuery);
  const { data: allRows } = useQuery({
    queryKey: ["series-characters", "all"],
    enabled: !!series?.length,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_characters")
        .select("series_id");
      if (error) return [] as { series_id: string }[];
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows ?? []) m.set(r.series_id, (m.get(r.series_id) ?? 0) + 1);
    return m;
  }, [allRows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (series ?? []).filter((x) => !needle || x.title.toLowerCase().includes(needle) || x.description.toLowerCase().includes(needle));
  }, [series, q]);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-5" style={sectionStyle}>
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archive</p>
        <h1 className="mt-2 text-5xl font-medium glow-text">Series</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">Story arcs and sagas — who lived, died, or vanished in each.</p>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search series…" className="glass h-11 rounded-full pl-10" />
      </div>

      {!q.trim() && <SeriesHero series={list.slice(0, 8)} counts={counts} onOpen={(id) => navigate({ search: { s: id } })} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {series?.length ? "No matches." : "No series defined yet — an admin can add them from the Admin panel."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate({ search: { s: s.id } })}
              className="glass group flex gap-4 rounded-2xl p-4 text-left transition-[transform,box-shadow,border-radius] duration-300 hover:-translate-y-0.5 hover:rounded-tr-[2rem] hover:glow-ring"
            >
              {s.cover_image_url ? (
                <img src={s.cover_image_url} alt={s.title} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <BookMarked className="h-6 w-6" />
                </div>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-medium">{s.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {counts.get(s.id) ?? 0} character{(counts.get(s.id) ?? 0) === 1 ? "" : "s"}
                </span>
                {s.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{s.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {(episodes?.length ?? 0) > 0 && (
        <section className="mt-14">
          <p className="mb-1 text-[11px] uppercase tracking-[0.25em] text-accent">Chronicle</p>
          <h2 className="mb-4 text-3xl font-medium">Published episodes</h2>
          <div className="grid gap-3">
            {(episodes ?? []).map((ep) => (
              <details key={ep.id} className="glass group rounded-2xl p-4">
                <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <FileText className="h-5 w-5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-medium">{ep.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[ep.series, new Date(ep.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </summary>
                <div className="mt-4 whitespace-pre-line border-t border-border/60 pt-4 text-sm leading-relaxed text-foreground/85">
                  {ep.body}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {s && <SeriesDetail seriesId={s} onClose={() => navigate({ search: {} })} />}
    </main>
  );
}
