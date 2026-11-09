import { useCallback, useEffect, useMemo, useState } from "react";
import { stripMerged } from "@/lib/sanitize-lore";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { entityByIdQuery, notesQuery, type Entity } from "@/lib/entities";
import { characterSeriesQuery, seriesQuery } from "@/lib/series";
import { AbilityCardCanvas } from "@/components/ability-canvas";
import { AbilityBadge } from "@/components/ability-badge";
import { ElementalWallpaper, ELEMENT_LABEL, resolveElement } from "@/components/elemental-wallpaper";
import { KineticText } from "@/components/kinetic-text";
import { isFavorite, toggleFavorite, onFavoritesChange } from "@/lib/favorites";
import { useUiToggles } from "@/lib/ui-toggles";
import { useAnimationsEnabled, setAnimationsEnabled } from "@/lib/animations";
import { sfx } from "@/lib/scu-audio";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/character")({
  validateSearch: (s: Record<string, unknown>): { e?: string } =>
    typeof s["e"] === "string" ? { e: s["e"] } : {},
  head: () => ({ meta: [{ title: "Character — SCU" }] }),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center bg-[#020408] p-8 text-center">
      <div>
        <p className="font-display text-xl text-accent">Dossier failed to load</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <Link to="/characters" className="mt-4 inline-block text-xs uppercase tracking-widest text-accent hover:underline">← Back to characters</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-[#020408] p-8 text-center">
      <div>
        <p className="font-display text-xl text-accent">Character not found</p>
        <Link to="/characters" className="mt-4 inline-block text-xs uppercase tracking-widest text-accent hover:underline">← Back to characters</Link>
      </div>
    </div>
  ),
  component: CharacterDossier,
});

const SEASON_HUES = [262, 200, 150, 20, 340, 90, 180];
const TABS = [["powers", "Abilities and Role"], ["lore", "Story / Lore"], ["bonds", "Bonds / Connection"]] as const;
type Tab = (typeof TABS)[number][0] | "progress";

const SERIES_GROUPS: Array<{ key: string; title: string; match: RegExp; seasons: string[] }> = [
  { key: "sentinels", title: "The Sentinels", match: /sentinel/i, seasons: ["S1", "S2", "S3", "S4", "S5"] },
  { key: "redline", title: "Redline", match: /redline/i, seasons: ["S1", "S2"] },
  { key: "bloodlines", title: "Bloodline", match: /bloodline/i, seasons: ["S1"] },
  { key: "divine", title: "Divine Beast", match: /divine|beast/i, seasons: ["S1"] },
  { key: "standalone", title: "Standalone Epics", match: /standalone|epic|zaan|khalid|alister/i, seasons: ["Zaan", "Khalid", "Alister"] },
];

const SANITIZE = /^\[(conflict|merge|Auto-Merged|Auto-Stub|scope|resolved|Merged Info)/i;

function journeyScore(r: { arc_role?: string | null; status?: string | null; role_in_series?: string | null }): number {
  const role = `${r.arc_role ?? ""} ${r.role_in_series ?? ""}`.toLowerCase();
  if (/main\s*protagonist|lead\s*protagonist/.test(role)) return 5;
  if (/protagonist|legend/.test(role)) return 4;
  if (/anti-?hero|antagonist|anti-?villain|villain/.test(role)) return 3;
  if (/support|mentor|side/.test(role)) return 2;
  if (/cameo/.test(role)) return 1;
  const st = (r.status ?? "").toLowerCase();
  if (st === "dead" || st === "presumed dead") return 1;
  if (st === "alive") return 3;
  return 2;
}

const COMPARE_COLORS = ["hsl(190 85% 60%)", "hsl(30 90% 60%)", "hsl(300 75% 65%)", "hsl(120 65% 55%)"];

type JRow = { id: string; series?: { title?: string | null } | null; arc_role?: string | null; status?: string | null; role_in_series?: string | null };

function CompareRowsLoader({ id, onRows }: { id: string; onRows: (id: string, rows: JRow[]) => void }) {
  const { data } = useQuery(characterSeriesQuery(id));
  useEffect(() => { if (data) onRows(id, (data as JRow[]).filter((r) => r.series)); }, [data, id, onRows]);
  return null;
}

function CompareJourney({ baseName, baseRows, others }: { baseName: string; baseRows: JRow[]; others: Array<{ id: string; name: string }> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [rowsBy, setRowsBy] = useState<Record<string, JRow[]>>({});
  const onRows = useCallback((cid: string, rows: JRow[]) => setRowsBy((p) => ({ ...p, [cid]: rows })), []);
  const lines = [{ name: baseName, rows: baseRows }, ...picked.map((p) => ({ name: others.find((o) => o.id === p)?.name ?? "?", rows: rowsBy[p] ?? [] }))];
  const titles = Array.from(new Set(lines.flatMap((l) => l.rows.map((r) => r.series?.title ?? "?"))));
  const W = 560, H = 140, pad = 24;
  const step = (W - pad * 2) / Math.max(titles.length - 1, 1);
  const y = (s: number) => H - pad - (s / 5) * (H - pad * 2);
  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
      {picked.map((p) => <CompareRowsLoader key={p} id={p} onRows={onRows} />)}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
        <span className="text-accent">Compare Journey</span>
        {picked.length < 3 && (
          <select
            value=""
            onChange={(ev) => ev.target.value && setPicked((p) => [...p, ev.target.value])}
            className="rounded border border-white/15 bg-black/60 px-2 py-1 text-[11px] normal-case tracking-normal"
          >
            <option value="">+ Add character</option>
            {others.filter((o) => !picked.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
        {lines.map((l, i) => (
          <span key={l.name + i} className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: i === 0 ? "var(--accent)" : COMPARE_COLORS[(i - 1) % COMPARE_COLORS.length] }} />
            {l.name}
            {i > 0 && <button aria-label={`Remove ${l.name}`} onClick={() => setPicked((p) => p.filter((_, j) => j !== i - 1))} className="ml-1 text-muted-foreground hover:text-foreground">×</button>}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[1, 2, 3, 4, 5].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" />)}
        {lines.map((l, i) => {
          const color = i === 0 ? "var(--accent)" : COMPARE_COLORS[(i - 1) % COMPARE_COLORS.length];
          const pts = l.rows.map((r) => ({ x: pad + titles.indexOf(r.series?.title ?? "?") * step, y: y(journeyScore(r)) })).sort((a, b) => a.x - b.x);
          return (
            <g key={i}>
              <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={2} />
              {pts.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r={3.5} fill={color} />)}
            </g>
          );
        })}
        {titles.map((t, i) => <text key={t} x={pad + i * step} y={H - 6} fontSize={9} textAnchor="middle" fill="rgba(255,255,255,0.55)">{t.length > 14 ? t.slice(0, 13) + "…" : t}</text>)}
      </svg>
    </div>
  );
}

function JourneyBars({ rows }: { rows: Array<{ id: string; series?: { title?: string | null } | null; arc_role?: string | null; status?: string | null; role_in_series?: string | null }> }) {
  const pts = rows.map((r) => ({ label: r.series?.title ?? "?", score: journeyScore(r), role: r.arc_role ?? r.role_in_series ?? "" }));
  const W = 560, H = 110, pad = 22;
  const bw = (W - pad * 2) / Math.max(pts.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[1, 2, 3, 4, 5].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={H - pad - (g / 5) * (H - pad * 2)} y2={H - pad - (g / 5) * (H - pad * 2)} stroke="rgba(255,255,255,0.06)" />
      ))}
      {pts.map((p, i) => {
        const x = pad + i * bw + bw / 2;
        const h = (p.score / 5) * (H - pad * 2);
        const y = H - pad - h;
        return (
          <g key={i}>
            <rect x={x - bw * 0.32} y={y} width={bw * 0.64} height={h} rx={3} fill="var(--accent)" opacity={0.75} />
            <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">{p.label.replace(/^The\s*/i, "").slice(0, 10)}</text>
          </g>
        );
      })}
      <polyline points={pts.map((p, i) => `${pad + i * bw + bw / 2},${H - pad - (p.score / 5) * (H - pad * 2)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
    </svg>
  );
}

function CharacterDossier() {
  const { e: id } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const ui = useUiToggles();
  const animOn = useAnimationsEnabled();
  const [tab, setTab] = useState<Tab>("powers");
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [ctxSeason, setCtxSeason] = useState<string | null>(null);
  const [seasonIdx, setSeasonIdx] = useState(-1);
  const [descOpen, setDescOpen] = useState(false);
  const [, setFavTick] = useState(0);
  useEffect(() => onFavoritesChange(() => setFavTick((t) => t + 1)), []);
  const stepChar = (dir: 1 | -1) => {
    const list = allChars ?? [];
    if (!list.length) return;
    const i = list.findIndex((c) => c.id === id);
    const next = list[(i + dir + list.length) % list.length]!;
    sfx.pop();
    void nav({ to: "/character", search: { e: next.id } });
  };

  const { data: e, isError: entityError, error: entityErr } = useQuery({ ...entityByIdQuery(id ?? ""), enabled: !!id });
  // Auto-select first character when no ?e param — never show an empty dossier.
  const { data: firstChar } = useQuery({
    queryKey: ["first-character"],
    enabled: !id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("entities").select("id").eq("kind", "character").order("name").limit(1).maybeSingle();
      return data;
    },
  });
  const { data: allChars } = useQuery({
    queryKey: ["all-characters-short"],
    enabled: !!id && e?.kind === "character",
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("entities").select("id, name").eq("kind", "character").order("name");
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!id && firstChar?.id) void nav({ to: "/character", search: { e: firstChar.id }, replace: true });
  }, [id, firstChar?.id, nav]);
  const { data: notes } = useQuery({ ...notesQuery(id ?? ""), enabled: !!id });
  const { data: memberships } = useQuery({ ...characterSeriesQuery(id ?? ""), enabled: !!id && e?.kind === "character" });
  const { data: allSeries } = useQuery({ ...seriesQuery, enabled: e?.kind === "character" });
  const { data: charAbilities } = useQuery({
    queryKey: ["character-abilities", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("character_abilities").select("*").eq("entity_id", id!);
      return data ?? [];
    },
  });

  const seasons = useMemo(() => (memberships ?? []).filter((r) => r.series), [memberships]);
  const cleanNotes = useMemo(() => {
    const seen = new Set<string>();
    const descText = (e?.description ?? "").toLowerCase();
    return (notes ?? []).filter((n) => {
      if (SANITIZE.test(n.text)) return false;
      const key = n.text.replace(/^\[[^\]]*\]\s*/, "").trim().toLowerCase();
      if (!key || seen.has(key) || descText.includes(key)) return false;
      seen.add(key);
      return true;
    });
  }, [notes, e?.description]);
  const activeSeason = seasonIdx >= 0 ? seasons[seasonIdx] : null;
  const seasonHue = seasonIdx >= 0 ? SEASON_HUES[seasonIdx % SEASON_HUES.length] : null;
  const accent = seasonHue ? `hsl(${seasonHue} 85% 60%)` : "var(--accent)";

  if (entityError) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#020408] p-8 text-center">
        <div>
          <p className="font-display text-xl text-accent">Dossier failed to load</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{entityErr instanceof Error ? entityErr.message : "Unknown error"}</p>
          <Link to="/characters" className="mt-4 inline-block text-xs uppercase tracking-widest text-accent hover:underline">← Back to characters</Link>
        </div>
      </div>
    );
  }
  if (!e) {
    if (!id) return <div className="grid min-h-screen place-items-center bg-[#020408] text-sm text-muted-foreground">No character selected.</div>;
    return <div className="grid min-h-screen place-items-center bg-[#020408] text-sm text-muted-foreground">Loading dossier…</div>;
  }

  const element = resolveElement(e.abilities, activeSeason?.card_theme ?? e.card_theme);

  const scopedNotes = activeSeason?.series?.title
    ? cleanNotes.filter((n) => n.text.includes(activeSeason.series!.title))
    : cleanNotes;

  return (
    // Full viewport height (not `fixed`): the page-transition wrapper's transform would collapse a fixed box to zero height.
    <div className="relative grid h-dvh w-full grid-rows-[auto_1fr] overflow-hidden bg-[#020408] text-foreground">
      <ElementalWallpaper element={element} enabled={animOn} />
      {/* TOP HEADER */}
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2 backdrop-blur-xl">
        <Link to="/" className="font-display text-sm tracking-[0.3em] text-accent">SCU</Link>
        <nav className="hidden items-center gap-6 text-[11px] uppercase tracking-widest text-muted-foreground md:flex">
          <Link to="/graph" className="text-accent hover:text-foreground">Character Graph of all season together</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/graph" className="text-[10px] uppercase tracking-widest text-accent md:hidden">Graph</Link>
          <button
            role="switch"
            aria-checked={animOn}
            onClick={() => setAnimationsEnabled(!animOn)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <span className="hidden sm:inline">Cinematic Animations</span><span className="sm:hidden">FX</span>
            <span className={`relative h-3.5 w-7 rounded-full transition-colors ${animOn ? "bg-accent" : "bg-white/20"}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background transition-all ${animOn ? "left-4" : "left-0.5"}`} />
            </span>
          </button>
          <button
            aria-label="Favorite"
            onClick={() => { toggleFavorite({ id: e.id, name: e.name, kind: e.kind }); sfx.pop(); qc.invalidateQueries({ queryKey: ["favorites"] }); }}
            className={`grid h-8 w-8 place-items-center rounded-full ${isFavorite(e.id) ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}
          >
            <Heart className={`h-4 w-4 ${isFavorite(e.id) ? "fill-current" : ""}`} />
          </button>
          <Link to="/characters" className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      {/* Tactical HUD frame */}
      <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      {(["top-3 left-3 border-t border-l", "top-3 right-3 border-t border-r", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"] as const).map((pos) => (
        <span key={pos} className={`pointer-events-none absolute z-10 h-5 w-5 border-white/25 ${pos}`} />
      ))}
      <span className="pointer-events-none absolute left-4 top-[4.5rem] z-10 font-mono text-[9px] uppercase tracking-widest text-white/30">
        SCU // {e.name.slice(0, 12).toUpperCase()} · {ELEMENT_LABEL[element].toUpperCase()} — {String(Math.max(seasonIdx + 1, 1)).padStart(2, "0")} / {String(Math.max(seasons.length, 1)).padStart(2, "0")}
      </span>

      {/* 3-COLUMN GRID */}
      <div className="relative grid min-h-0 grid-cols-1 min-[860px]:grid-cols-[240px_minmax(0,1fr)_clamp(150px,22vw,350px)]">
        {/* LEFT — series & season accordion */}
        <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-black/50 p-3 min-[860px]:flex">
          {/* Character switcher */}
          <label className="mb-2 block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Character</span>
            <select
              className="w-full rounded-md border border-white/15 bg-black/60 px-2 py-1.5 text-xs"
              value={id ?? ""}
              onChange={(ev) => void nav({ to: "/character", search: { e: ev.target.value } })}
            >
              {(allChars ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {SERIES_GROUPS.map((g, si) => {
              const hue = SEASON_HUES[si % SEASON_HUES.length];
              const open = openSeries === g.key;
              const dbSeries = (allSeries ?? []).filter((x) => g.match.test(x.title));
              const list = g.seasons.length ? g.seasons : dbSeries.length ? dbSeries.map((x) => x.title) : ["Overview"];
              const memberIdx = seasons.findIndex((r) => g.match.test(r.series?.title ?? ""));
              return (
                <div key={g.key} className="overflow-hidden rounded-lg border border-white/10">
                  <button
                    onClick={() => setOpenSeries(open ? null : g.key)}
                    className={`flex w-full items-center gap-2 p-2 text-left ${open ? "bg-white/10" : "bg-white/5 hover:bg-white/10"}`}
                    style={{ borderLeft: `3px solid hsl(${hue} 85% 60%)` }}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-[9px] uppercase text-muted-foreground">{g.title.replace(/^The\s+/i, "").slice(0, 2)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold uppercase tracking-wide">{g.title}</span>
                      <span className="block text-[9px] uppercase text-muted-foreground">{memberIdx >= 0 ? seasons[memberIdx]!.status ?? "Appears" : g.key === "standalone" ? `${g.seasons.length} epics` : g.seasons.length ? `S1–S${g.seasons.length}` : "Collection"}</span>
                    </span>
                    <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {open && (
                    <div className="grid gap-0.5 border-t border-white/10 bg-black/30 p-1.5">
                      {list.map((sn) => (
                        <button
                          key={sn}
                          onClick={() => { setCtxSeason(`${g.title} ${sn}`); setSeasonIdx(memberIdx); }}
                          className={`rounded px-2 py-1 text-left text-[10px] uppercase tracking-wide ${ctxSeason === `${g.title} ${sn}` ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {g.seasons.length && g.key !== "standalone" ? `${g.title} ${sn}` : sn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-col items-center gap-0.5 border-t border-white/10 pt-2 text-white/40">
            <button aria-label="Previous character" onClick={() => stepChar(-1)} className="px-3 hover:text-accent">▲</button>
            <span className="text-[8px] uppercase tracking-[0.3em]">Scroll</span>
            <button aria-label="Next character" onClick={() => stepChar(1)} className="px-3 hover:text-accent">▼</button>
          </div>
        </aside>

        {/* CENTER — context-aware bio */}
        <section className="relative min-h-0 overflow-y-auto p-5 sm:p-8">
          {animOn && <AbilityCardCanvas abilities={e.abilities} theme={activeSeason?.card_theme ?? e.card_theme} density={1.6} className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />}
          <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          <div className="relative">
            <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl" style={{ textShadow: `0 0 30px ${accent}66` }}>
              <KineticText text={e.name.toUpperCase()} />
            </h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {ctxSeason ?? activeSeason?.series?.title ?? "Overview"} · {TABS.find(([t]) => t === tab)?.[1]}
            </p>

            {/* Badges — tier, role, alias (all viewports) */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {e.character_tier && (
                <span className="rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">{e.character_tier}</span>
              )}
              {[e.role, e.category, e.alias ?? (e.stats as Record<string, string> | null)?.["alias"]].filter(Boolean).map((t) => (
                <span key={t} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80">{t}</span>
              ))}
            </div>

            {/* Mobile series/season selector — left rail is desktop-only */}
            {e.kind === "character" && seasons.length > 0 && (
              <div className="mt-3 flex gap-1.5 overflow-x-auto min-[860px]:hidden [scrollbar-width:none]">
                <button
                  onClick={() => setSeasonIdx(-1)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase ${seasonIdx === -1 ? "bg-accent text-accent-foreground" : "bg-white/10 text-muted-foreground"}`}
                >Overview</button>
                {seasons.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => { setSeasonIdx(i); setCtxSeason(null); }}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase ${seasonIdx === i ? "bg-accent text-accent-foreground" : "bg-white/10 text-muted-foreground"}`}
                  >
                    {r.series?.title}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile/tablet tab bar — right rail is desktop-only */}
            <div className="mt-4 flex gap-1.5 min-[860px]:hidden" role="tablist">
              {TABS.map(([t, label]) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => { sfx.pop(); setTab(t); }}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${tab === t ? "bg-accent text-accent-foreground" : "bg-white/10 text-muted-foreground"}`}
                >
                  {label.split(" /")[0]}
                </button>
              ))}
            </div>

            {/* Season intel */}
            {activeSeason && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {activeSeason.arc_role && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{activeSeason.arc_role}</span>}
                  {activeSeason.status && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{activeSeason.status}</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{activeSeason.role_in_series ?? "Missing role / story"}</p>
              </div>
            )}

            {/* Tab content */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-5 backdrop-blur-xl">
              {tab === "lore" && (
                <div className="space-y-4">
                  {e.description && (
                    <div>
                      <p className={`whitespace-pre-line text-foreground/85 ${!descOpen && e.description.length > 700 ? "line-clamp-6" : ""}`}>{stripMerged(e.description)}</p>
                      {e.description.length > 700 && (
                        <button onClick={() => setDescOpen((o) => !o)} className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent hover:underline">
                          {descOpen ? "VER MENOS <<" : "VER MAS >>"}
                        </button>
                      )}
                    </div>
                  )}
                  {scopedNotes.map((n) => (
                    <div key={n.id} className="border-l-2 border-accent/60 pl-3 text-sm">
                      <p>{stripMerged(n.text)}</p>
                      {n.source && <p className="mt-1 text-xs text-muted-foreground">From {n.source}</p>}
                    </div>
                  ))}
                  {!e.description && scopedNotes.length === 0 && <p className="text-sm text-muted-foreground">No lore recorded for this selection.</p>}
                </div>
              )}
              {tab === "powers" && (
                <div className="grid gap-3">
                  {(charAbilities ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(charAbilities ?? []).map((ca) => <AbilityBadge key={ca.id} name={ca.ability_key} />)}
                    </div>
                  )}
                  {(e.abilities ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {e.abilities.map((a) => <AbilityBadge key={a} name={a} />)}
                    </div>
                  )}
                  {!e.abilities?.length && !(charAbilities ?? []).length && <p className="text-sm text-muted-foreground">No abilities recorded.</p>}
                </div>
              )}
              {tab === "bonds" && (
                <div className="grid gap-2">
                  {seasons.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
                      <span className="font-medium">{r.series?.title}</span>
                      <span className="text-muted-foreground">{r.arc_role ?? r.role_in_series ?? r.status}</span>
                    </div>
                  ))}
                  {seasons.length === 0 && <p className="text-sm text-muted-foreground">No bonds recorded.</p>}
                </div>
              )}
              {tab === "progress" && ui.showJourneyGraph && seasons.length > 0 && (
                <div className="mb-4">
                  <JourneyBars rows={seasons} />
                </div>
              )}
              {tab === "progress" && seasons.length > 0 && (
                <CompareJourney baseName={e.name} baseRows={seasons} others={(allChars ?? []).filter((c) => c.id !== id)} />
              )}
              {tab === "progress" && (
                <ul className="grid gap-1.5 text-xs">
                  {seasons.map((r, i) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${SEASON_HUES[i % SEASON_HUES.length]} 85% 60%)` }} />
                      <span className="font-medium">{r.series?.title}</span>
                      <span className="ml-auto text-muted-foreground">{r.status}</span>
                    </li>
                  ))}
                  {seasons.length === 0 && <li className="text-sm text-muted-foreground">No series data.</li>}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — render + far-right edge tabs */}
        <div className="relative hidden min-h-0 min-[860px]:block">
          {e.image_url && (
            <div className="absolute inset-0 flex items-end justify-center overflow-hidden">
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 85%, ${accent} 0%, transparent 65%)`, opacity: 0.25 }} />
              <img src={e.image_url} alt={e.name} className="relative h-[92%] w-auto max-w-full object-contain object-bottom [mask-image:linear-gradient(to_top,black_55%,transparent_98%)]" />
            </div>
          )}
          <nav className="absolute right-0 top-0 flex h-full w-12 flex-col border-l border-white/10 bg-black/50" aria-label="Sections">
            {TABS.map(([t, label], i) => (
              <button
                key={t}
                onClick={() => { sfx.pop(); setTab(t); }}
                className="group relative flex h-full flex-1 items-center justify-center"
                aria-label={label}
              >
                <span
                  className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r transition-all"
                  style={{ background: tab === t ? accent : "rgba(255,255,255,.15)", boxShadow: tab === t ? `0 0 10px ${accent}` : undefined }}
                />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ writingMode: "vertical-rl", color: tab === t ? accent : "rgba(255,255,255,.45)" }}>
                  {label}
                </span>
                <span className="absolute right-1 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/60 text-[8px] text-muted-foreground">{i + 1}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
