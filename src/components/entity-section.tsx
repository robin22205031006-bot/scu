import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, type MotionStyle } from "framer-motion";
import { BookOpen, FileDown, GitCompareArrows, GitMerge, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useWebMCP } from "use-webmcp-tool";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { entitiesQuery, entityByIdQuery, matchesSearch, notesQuery, type Entity } from "@/lib/entities";
import { sfx } from "@/lib/scu-audio";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import { useSectionStyle } from "@/hooks/use-typography";
import { EntityDialog } from "./entity-dialog";
import { EntityGridSkeleton } from "./route-skeleton";
import { EntityLinks } from "./entity-links";
import { SeriesAppearances } from "./series-appearances";
import { characterSeriesQuery, seriesQuery } from "@/lib/series";
import { setNavHidden } from "@/lib/nav-visibility";
import { MergeEntityDialog } from "./merge-entity-dialog";
import { SketchGallery } from "./sketch-gallery";
import { StatRadar } from "./stat-radar";
import { CompareSentinel } from "./compare-sentinel";
import { CharacterRelationships, OrgHierarchy } from "./lineage-panel";
import { AbilityCardCanvas } from "./ability-canvas";
import { KineticText } from "./kinetic-text";
import { useUiToggles } from "@/lib/ui-toggles";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { Heart } from "lucide-react";
import { AbilityBadge, AbilityBadgeRow } from "./ability-badge";
import { ABILITY_GROUP_LABELS, abilityDef, sortAbilities, type AbilityGroup } from "@/lib/abilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { animationClass, tierDef } from "@/lib/character-tier";
import { onSpoilerChange, spoilersHidden } from "@/lib/spoiler";
import { exportDossierPdf, type DossierGroup } from "@/lib/export-dossier";
import { getCombatStats } from "@/lib/combat-stats";

const statusClass: Record<string, string> = {
  Alive: "text-status-alive", Active: "text-status-alive",
  Dead: "text-status-dead", "Presumed Dead": "text-status-legend", Inactive: "text-status-neutral",
  Legend: "text-status-legend",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] ${statusClass[status] ?? "text-status-neutral"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{status}
    </span>
  );
}

/** Single-instance theme-song player — only one card track plays at a time. */
let activeAudio: HTMLAudioElement | null = null;
function toggleThemeSong(url: string) {
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
    activeAudio = null;
    return;
  }
  const audio = new Audio(url);
  audio.volume = 0.6;
  audio.onended = () => { if (activeAudio === audio) activeAudio = null; };
  activeAudio = audio;
  void audio.play().catch(() => { activeAudio = null; });
}

export function ThemeSongButton({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const check = () => setPlaying(!!activeAudio && !activeAudio.paused);
    const t = setInterval(check, 400);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      aria-label={playing ? "Pause theme song" : "Play theme song"}
      title={playing ? "Pause theme song" : "Play theme song"}
      onClick={(ev) => { ev.stopPropagation(); toggleThemeSong(url); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
    >
      {playing ? <span className="text-[10px] font-bold">❚❚</span> : <span className="text-[10px] font-bold">▶</span>}
    </button>
  );
}

const Avatar = memo(function Avatar({ e, size }: { e: Entity; size: string }) {
  return e.image_url ? (
    <img src={e.image_url} alt={e.name} loading="lazy" decoding="async" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${size} grid shrink-0 place-items-center rounded-xl bg-secondary font-display text-2xl text-muted-foreground`}>{e.name[0]}</div>
  );
});

const CardBody = memo(function CardBody({ e, showKind }: { e: Entity; showKind: boolean }) {
  const tier = tierDef(e.character_tier);
  const theme = e.theme_color ?? tier?.color ?? null;
  const [hideSpoilers, setHideSpoilers] = useState(spoilersHidden);
  useEffect(() => onSpoilerChange(() => setHideSpoilers(spoilersHidden())), []);
  return (
    <div className="min-w-0 flex-1 text-left">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={e.status} />
        {tier && (
          <span
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: tier.color, borderColor: `${tier.color}66`, background: `${tier.color}14`, boxShadow: `0 0 8px ${tier.color}33` }}
          >
            {tier.label}
          </span>
        )}
        {!hideSpoilers && (e.category || showKind) && <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{e.category ?? e.kind}</span>}
        {hideSpoilers && <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Role hidden</span>}
      </div>
      <h2 className="mt-1 truncate text-2xl font-medium" style={theme ? { color: theme } : undefined}>{e.name}</h2>
      <p className="truncate text-sm text-muted-foreground">{[e.alias, e.role].filter(Boolean).join(" · ") || "—"}</p>
      {e.kind === "character" && (e.abilities?.length ?? 0) > 0 && (
        <div className="mt-1.5"><AbilityBadgeRow abilities={sortAbilities(e.abilities ?? [])} max={3} /></div>
      )}
    </div>
  );
});

/** Opened state: the card shifts to the top-left corner, details open beside it. */
/** Narrative trajectory: prominence score per series from arc_role/status. */
function journeyScore(r: { arc_role?: string | null; status?: string | null; role_in_series?: string | null }): number {
  const role = `${r.arc_role ?? ""} ${r.role_in_series ?? ""}`.toLowerCase();
  if (/main\s*protagonist|lead\s*protagonist/.test(role)) return 5;
  if (/protagonist/.test(role)) return 4;
  if (/anti-?hero/.test(role)) return 3;
  if (/antagonist|anti-?villain|villain/.test(role)) return 3;
  if (/legend/.test(role)) return 4;
  if (/cameo/.test(role)) return 1;
  if (/support|mentor|side/.test(role)) return 2;
  const st = (r.status ?? "").toLowerCase();
  if (st === "dead" || st === "presumed dead") return 1;
  if (st === "alive") return 3;
  return 2;
}

function JourneyGraph({ rows }: { rows: Array<{ id: string; series?: { title?: string | null } | null; arc_role?: string | null; status?: string | null; role_in_series?: string | null }> }) {
  const pts = rows.map((r) => ({ label: r.series?.title ?? "?", score: journeyScore(r), role: r.arc_role ?? r.role_in_series ?? "" }));
  const W = 560, H = 120, pad = 24;
  const bw = (W - pad * 2) / Math.max(pts.length, 1);
  return (
    <div className="rounded-xl border border-white/10 bg-secondary/20 p-4">
      <h4 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Journey trajectory</h4>
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
              <text x={x} y={H - 8} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">{p.label.replace(/^The\s*/i, "").slice(0, 10)}</text>
              <text x={x} y={y - 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{p.role || `Lv${p.score}`}</text>
            </g>
          );
        })}
        <polyline
          points={pts.map((p, i) => `${pad + i * bw + bw / 2},${H - pad - (p.score / 5) * (H - pad * 2)}`).join(" ")}
          fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6}
        />
      </svg>
    </div>
  );
}

/** Description with "VER MAS >>" expand for overflowing text. */
function DescriptionBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 700;
  return (
    <div>
      <p className={`whitespace-pre-line text-foreground/85 ${!open && long ? "line-clamp-6" : ""}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent hover:underline">
          {open ? "VER MENOS <<" : "VER MAS >>"}
        </button>
      )}
    </div>
  );
}

function DetailOverlay({ e, from, onClose, isAdmin, onOpen }: { e: Entity; from: DOMRect | null; onClose: () => void; isAdmin: boolean; onOpen: (target: Entity) => void }) {
  const qc = useQueryClient();
  const { data: notes } = useQuery(notesQuery(e.id));
  const stats = Object.entries((e.stats as Record<string, string>) ?? {});
  const combat = e.kind === "character" ? getCombatStats(e.stats) : null;
  const [comparing, setComparing] = useState(false);
  const [journeyCompareId, setJourneyCompareId] = useState("");
  const [dossierTab, setDossierTab] = useState<"lore" | "powers" | "bonds" | "progress">("lore");
  const [seasonIdx, setSeasonIdx] = useState(0);
  const { data: seriesRows } = useQuery({ ...characterSeriesQuery(e.id), enabled: e.kind === "character" });
  const { data: allSeries } = useQuery({ ...seriesQuery, enabled: e.kind === "character" });
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [ctxSeason, setCtxSeason] = useState<string | null>(null);
  const { data: charAbilities } = useQuery({
    queryKey: ["character-abilities", e.id],
    enabled: e.kind === "character",
    queryFn: async () => {
      const { data } = await supabase.from("character_abilities").select("*").eq("entity_id", e.id);
      return data ?? [];
    },
  });
  const { data: allChars } = useQuery({ ...entitiesQuery(["character"]), enabled: e.kind === "character" && dossierTab === "progress" });
  const { data: compareRows } = useQuery({ ...characterSeriesQuery(journeyCompareId), enabled: !!journeyCompareId });
  const compareSeasons = (compareRows ?? []).filter((r) => r.series);
  const uiToggles = useUiToggles();
  const seasons = (seriesRows ?? []).filter((r) => r.series);
  const SEASON_HUES = [262, 200, 150, 20, 340, 90, 180];
  const seasonHue = seasonIdx >= 0 && seasons.length ? SEASON_HUES[seasonIdx % SEASON_HUES.length] : null;
  const [abilityInfo, setAbilityInfo] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  useEffect(() => {
    sfx.tierReveal(e.character_tier);
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => {
    if (!from) return;
    const target = { x: window.innerWidth < 640 ? 16 : 24, y: window.innerWidth < 640 ? 96 : 104 };
    setStyle({ "--from-x": `${from.left - target.x}px`, "--from-y": `${from.top - target.y}px`, "--from-s": "1" } as CSSProperties);
  }, [from]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      let groups: DossierGroup[] = [];
      try {
        const { data: links } = await supabase
          .from("entity_memberships")
          .select("character_id, group_id, status")
          .or(`character_id.eq.${e.id},group_id.eq.${e.id}`);
        const ids = [...new Set((links ?? []).map((l) => (l.character_id === e.id ? l.group_id : l.character_id)))];
        if (ids.length) {
          const { data: ents } = await supabase.from("entities").select("id,name,kind,status").in("id", ids);
          const byId = new Map((ents ?? []).map((x) => [x.id, x]));
          const mapped: (DossierGroup | null)[] = (links ?? []).map((l) => {
            const other = l.character_id === e.id ? l.group_id : l.character_id;
            const g = byId.get(other);
            return g ? { name: g.name, kind: g.kind, status: l.status ?? g.status } : null;
          });
          groups = mapped.filter((x): x is DossierGroup => x !== null);
        }
      } catch {
        /* memberships table may not exist yet */
      }
      await exportDossierPdf(e, groups);
      sfx.add();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (ev: ReactTouchEvent) => {
    const t = ev.touches[0];
    if (t) touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (ev: ReactTouchEvent) => {
    const s = touch.current;
    touch.current = null;
    const t = ev.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Swipe-to-close only fires when the dossier is already scrolled to the top —
    // mid-content scrolls must never dismiss it. A long horizontal flick still works anywhere.
    const atTop = (scrollRef.current?.scrollTop ?? 0) <= 2;
    if ((atTop && dy > 110 && Math.abs(dx) < 60) || Math.abs(dx) > 140) onClose();
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, []);
  // Hide all navigation while the dossier is open.
  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
  }, []);

  return (
    <motion.div
      ref={scrollRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      className="fixed inset-0 z-30 overflow-hidden bg-[#020408]"
      layoutId={`card-${e.id}`}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={(seasonHue ? { boxShadow: `inset 0 0 140px hsl(${seasonHue} 85% 55% / .14)` } : {}) as MotionStyle}
    >
      {/* Tactical HUD frame — grid, corner crosshairs, coordinate readout */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      {(["top-3 left-3 border-t border-l", "top-3 right-3 border-t border-r", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"] as const).map((pos) => (
        <span key={pos} className={`pointer-events-none absolute h-5 w-5 border-white/25 ${pos}`} />
      ))}
      <span className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-widest text-white/30">
        SCU // {e.name.slice(0, 12).toUpperCase()} — {String(Math.max(seasonIdx + 1, 1)).padStart(2, "0")} / {String(Math.max(seasons.length, 1)).padStart(2, "0")}
      </span>
      <div className="relative grid h-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_350px]" onClick={(ev) => ev.stopPropagation()}>
        {/* Column 1 — series & season accordion carousel */}
        <aside className="hidden h-full flex-col border-r border-white/10 bg-black/40 p-3 lg:flex">
          <p className="mb-3 px-1 font-display text-lg tracking-widest text-accent">SCU</p>
          <div ref={railRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {/* Overview thumb */}
            <button
              onClick={() => setSeasonIdx(-1)}
              className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-all ${seasonIdx === -1 ? "border-accent/70 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              style={seasonIdx === -1 ? { borderLeft: "3px solid var(--accent)", boxShadow: "0 0 14px color-mix(in oklab, var(--accent) 30%, transparent)" } : {}}
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                {e.image_url ? <img src={e.image_url} alt="" className="h-full w-full object-cover" /> : <Avatar e={e} size="h-10 w-10" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold uppercase tracking-wide">{e.name}</span>
                <span className="block text-[9px] uppercase text-muted-foreground">Overview</span>
              </span>
            </button>
            {/* Universe series accordion — expand a series to pick a season */}
            {(allSeries ?? []).map((s) => {
              const hue = SEASON_HUES[(allSeries ?? []).indexOf(s) % SEASON_HUES.length];
              const open = openSeries === s.id;
              const seasonList = s.season_names?.length
                ? s.season_names
                : s.season_count
                  ? Array.from({ length: s.season_count }, (_, i) => `Season ${i + 1}`)
                  : ["Season 1"];
              // Does this character belong to this series?
              const memberIdx = seasons.findIndex((r) => r.series?.id === s.id || r.series?.title === s.title);
              const member = memberIdx >= 0 ? seasons[memberIdx] : null;
              const pickSeason = (label: string) => {
                setCtxSeason(label);
                if (memberIdx >= 0) setSeasonIdx(memberIdx);
                else setSeasonIdx(-1);
              };
              return (
                <div key={s.id} className="overflow-hidden rounded-lg border border-white/10">
                  <button
                    onClick={() => setOpenSeries(open ? null : s.id)}
                    className={`flex w-full items-center gap-2 p-2 text-left transition-all ${open ? "bg-white/10" : "bg-white/5 hover:bg-white/10"}`}
                    style={{ borderLeft: `3px solid hsl(${hue} 85% 60%)`, ...(open ? { boxShadow: `0 0 14px hsl(${hue} 85% 60% / .3)` } : {}) }}
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                      {s.cover_image_url ? <img src={s.cover_image_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[9px] uppercase text-muted-foreground">{s.title.slice(0, 2)}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold uppercase tracking-wide">{s.title}</span>
                      <span className="block text-[9px] uppercase text-muted-foreground">{member ? (member.status ?? "Member") : `${seasonList.length} season${seasonList.length > 1 ? "s" : ""}`}</span>
                    </span>
                    <span className={`text-[10px] text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {open && (
                    <div className="grid gap-0.5 border-t border-white/10 bg-black/30 p-1.5">
                      <button
                        onClick={() => { setCtxSeason(null); if (memberIdx >= 0) setSeasonIdx(memberIdx); }}
                        className={`rounded px-2 py-1 text-left text-[10px] uppercase tracking-wide ${ctxSeason === null && memberIdx >= 0 ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        All seasons{member ? ` · ${member.status}` : ""}
                      </button>
                      {seasonList.map((sn) => {
                        const active = ctxSeason === sn;
                        return (
                          <button
                            key={sn}
                            onClick={() => pickSeason(sn)}
                            className={`flex items-center justify-between rounded px-2 py-1 text-left text-[10px] uppercase tracking-wide ${active ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <span className="truncate">{sn}</span>
                            {member && <span className="ml-1 h-1 w-1 shrink-0 rounded-full" style={{ background: `hsl(${hue} 85% 60%)` }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* SCROLL track */}
          <div className="mt-2 flex flex-col items-center gap-0.5 border-t border-white/10 pt-2 text-white/40">
            <button aria-label="Scroll up" onClick={() => railRef.current?.scrollBy({ top: -120, behavior: "smooth" })} className="hover:text-accent">▲</button>
            <span className="text-[8px] uppercase tracking-[0.3em]">Scroll</span>
            <button aria-label="Scroll down" onClick={() => railRef.current?.scrollBy({ top: 120, behavior: "smooth" })} className="hover:text-accent">▼</button>
          </div>
        </aside>
        {/* Mobile season chips fallback */}
        {seasons.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2 lg:hidden">
            <button onClick={() => setSeasonIdx(-1)} className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase ${seasonIdx === -1 ? "bg-accent text-accent-foreground" : "bg-white/10 text-muted-foreground"}`}>Overview</button>
            {seasons.map((r, i) => (
              <button key={r.id} onClick={() => setSeasonIdx(i)} className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase ${seasonIdx === i ? "bg-accent text-accent-foreground" : "bg-white/10 text-muted-foreground"}`}>{r.series?.title}</button>
            ))}
          </div>
        )}
        <section className="morph-in relative grid h-full content-start gap-6 overflow-y-auto p-5 text-sm leading-relaxed sm:p-7 lg:p-10">
          <AbilityCardCanvas abilities={e.abilities} theme={seasonIdx >= 0 ? seasons[seasonIdx]?.card_theme ?? e.card_theme : e.card_theme} density={2.2} className="pointer-events-none absolute inset-0 h-full w-full opacity-35" />
          <div className="relative flex items-start justify-between gap-4">
            <h3 className="flex flex-wrap items-center gap-3 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:max-w-[55%]" style={{ textShadow: `0 0 30px ${seasonHue ? `hsl(${seasonHue} 85% 60% / .45)` : "var(--accent)"}66` }}>
            <KineticText text={e.name} className="relative font-display text-5xl font-bold uppercase tracking-wide text-white drop-shadow-[0_0_24px_rgba(168,85,247,0.45)] sm:text-6xl" />
            {tierDef(e.character_tier) && (
              <span
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  color: tierDef(e.character_tier)!.color,
                  borderColor: `${tierDef(e.character_tier)!.color}66`,
                  background: `${tierDef(e.character_tier)!.color}14`,
                  boxShadow: `0 0 10px ${tierDef(e.character_tier)!.color}44`,
                }}
              >
                {tierDef(e.character_tier)!.label}
              </span>
            )}
          </h3>
            <div className="flex items-center gap-1">
              {e.kind === "character" && (
                <button
                  aria-label={isFavorite(e.id) ? "Remove favorite" : "Add favorite"}
                  title={isFavorite(e.id) ? "Remove from favorites" : "Save to favorites"}
                  onClick={() => { toggleFavorite({ id: e.id, name: e.name, kind: e.kind }); sfx.pop(); }}
                  className={`grid h-8 w-8 place-items-center rounded-full ${isFavorite(e.id) ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  <Heart className={`h-4 w-4 ${isFavorite(e.id) ? "fill-current" : ""}`} />
                </button>
              )}
              {e.kind === "character" && (
                <button
                  aria-label="Compare sentinel"
                  title="Compare combat stats"
                  onClick={() => setComparing(true)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <GitCompareArrows className="h-4 w-4" />
                </button>
              )}
              <button
                aria-label="Export official dossier PDF"
                title="Export official dossier PDF"
                disabled={exporting}
                onClick={() => void exportPdf()}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
              </button>
              {e.theme_song_url && <ThemeSongButton url={e.theme_song_url} />}
              <Link
                to="/reader"
                search={{ e: e.id }}
                aria-label="Open in reader mode"
                title="Reader mode"
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="h-4 w-4" />
              </Link>
              <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {/* Tabs — horizontal on mobile, moved to right edge rail on desktop */}
          <div className="flex gap-1.5 lg:hidden" role="tablist">
            {([["lore", "Lore"], ["powers", "Powers"], ["bonds", "Bonds & Series"], ["progress", "Progress"]] as const).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={dossierTab === t}
                onClick={() => setDossierTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${dossierTab === t ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <SketchGallery images={e.sketches} name={e.name} />
          {/* Season-scoped intel — role, status, abilities, scoped notes for selected season */}
          {seasonIdx >= 0 && seasons[seasonIdx] && (() => {
            const r = seasons[seasonIdx]!;
            const scopedNotes = (notes ?? []).filter((n) => n.text.startsWith("[scope]") && r.series?.title && n.text.includes(r.series.title));
            const seasonAbilities = (charAbilities ?? []).filter((ca) => !ca.series_id || ca.series_id === r.series_id);
            return (
              <div className="rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm uppercase tracking-widest" style={{ color: seasonHue ? `hsl(${seasonHue} 85% 65%)` : "var(--accent)" }}>{r.series?.title}{ctxSeason ? ` · ${ctxSeason}` : ""}</span>
                  {r.arc_role && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{r.arc_role}</span>}
                  {r.status && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{r.status}</span>}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{r.role_in_series ?? "Missing role / story"}</p>
                {seasonAbilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {seasonAbilities.map((ca) => <AbilityBadge key={ca.id} name={ca.ability_key} />)}
                  </div>
                )}
                {scopedNotes.length > 0 && (
                  <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    {scopedNotes.map((n) => <li key={n.id}>· {n.text.replace(/^\[scope\]\s*/, "")}</li>)}
                  </ul>
                )}
                {isAdmin && (
                  <input
                    className="mt-3 h-7 w-full rounded-md border border-white/15 bg-black/40 px-2 text-xs"
                    placeholder="Season role / story note…"
                    defaultValue={r.role_in_series ?? ""}
                    onBlur={async (ev) => {
                      const v = ev.target.value.trim();
                      if (v === (r.role_in_series ?? "")) return;
                      const { error } = await supabase.from("series_characters").update({ role_in_series: v || null }).eq("id", r.id);
                      if (error) toast.error(error.message); else { toast.success("Season note saved"); void qc.invalidateQueries({ queryKey: ["character-series", e.id] }); }
                    }}
                  />
                )}
              </div>
            );
          })()}
          {dossierTab === "lore" && e.description && <DescriptionBlock text={e.description} />}
          {dossierTab === "lore" && combat && (
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-secondary/20 p-4">
              <AbilityCardCanvas abilities={e.abilities} theme={e.card_theme} className="pointer-events-none absolute inset-0 h-full w-full opacity-20 mix-blend-screen" />
              <div className="relative">
              <h4 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Combat metrics</h4>
              <StatRadar a={combat} nameA={e.name} size={230} />
              </div>
            </div>
          )}
          {dossierTab === "powers" && (e.abilities?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-white/10 bg-secondary/20 p-4">
              <h4 className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">Abilities &amp; biological traits</h4>
              <div className="grid gap-3">
                {(["power", "beast", "element", "role", "art"] as AbilityGroup[]).map((g) => {
                  const items = sortAbilities(e.abilities ?? []).filter((a) => abilityDef(a).group === g);
                  if (!items.length) return null;
                  return (
                    <div key={g}>
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-accent">{ABILITY_GROUP_LABELS[g]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((a) => (
                          <button key={a} onClick={() => { sfx.pop(); setAbilityInfo(a); }} className="cursor-pointer" title="Ability details">
                            <AbilityBadge name={a} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {dossierTab === "lore" && stats.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {stats.map(([k, v]) => (
                <div key={k}><dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt><dd className="text-base">{v}</dd></div>
              ))}
            </dl>
          )}
          {dossierTab === "bonds" && <EntityLinks entity={e} isAdmin={isAdmin} onOpen={onOpen} />}
          {dossierTab === "bonds" && e.kind === "character" && <CharacterRelationships entity={e} isAdmin={isAdmin} onOpen={onOpen} />}
          {dossierTab === "bonds" && e.kind !== "character" && <OrgHierarchy entity={e} onOpen={onOpen} />}
          {dossierTab === "bonds" && e.kind === "character" && uiToggles.showSeriesAppearances && <SeriesAppearances entity={e} />}
          {dossierTab === "bonds" && e.kind === "character" && <CompareSentinel open={comparing} onOpenChange={setComparing} entity={e} />}
          {dossierTab === "progress" && (
            <div className="grid gap-4">
              {uiToggles.showJourneyGraph && seasons.length > 1 && <JourneyGraph rows={seasons} />}
              {uiToggles.showJourneyGraph && e.kind === "character" && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Compare journey:</span>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={journeyCompareId}
                    onChange={(ev) => setJourneyCompareId(ev.target.value)}
                  >
                    <option value="">Select character…</option>
                    {(allChars ?? []).filter((c) => c.id !== e.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {uiToggles.showJourneyGraph && journeyCompareId && compareSeasons.length > 0 && (
                <JourneyGraph rows={compareSeasons} />
              )}
              {uiToggles.showJourneyGraph && journeyCompareId && compareSeasons.length === 0 && (
                <p className="text-xs text-muted-foreground">No series data for the compared character.</p>
              )}
              <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">Ability progress by season</h4>
              {seasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No series data for this character.</p>
              ) : (
                seasons.map((r, i) => {
                  const hue = SEASON_HUES[i % SEASON_HUES.length];
                  const scoped = (notes ?? []).filter(
                    (n) => n.text.startsWith("[scope]") && r.series?.title && n.text.includes(r.series.title),
                  );
                  return (
                    <div key={r.id} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${hue} 85% 60%)` }} />
                        <span className="font-medium">{r.series?.title}</span>
                        {r.status && <span className="text-[10px] uppercase text-muted-foreground">{r.status}</span>}
                      </div>
                      {r.role_in_series ? (
                        <p className="mb-2 text-xs text-muted-foreground">{r.role_in_series}</p>
                      ) : (
                        <p className="mb-2 text-xs italic text-muted-foreground">Missing role / story</p>
                      )}
                      {scoped.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {scoped.map((n) => (
                            <span key={n.id} className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              {n.text.replace(/^\[scope\]\s*/, "")}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Per-season ability progression has no dedicated table yet. */}
                      {charAbilities && charAbilities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {charAbilities.map((ca) => (
                            <span key={ca.id} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px]">
                              {abilityDef(ca.ability_key).label}{ca.level ? ` · Lv${ca.level}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">No database for this season.</p>
                      )}
                    </div>
                  );
                })
              )}
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                <h4 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Combat role</h4>
                <div className="flex flex-wrap gap-1.5">
                  {[e.role, e.category, ...(e.abilities ?? []).filter((a) => abilityDef(a).group === "role")].filter(Boolean).map((t) => (
                    <span key={t} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">{t}</span>
                  ))}
                  {!e.role && !e.category && (e.abilities ?? []).filter((a) => abilityDef(a).group === "role").length === 0 && (
                    <span className="text-xs text-muted-foreground">No role classified.</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {dossierTab === "lore" && notes && notes.filter((n) => !/^\[(conflict|Auto-Merged|Auto-Stub|scope|resolved)\]/.test(n.text)).length > 0 && (
            <div className="grid gap-3">
              <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">Lore notes</h4>
              {notes.filter((n) => !/^\[(conflict|Auto-Merged|Auto-Stub|scope|resolved)\]/.test(n.text)).map((n) => (
                <div key={n.id} className="border-l-2 border-accent/60 pl-3">
                  <p>{n.text}</p>
                  {n.source && <p className="mt-1 text-xs text-muted-foreground">From {n.source}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Column 3 — character render + far-right edge tab strip */}
        <div className="relative hidden h-full lg:block" aria-hidden={false}>
          {/* Full-height character render */}
          {e.image_url && (
            <div className="absolute inset-0 flex items-end justify-center overflow-hidden">
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 85%, ${seasonHue ? `hsl(${seasonHue} 85% 55% / .22)` : "var(--accent)"} 0%, transparent 65%)` }} />
              <img src={e.image_url} alt={e.name} className="relative h-[92%] w-auto max-w-full object-contain object-bottom [mask-image:linear-gradient(to_top,black_55%,transparent_98%)]" />
            </div>
          )}
          <nav className="absolute right-0 top-0 flex h-full w-12 flex-col items-stretch gap-1 border-l border-white/10 bg-black/50 py-4" aria-label="Dossier sections">
          {([["lore", "Lore"], ["powers", "Powers"], ["bonds", "Bonds"], ["progress", "Progress"]] as const).map(([t, label], i) => {
            const active = dossierTab === t;
            const accent = seasonHue ? `hsl(${seasonHue} 85% 60%)` : "var(--accent)";
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                aria-label={label}
                title={label}
                onClick={() => setDossierTab(t)}
                className="group relative flex h-16 items-center justify-center"
              >
                <span
                  className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r transition-all"
                  style={{ background: active ? accent : "rgba(255,255,255,.15)", boxShadow: active ? `0 0 10px ${accent}` : undefined }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.2em] transition-colors"
                  style={{ writingMode: "vertical-rl", color: active ? accent : "rgba(255,255,255,.45)" }}
                >
                  {label}
                </span>
                <span className="pointer-events-none absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 text-[8px] text-muted-foreground transition-colors group-hover:text-foreground" style={active ? { borderColor: accent, color: accent } : {}}>{i + 1}</span>
              </button>
            );
          })}
          </nav>
        </div>
      </div>
      <AbilityInfoDialog name={abilityInfo} wielder={e.name} onClose={() => setAbilityInfo(null)} />
    </motion.div>
  );
}

/** Dossier ability detail modal — description, assigned tier glow, usage context. */
function AbilityInfoDialog({ name, wielder, onClose }: { name: string | null; wielder: string; onClose: () => void }) {
  const def = name ? abilityDef(name) : null;
  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {def && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl">
                <def.icon className="h-6 w-6" style={{ color: def.color }} />
                {def.label}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <AbilityBadge name={name!} />
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{ABILITY_GROUP_LABELS[def.group]}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: def.color, borderColor: `${def.color}66`, background: `${def.color}14` }}>
                  {def.tier} tier
                </span>
              </div>
              {def.description && <p className="text-foreground/85">{def.description}</p>}
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Wielder:</span> {wielder}
                {" — "}renders with the {def.tier === "Mythic" ? "animated red pulse" : def.tier === "Legendary" ? "gold aura" : `${def.tier} accent`} glow assigned to this character.
              </p>
              <p className="text-xs text-muted-foreground">Usage context is drawn from the official SCU registry entry — edit it from the Abilities Hub (admin).</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** AAA character-select style showcase: snap carousel spotlight cards. */
function ShowcaseView({ list, onOpen }: { list: Entity[]; onOpen: (e: Entity, ev: React.MouseEvent) => void }) {
  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {list.map((e) =>
        e.kind === "character" ? (
        <Link
          key={e.id}
          data-card
          to="/character"
          search={{ e: e.id }}
          className={`group relative block w-[78vw] max-w-xs shrink-0 snap-center overflow-hidden rounded-3xl text-left ${tierDef(e.character_tier)?.vfxClass ?? ""}`}
          style={{ "--scu-aura": e.accent_glow ?? e.theme_color ?? "#a855f7", minHeight: "22rem" } as unknown as CSSProperties}
        >
          {e.image_url ? (
            <img src={e.image_url} alt={e.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-accent/20" />
          )}
          <AbilityCardCanvas abilities={e.abilities} theme={e.card_theme} className="pointer-events-none absolute inset-0 h-full w-full opacity-40 transition-opacity group-hover:opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-5">
            <div className="flex justify-between">
              {tierDef(e.character_tier) && (
                <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: tierDef(e.character_tier)!.color, color: tierDef(e.character_tier)!.color }}>
                  {e.character_tier}
                </span>
              )}
              {e.theme_song_url && <ThemeSongButton url={e.theme_song_url} />}
            </div>
            <div>
              <h3 className="font-display text-3xl font-bold text-white drop-shadow-lg">{e.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-white/75">{e.role ?? e.category ?? ""}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
                View dossier →
              </span>
            </div>
          </div>
        </Link>
        ) : (
        <button
          key={e.id}
          data-card
          onClick={(ev) => onOpen(e, ev)}
          className={`group relative w-[78vw] max-w-xs shrink-0 snap-center overflow-hidden rounded-3xl text-left ${tierDef(e.character_tier)?.vfxClass ?? ""}`}
          style={{ "--scu-aura": e.accent_glow ?? e.theme_color ?? "#a855f7", minHeight: "22rem" } as unknown as CSSProperties}
        >
          {e.image_url ? (
            <img src={e.image_url} alt={e.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-accent/20" />
          )}
          <AbilityCardCanvas abilities={e.abilities} theme={e.card_theme} className="pointer-events-none absolute inset-0 h-full w-full opacity-40 transition-opacity group-hover:opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-5">
            <div className="flex justify-between">
              {tierDef(e.character_tier) && (
                <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: tierDef(e.character_tier)!.color, color: tierDef(e.character_tier)!.color }}>
                  {e.character_tier}
                </span>
              )}
              {e.theme_song_url && <ThemeSongButton url={e.theme_song_url} />}
            </div>
            <div>
              <h3 className="font-display text-3xl font-bold text-white drop-shadow-lg">{e.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-white/75">{e.role ?? e.category ?? ""}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
                View dossier →
              </span>
            </div>
          </div>
        </button>
        ))}
    </div>
  );
}

export function EntitySection({
  kinds, title, subtitle, categories, initialQuery = "", openId, view,
}: { kinds: Entity["kind"][]; title: string; subtitle: string; categories: string[]; initialQuery?: string; openId?: string | undefined; view?: "characters" | "organizations" }) {
  const isAdmin = useIsAdmin();
  const sectionStyle = useSectionStyle(view);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(entitiesQuery(kinds));
  const [open, setOpen] = useState<{ id: string; rect: DOMRect | null } | null>(null);
  const [editing, setEditing] = useState<Entity | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [merging, setMerging] = useState<Entity | null>(null);
  const [cat, setCat] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "showcase">(() => {
    try { const v = localStorage.getItem("scu-card-view"); return v === "list" || v === "showcase" ? v : "grid"; } catch { return "grid"; }
  });
  const [q, setQ] = useState(initialQuery);
  useEffect(() => setQ(initialQuery), [initialQuery]);

  const list = useMemo(() => (data ?? []).filter((e) => (cat === "all" || e.category === cat) && matchesSearch(e, q)), [data, cat, q]);
  const openedInList = (data ?? []).find((e) => e.id === open?.id);
  // Linked/deep-linked entities may belong to a different kind set — fetch by id as fallback.
  const { data: openedFetched } = useQuery({ ...entityByIdQuery(open?.id ?? ""), enabled: !!open && !openedInList });
  const opened = openedInList ?? openedFetched ?? null;

  // Deep link (?open=<id>): open that entity's dossier once it resolves.
  const { data: deepLinked } = useQuery({ ...entityByIdQuery(openId ?? ""), enabled: !!openId });
  useEffect(() => {
    if (!openId || open) return;
    const found = (data ?? []).find((e) => e.id === openId) ?? deepLinked;
    if (found) setOpen({ id: found.id, rect: null });
  }, [openId, data, deepLinked, open]);

  // Filter tabs = built-in categories plus any custom sectors present in the archive.
  const allCategories = useMemo(() => {
    const seen = new Set(categories);
    const extra = [...new Set((data ?? []).map((e) => e.category).filter((c): c is string => typeof c === "string" && c.trim().length > 0 && !seen.has(c)))].sort();
    return [...categories, ...extra];
  }, [categories, data]);

  useWebMCP({
    name: "list_archive_entries",
    description: `List the ${title} entries currently shown on this page.`,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool("list_archive_entries", () =>
        isLoading ? "Still loading." : list.length === 0 ? "No entries shown." : list.map((e) => `${e.id}: ${e.name} (${e.category ?? e.kind}, ${e.status})`).join("\n"),
      ),
  });

  useWebMCP({
    name: "open_dossier",
    description: "Open one shown entry's dossier on screen.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Entry id from list_archive_entries." } }, required: ["id"] },
    annotations: { untrustedContentHint: true },
    execute: ({ id }: { id: string }) =>
      runWebMCPTool("open_dossier", () => {
        const e = list.find((x) => x.id === id);
        if (!e) throw new Error("That entry is not in the current view.");
        setOpen({ id: e.id, rect: null });
        return `Opened ${e.name}.`;
      }),
  });

  const doDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("entities").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      toast.success(`${deleting.name} deleted`);
      qc.invalidateQueries({ queryKey: ["entities"] });
      qc.invalidateQueries({ queryKey: ["search-index"] });
      qc.removeQueries({ queryKey: ["notes", deleting.id] });
    }
    setDeleting(null);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-5" style={sectionStyle}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archive</p>
          <h1 className="mt-2 text-5xl font-medium glow-text">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {isAdmin && <Button onClick={() => setEditing(null)} size="sm"><Plus className="h-4 w-4" />New</Button>}
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className="glass h-11 rounded-full pl-10" />
      </div>
      <div data-no-swipe className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {["all", ...allCategories].map((k) => (
          <button key={k} onClick={() => setCat(k)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${cat === k ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {k === "all" ? "All" : k}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" />
        {([["grid", "Grid"], ["list", "List"], ["showcase", "Showcase"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setViewMode(v); try { localStorage.setItem("scu-card-view", v); } catch { /* noop */ } }}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${viewMode === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EntityGridSkeleton />
      ) : list.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{data?.length ? "No matches." : "Nothing in the archive yet."}</p>
      ) : viewMode === "showcase" ? (
        <ShowcaseView list={list} onOpen={(e) => { sfx.tierReveal(e.character_tier); }} />
      ) : (
        <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-3"}>
          <AnimatePresence initial={false}>
            {list.map((e, i) => {
              if (open?.id === e.id) return null; // unmount → shared-element morph into dossier
              return (
              <motion.article
                key={e.id}
                layout
                layoutId={`card-${e.id}`}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.45), duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18, ease: "easeIn" } }}
                whileTap={{ scale: 0.98 }}
                className={`glass group relative flex gap-4 overflow-hidden rounded-2xl p-4 transition-[transform,box-shadow,border-radius] duration-300 hover:-translate-y-0.5 hover:rounded-tr-[2rem] hover:glow-ring ${tierDef(e.character_tier)?.vfxClass ?? ""} ${animationClass(e.animation_style)}`}
                style={{ "--scu-aura": e.accent_glow ?? e.theme_color ?? "#a855f7" } as unknown as MotionStyle}
              >
                <AbilityCardCanvas abilities={e.abilities} theme={e.card_theme} className="pointer-events-none absolute inset-0 h-full w-full opacity-30 transition-opacity group-hover:opacity-60" />
                <Link
                  to="/character"
                  search={{ e: e.id }}
                  className="flex min-w-0 flex-1 gap-4"
                >
                  <Avatar e={e} size="h-16 w-16" />
                  <CardBody e={e} showKind={kinds.length > 1} />
                </Link>
                {e.theme_song_url && <ThemeSongButton url={e.theme_song_url} />}
                {isAdmin && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 active:scale-90" aria-label="Edit" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 active:scale-90" aria-label="Merge into another entry" onClick={() => setMerging(e)}><GitMerge className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive active:scale-90" aria-label="Delete" onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {opened && <DetailOverlay key={opened.id} e={opened} from={open?.rect ?? null} onClose={() => setOpen(null)} isAdmin={isAdmin} onOpen={(target) => setOpen({ id: target.id, rect: null })} />}
      </AnimatePresence>

      {editing !== undefined && (
        <EntityDialog key={editing?.id ?? "new"} open onOpenChange={(o) => !o && setEditing(undefined)}
          entity={editing} defaultKind={kinds[0] ?? "character"} allowedKinds={kinds} />
      )}
      {merging && (
        <MergeEntityDialog open onOpenChange={(o) => !o && setMerging(null)} entity={merging} />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the entry and its lore notes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
