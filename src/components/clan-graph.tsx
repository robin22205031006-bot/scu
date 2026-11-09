import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, GitBranch, Link2, Swords, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  entitiesQuery,
  entityRelationsQuery,
  REL_TYPES,
  type Entity,
  type EntityMembership,
  type EntityRelation,
  type RelType,
} from "@/lib/entities";
import { getCombatStats } from "@/lib/combat-stats";

const ALL_KINDS: Entity["kind"][] = ["character", "organization", "clan", "bloodline", "faction"];
const GROUP_KINDS = new Set(["organization", "clan", "bloodline", "faction"]);

const KIND_COLOR: Record<Entity["kind"], string> = {
  character: "var(--accent)",
  organization: "#7dd3fc",
  clan: "#86efac",
  bloodline: "#c4b5fd",
  faction: "#fbbf24",
};

const REL_COLOR: Record<RelType, string> = {
  commands: "#f5b942",
  ally: "#34d399",
  rival: "#fb4d6d",
  mentor: "#7dd3fc",
  kin: "#c4b5fd",
};
const REL_LABEL: Record<RelType, string> = {
  commands: "Commands",
  ally: "Alliance",
  rival: "Rivalry",
  mentor: "Mentor",
  kin: "Kin",
};

const W = 1100;
const H = 700;

type ViewMode = "hierarchy" | "squad" | "network";
const VIEWS: { id: ViewMode; label: string; icon: typeof GitBranch }[] = [
  { id: "hierarchy", label: "Clan Hierarchy", icon: GitBranch },
  { id: "squad", label: "Squad Structure", icon: Users },
  { id: "network", label: "Rivalry / Alliance", icon: Swords },
];

function statusTag(e: Entity): { label: string; cls: string } {
  switch (e.status) {
    case "Alive": case "Active": return { label: "Active", cls: "fill-emerald-400/90" };
    case "Missing": return { label: "MIA", cls: "fill-amber-400/90" };
    case "Dead": case "Inactive": return { label: "Deceased", cls: "fill-rose-400/90" };
    case "Retired": return { label: "Retired", cls: "fill-slate-400/90" };
    case "Legend": return { label: "Legend", cls: "fill-amber-300/90" };
    default: return { label: e.status, cls: "fill-zinc-400/90" };
  }
}

function signatureWeapon(e: Entity): string | null {
  const s = (e.stats ?? {}) as Record<string, unknown>;
  for (const k of ["signature_weapon", "weapon", "signature"]) {
    const v = s[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

interface Pos { x: number; y: number }

export function ClanGraph() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [view, setView] = useState<ViewMode>("hierarchy");
  const [groupId, setGroupId] = useState<string>("");
  const [quick, setQuick] = useState<{ e: Entity; x: number; y: number } | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [linkForm, setLinkForm] = useState({ source: "", target: "", rel: "ally" as RelType, label: "" });

  const { data: entities } = useQuery(entitiesQuery(ALL_KINDS));
  const { data: memberships } = useQuery({
    queryKey: ["clan-graph-memberships"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entity_memberships").select("*");
      if (error) {
        if (/entity_memberships|schema cache|does not exist/i.test(error.message)) return [] as EntityMembership[];
        throw error;
      }
      return data;
    },
  });
  const { data: relations } = useQuery(entityRelationsQuery);

  const byId = useMemo(() => new Map((entities ?? []).map((e) => [e.id, e])), [entities]);

  const groups = useMemo(() => {
    const memberGroups = new Set((memberships ?? []).map((m) => m.group_id));
    return (entities ?? []).filter((e) => GROUP_KINDS.has(e.kind) && memberGroups.has(e.id));
  }, [entities, memberships]);

  const activeGroupId = groupId || groups[0]?.id || "";
  const activeGroup = byId.get(activeGroupId) ?? null;

  const membersOf = useMemo(() => {
    const map = new Map<string, Entity[]>();
    for (const m of memberships ?? []) {
      const g = byId.get(m.group_id);
      const c = byId.get(m.character_id);
      if (!g || !c || c.kind !== "character") continue;
      const arr = map.get(m.group_id) ?? [];
      arr.push(c);
      map.set(m.group_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return map;
  }, [memberships, byId]);

  // ---- layout per view ----
  const { nodes, edges } = useMemo(() => {
    const pos = new Map<string, Pos>();
    const eds: { a: string; b: string; kind: "member" | RelType; label?: string | undefined }[] = [];

    if (view === "hierarchy" || view === "squad") {
      if (!activeGroup) return { nodes: [] as { e: Entity; p: Pos }[], edges: eds };
      const members = membersOf.get(activeGroup.id) ?? [];
      pos.set(activeGroup.id, { x: W / 2, y: view === "hierarchy" ? 90 : H / 2 });
      members.forEach((m, i) => {
        if (view === "hierarchy") {
          const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(members.length))));
          const row = Math.floor(i / cols);
          const col = i % cols;
          const inRow = Math.min(cols, members.length - row * cols);
          pos.set(m.id, {
            x: W / 2 + (col - (inRow - 1) / 2) * 150,
            y: 210 + row * 130,
          });
        } else {
          const angle = (Math.PI * 2 * i) / Math.max(members.length, 1) - Math.PI / 2;
          pos.set(m.id, { x: W / 2 + Math.cos(angle) * 380, y: H / 2 + Math.sin(angle) * 240 });
        }
        eds.push({ a: activeGroup.id, b: m.id, kind: "member" });
      });
      // commands/mentor/kin edges between members of this group
      const ids = new Set([activeGroup.id, ...members.map((m) => m.id)]);
      for (const r of relations ?? []) {
        if (ids.has(r.source_id) && ids.has(r.target_id) && r.rel !== "ally" && r.rel !== "rival") {
          eds.push({ a: r.source_id, b: r.target_id, kind: r.rel as RelType, label: r.label ?? undefined });
        }
      }
    } else {
      // network: every group with members, clusters on a ring
      const gs = groups.filter((g) => (membersOf.get(g.id) ?? []).length > 0);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) / 2 - 90;
      gs.forEach((g, gi) => {
        const angle = (Math.PI * 2 * gi) / Math.max(gs.length, 1) - Math.PI / 2;
        const gx = cx + Math.cos(angle) * R;
        const gy = cy + Math.sin(angle) * R * 0.8;
        pos.set(g.id, { x: gx, y: gy });
        const mems = membersOf.get(g.id) ?? [];
        mems.forEach((m, mi) => {
          const ma = (Math.PI * 2 * mi) / Math.max(mems.length, 1);
          pos.set(m.id, { x: gx + Math.cos(ma) * 95, y: gy + Math.sin(ma) * 62 });
          eds.push({ a: g.id, b: m.id, kind: "member" });
        });
      });
      const ids = new Set(pos.keys());
      for (const r of relations ?? []) {
        if (ids.has(r.source_id) && ids.has(r.target_id)) {
          eds.push({ a: r.source_id, b: r.target_id, kind: r.rel as RelType, label: r.label ?? undefined });
        }
      }
    }

    const nodes = [...pos.entries()]
      .map(([id, p]) => ({ e: byId.get(id)!, p }))
      .filter((n) => n.e);
    return { nodes, edges: eds };
  }, [view, activeGroup, membersOf, relations, byId, groups]);

  const edgeColor = (k: string) => (k === "member" ? "rgba(255,255,255,0.14)" : REL_COLOR[k as RelType]);
  const edgeDash = (k: string) => (k === "rival" || k === "commands" ? "5 4" : k === "member" ? "2 4" : undefined);

  const openDossier = (e: Entity) => {
    nav({ to: e.kind === "character" ? "/characters" : "/orgs", search: { open: e.id } });
  };

  const addLink = async () => {
    if (!linkForm.source || !linkForm.target || linkForm.source === linkForm.target) {
      toast.error("Pick two different entities");
      return;
    }
    const { error } = await supabase.from("entity_relations").insert({
      source_id: linkForm.source,
      target_id: linkForm.target,
      rel: linkForm.rel,
      label: linkForm.label || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Link added");
    setLinkForm({ source: "", target: "", rel: "ally", label: "" });
    qc.invalidateQueries({ queryKey: ["entity-relations"] });
  };

  const removeLink = async (id: string) => {
    const { error } = await supabase.from("entity_relations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["entity-relations"] });
  };

  const combat = quick ? getCombatStats(quick.e.stats) : null;
  const weapon = quick ? signatureWeapon(quick.e) : null;

  return (
    <div className="grid gap-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-white/10 bg-secondary/40 p-1">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${view === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        {(view === "hierarchy" || view === "squad") && groups.length > 0 && (
          <select
            className="h-9 rounded-full border border-white/10 bg-secondary/40 px-3 text-sm"
            value={activeGroupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => setEditingLinks((v) => !v)}>
            <Link2 className="h-4 w-4" />{editingLinks ? "Done" : "Edit links"}
          </Button>
        )}
      </div>

      {/* admin link editor */}
      {isAdmin && editingLinks && (
        <div className="glass grid gap-3 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Entity relations (commands / ally / rival / mentor / kin)</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_1fr_auto]">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={linkForm.source} onChange={(e) => setLinkForm({ ...linkForm, source: e.target.value })}>
              <option value="">Source…</option>
              {(entities ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={linkForm.target} onChange={(e) => setLinkForm({ ...linkForm, target: e.target.value })}>
              <option value="">Target…</option>
              {(entities ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm capitalize" value={linkForm.rel} onChange={(e) => setLinkForm({ ...linkForm, rel: e.target.value as RelType })}>
              {REL_TYPES.map((r) => <option key={r} value={r}>{REL_LABEL[r]}</option>)}
            </select>
            <Input placeholder="Label (optional)" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} />
            <Button size="sm" onClick={addLink}>Add</Button>
          </div>
          {(relations ?? []).length > 0 && (
            <div className="grid max-h-40 gap-1 overflow-y-auto">
              {(relations ?? []).map((r) => {
                const s = byId.get(r.source_id);
                const t = byId.get(r.target_id);
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-xs">
                    <span className="font-medium" style={{ color: REL_COLOR[r.rel as RelType] }}>{REL_LABEL[r.rel as RelType] ?? r.rel}</span>
                    <span className="truncate">{s?.name ?? "?"} → {t?.name ?? "?"}{r.label ? ` (${r.label})` : ""}</span>
                    <button aria-label="Delete link" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeLink(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* graph */}
      <div className="glass relative overflow-hidden rounded-2xl">
        {nodes.length === 0 ? (
          <p className="grid h-72 place-items-center text-sm text-muted-foreground">
            {groups.length === 0 ? "No clans or organizations with members yet." : "Nothing to display for this view."}
          </p>
        ) : (
          <svg viewBox={`${W / 2 - W / (2 * zoom)} ${H / 2 - H / (2 * zoom)} ${W / zoom} ${H / zoom}`} className="h-auto w-full">
            {edges.map((e2, i) => {
              const a = nodes.find((n) => n.e.id === e2.a)?.p;
              const b = nodes.find((n) => n.e.id === e2.b)?.p;
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2 - 24;
              return (
                <path
                  key={i}
                  d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
                  fill="none"
                  stroke={edgeColor(e2.kind)}
                  strokeWidth={e2.kind === "member" ? 1 : 1.6}
                  strokeDasharray={edgeDash(e2.kind)}
                  opacity={e2.kind === "member" ? 0.7 : 0.9}
                />
              );
            })}
            {edges.filter((e2) => e2.kind !== "member" && e2.label).map((e2, i) => {
              const a = nodes.find((n) => n.e.id === e2.a)?.p;
              const b = nodes.find((n) => n.e.id === e2.b)?.p;
              if (!a || !b) return null;
              return (
                <text key={`lbl${i}`} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 30} textAnchor="middle" fontSize={10} fill={edgeColor(e2.kind)} opacity={0.85}>
                  {e2.label}
                </text>
              );
            })}
            {nodes.map(({ e, p }) => {
              const isGroup = GROUP_KINDS.has(e.kind);
              const r = isGroup ? 34 : 24;
              return (
                <g
                  key={e.id}
                  transform={`translate(${p.x},${p.y})`}
                  className="cursor-pointer"
                  onClick={() => setQuick({ e, x: p.x, y: p.y })}
                >
                  <circle r={r + 5} fill="transparent" />
                  <circle r={r} fill="#0d1117" stroke={KIND_COLOR[e.kind]} strokeWidth={isGroup ? 2.4 : 1.6} />
                  {e.image_url ? (
                    <image href={e.image_url} x={-r + 4} y={-r + 4} width={(r - 4) * 2} height={(r - 4) * 2} preserveAspectRatio="xMidYMid slice" clipPath={`circle(${r - 4}px at ${r - 4}px ${r - 4}px)`} />
                  ) : (
                    <text textAnchor="middle" dy={5} fontSize={isGroup ? 22 : 15} fill={KIND_COLOR[e.kind]} fontFamily="serif">
                      {e.name[0]?.toUpperCase()}
                    </text>
                  )}
                  <rect x={-r} y={r - 6} width={r * 2} height={11} rx={5.5} fill="#000" opacity={0.72} />
                  <text y={r + 2} textAnchor="middle" fontSize={8.5} fill="#e4e4e7" letterSpacing={0.4}>
                    {(e.name ?? "").length > 16 ? `${(e.name ?? "").slice(0, 15)}…` : (e.name ?? "")}
                  </text>
                  <circle cx={r - 4} cy={-r + 4} r={4.5} fill={statusDot(e.status)} stroke="#000" strokeWidth={1} />
                </g>
              );
            })}
          </svg>
        )}

        {/* zoom controls */}
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-sm font-bold hover:text-foreground">−</button>
          <button aria-label="Reset zoom" onClick={() => setZoom(1)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-[10px] font-bold hover:text-foreground">{Math.round(zoom * 100)}%</button>
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-sm font-bold hover:text-foreground">+</button>
        </div>

        {/* quick view card */}
        {quick && (
          <div
            className="glass absolute z-10 w-64 rounded-2xl p-4 shadow-2xl"
            style={{
              left: `${Math.min(Math.max((quick.x / W) * 100, 4), 68)}%`,
              top: `${Math.min(Math.max((quick.y / H) * 100, 6), 62)}%`,
            }}
          >
            <button aria-label="Close" onClick={() => setQuick(null)} className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-3">
              {quick.e.image_url ? (
                <img src={quick.e.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary font-display text-xl" style={{ color: KIND_COLOR[quick.e.kind] }}>{quick.e.name[0]}</div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{quick.e.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{quick.e.kind} · {quick.e.role ?? quick.e.category ?? ""}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2 py-0.5" style={{ color: KIND_COLOR[quick.e.kind] }}>{statusTag(quick.e).label}</span>
              {combat && <span className="text-muted-foreground">PWR {combat.power} · AGI {combat.agility}</span>}
            </div>
            {weapon && <p className="mt-2 text-xs text-muted-foreground">Signature: {weapon}</p>}
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => openDossier(quick.e)}>
              <BookOpen className="h-3.5 w-3.5" /> Open dossier
            </Button>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#fb4d6d" }} />Rivalry</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />Alliance</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#f5b942" }} />Commands</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#7dd3fc" }} />Mentor</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#c4b5fd" }} />Kin</span>
        <span className="ml-auto">Click any node for quick view</span>
      </div>
    </div>
  );
}

function statusDot(status: string): string {
  switch (status) {
    case "Alive": case "Active": return "#34d399";
    case "Missing": return "#fbbf24";
    case "Dead": case "Inactive": return "#fb4d6d";
    case "Legend": return "#f5b942";
    default: return "#71717a";
  }
}
