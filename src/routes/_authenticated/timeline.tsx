import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Dot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { useSectionStyle } from "@/hooks/use-typography";
import { entitiesQuery, GROUP_LINK_KINDS, timelineQuery, type TimelineEvent } from "@/lib/entities";
import { sfx } from "@/lib/scu-audio";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Sentinels Cinematic Universe" },
      { name: "description", content: "The chronological history of the Sentinels Cinematic Universe." },
      { property: "og:title", content: "Timeline — SCU" },
      { property: "og:description", content: "The chronological history of the SCU." },
    ],
  }),
  component: Timeline,
});

/** Named severity tiers mapped onto the numeric 1-10 impact column. */
const IMPACT_TIERS = [
  { label: "Low", value: 2, color: "var(--status-neutral, #8b93a7)" },
  { label: "Medium", value: 5, color: "var(--accent)" },
  { label: "High", value: 8, color: "#f59e0b" },
  { label: "Catastrophic", value: 10, color: "#ef4444" },
] as const;

function impactTier(raw: number | null | undefined) {
  const v = Number.isFinite(raw) ? (raw as number) : 5;
  return IMPACT_TIERS.reduce((best, t) => (Math.abs(t.value - v) < Math.abs(best.value - v) ? t : best));
}

const EMPTY_FORM = { title: "", era: "", series: "", impact: 5, description: "" };

type EventForm = typeof EMPTY_FORM;

export function Timeline() {
  const isAdmin = useIsAdmin();
  const sectionStyle = useSectionStyle("timeline");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(timelineQuery);
  const { data: groups } = useQuery(entitiesQuery(GROUP_LINK_KINDS));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [series, setSeries] = useState("all");
  const [era, setEra] = useState("all");
  const [clan, setClan] = useState("all");
  const [f, setF] = useState<EventForm>(EMPTY_FORM);

  const allSeries = Array.from(new Set((data ?? []).map((e) => e.series).filter((s): s is string => !!s)));
  const allEras = Array.from(new Set((data ?? []).map((e) => e.era).filter((s): s is string => !!s)));
  const clans = (groups ?? []).filter((g) => g.kind === "clan" || g.kind === "bloodline" || g.kind === "faction");
  const selectedClan = clans.find((c) => c.id === clan);
  const clanNeedles = selectedClan
    ? [selectedClan.name, selectedClan.alias ?? ""].map((s) => s.toLowerCase()).filter(Boolean)
    : [];
  const events = (data ?? []).filter((e) => {
    if (series !== "all" && e.series !== series) return false;
    if (era !== "all" && e.era !== era) return false;
    if (clanNeedles.length) {
      const hay = [e.title, e.description, e.series, e.era, e.source].filter(Boolean).join(" ").toLowerCase();
      if (!clanNeedles.some((n) => hay.includes(n))) return false;
    }
    return true;
  });
  const chart = events.map((e, i) => ({
    i: i + 1,
    xlabel: e.era?.trim() || `Event ${i + 1}`,
    impact: e.impact,
    title: e.title,
    era: e.era ?? "",
    series: e.series ?? "",
    tier: impactTier(e.impact).label,
    color: impactTier(e.impact).color,
  }));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["timeline"] });
    qc.invalidateQueries({ queryKey: ["search-index"] });
  };

  const add = async () => {
    if (!f.title.trim()) return;
    const { error } = await supabase.from("timeline_events").insert({
      title: f.title, era: f.era || null, series: f.series || null, impact: Math.min(10, Math.max(1, f.impact)),
      description: f.description, sort_order: Math.max(0, ...(data ?? []).map((event) => event.sort_order)) + 1,
    });
    if (error) { toast.error(error.message); return; }
    sfx.add();
    setF(EMPTY_FORM); setAdding(false); refresh();
  };

  const startEdit = (ev: TimelineEvent) => {
    setEditing(ev);
    setF({ title: ev.title, era: ev.era ?? "", series: ev.series ?? "", impact: ev.impact, description: ev.description ?? "" });
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editing || !f.title.trim()) return;
    const { error } = await supabase.from("timeline_events").update({
      title: f.title, era: f.era || null, series: f.series || null,
      impact: Math.min(10, Math.max(1, f.impact)), description: f.description,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    sfx.click();
    toast.success(`Updated "${f.title}"`);
    setEditing(null); setF(EMPTY_FORM); refresh();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("timeline_events").delete().eq("id", id);
    if (error) toast.error(error.message); else { sfx.remove(); toast.success("Event deleted"); refresh(); }
  };

  const form = (
    <div className="glass mb-10 grid gap-3 rounded-2xl p-5">
      <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Era / year" value={f.era} onChange={(e) => setF({ ...f, era: e.target.value })} />
        <Input placeholder="Series" value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })} />
        <select
          value={f.impact}
          onChange={(e) => setF({ ...f, impact: Number(e.target.value) })}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Impact severity"
        >
          {IMPACT_TIERS.map((t) => (
            <option key={t.label} value={t.value}>{t.label} ({t.value})</option>
          ))}
          {!IMPACT_TIERS.some((t) => t.value === f.impact) && (
            <option value={f.impact}>Impact {f.impact}</option>
          )}
        </select>
      </div>
      <Textarea placeholder="What happened" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setAdding(false); setEditing(null); setF(EMPTY_FORM); }}>Cancel</Button>
        <Button onClick={editing ? saveEdit : add}>{editing ? "Save changes" : "Add event"}</Button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-5" style={sectionStyle}>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Chronicle</p>
          <h1 className="mt-2 text-5xl font-medium glow-text">Timeline</h1>
        </div>
        {isAdmin && <Button size="sm" onClick={() => { setAdding(!adding); setEditing(null); setF(EMPTY_FORM); }}><Plus className="h-4 w-4" />Event</Button>}
      </header>

      {chart.length > 1 && (
        <div data-no-swipe className="glass mb-6 h-56 rounded-2xl p-3">
          <div className="flex items-center justify-between px-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Impact</p>
            <div className="flex gap-3">
              {IMPACT_TIERS.map((t) => (
                <span key={t.label} className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />{t.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height="88%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="imp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity={0.6} />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                dataKey="xlabel"
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickFormatter={(v) => String(v).slice(0, 14)}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 12 }}
                formatter={(v) => [`${v} · ${impactTier(Number(v)).label}`, "Impact"]}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload;
                  return [d?.title, d?.era, d?.series].filter(Boolean).join(" — ");
                }}
              />
              <Area
                type="monotone"
                dataKey="impact"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#imp)"
                isAnimationActive={false}
                dot={(p: { cx: number; cy: number; payload?: { impact: number; color: string } }) => (
                  <Dot
                    cx={p.cx}
                    cy={p.cy}
                    r={p.payload && p.payload.impact >= 8 ? 4 : p.payload && p.payload.impact >= 5 ? 3 : 2}
                    fill={p.payload?.color ?? "var(--accent)"}
                    stroke="none"
                  />
                )}
                activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {(allSeries.length > 0 || allEras.length > 0 || clans.length > 0) && (
        <div className="mb-8 space-y-2">
          {(allSeries.length > 0 || allEras.length > 0) && (
            <div data-no-swipe className="flex gap-1.5 overflow-x-auto">
              {["all", ...allSeries].map((s) => (
                <button key={s} onClick={() => setSeries(s)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${series === s ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
                  {s === "all" ? "All series" : s}
                </button>
              ))}
              {allEras.length > 0 && <span className="mx-1 w-px shrink-0 bg-border" />}
              {["all", ...allEras].map((e2) => (
                <button key={e2} onClick={() => setEra(e2)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${era === e2 ? "bg-accent/25 text-accent" : "text-muted-foreground"}`}>
                  {e2 === "all" ? "All eras" : e2}
                </button>
              ))}
            </div>
          )}
          {clans.length > 0 && (
            <div data-no-swipe className="flex gap-1.5 overflow-x-auto">
              <select
                aria-label="Filter by clan or faction"
                value={clan}
                onChange={(e) => setClan(e.target.value)}
                className="h-7 shrink-0 rounded-full border border-border bg-secondary px-3 text-xs text-foreground"
              >
                <option value="all">All clans &amp; factions</option>
                {clans.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {(series !== "all" || era !== "all" || clan !== "all") && (
                <button
                  onClick={() => { setSeries("all"); setEra("all"); setClan("all"); }}
                  className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {adding && form}
      {editing && !adding && form}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !events.length ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ol className="relative border-l pl-8">
          {events.map((ev, i) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.04, 0.5), duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } }}
              className="relative pb-10 last:pb-0"
            >
              <span className="absolute -left-[37px] top-2 h-2.5 w-2.5 rounded-full border-2 border-accent bg-background glow-ring" />
              <p className="text-[11px] uppercase tracking-widest text-accent">{[ev.era, ev.series].filter(Boolean).join(" · ")}</p>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-medium">{ev.title}</h2>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button aria-label="Edit event" onClick={() => startEdit(ev)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button aria-label="Delete event" onClick={() => del(ev.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                Impact {ev.impact}/10 · {impactTier(ev.impact).label}
              </p>
              {ev.description && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{ev.description}</p>}
              {ev.source && <p className="mt-1 text-xs text-muted-foreground">From {ev.source}</p>}
            </motion.li>
          ))}
        </ol>
      )}
    </main>
  );
}
