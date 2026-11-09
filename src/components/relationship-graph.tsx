import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { entitiesQuery, type Entity, type EntityMembership } from "@/lib/entities";
import { PanelSkeleton } from "@/components/route-skeleton";

const ALL_KINDS: Entity["kind"][] = ["character", "organization", "clan", "bloodline", "faction"];

const KIND_COLOR: Record<Entity["kind"], string> = {
  character: "var(--accent)",
  organization: "#7dd3fc",
  clan: "#86efac",
  bloodline: "#c4b5fd",
  faction: "#fbbf24",
};
const KIND_LABEL: Record<Entity["kind"], string> = {
  character: "Character",
  organization: "Organization",
  clan: "Clan",
  bloodline: "Bloodline",
  faction: "Faction",
};

const W = 1000;
const H = 640;

const KIND_ORDER: Entity["kind"][] = ["character", "organization", "clan", "bloodline", "faction"];

/** Sector layout: each entity kind gets its own wedge, nodes spiral outward by degree. */
function layoutPositions(nodes: Entity[]) {
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) / 2 - 70;
  const byKind = new Map<Entity["kind"], Entity[]>();
  for (const e of nodes) {
    const arr = byKind.get(e.kind) ?? [];
    arr.push(e);
    byKind.set(e.kind, arr);
  }
  const kindsPresent = KIND_ORDER.filter((k) => byKind.has(k));
  const pos = new Map<string, { x: number; y: number }>();
  kindsPresent.forEach((k, ki) => {
    const list = [...(byKind.get(k) ?? [])].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const sector = (Math.PI * 2) / kindsPresent.length;
    const start = -Math.PI / 2 + ki * sector;
    list.forEach((e, i) => {
      const t = list.length === 1 ? 0.5 : (i + 0.5) / list.length;
      const angle = start + t * sector * 0.92;
      const r = 36 + Math.sqrt(i + 1) * (maxR / Math.sqrt(Math.max(list.length, 4)));
      pos.set(e.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * 0.85 });
    });
  });
  return pos;
}

export function RelationshipGraph() {
  const nav = useNavigate();
  const [kinds, setKinds] = useState<Set<Entity["kind"]>>(new Set(ALL_KINDS));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(1);

  const { data: entities, isLoading } = useQuery({ ...entitiesQuery(ALL_KINDS), staleTime: 60_000 });
  const { data: memberships } = useQuery({
    queryKey: ["graph-memberships"],
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

  const nodes = useMemo(() => (entities ?? []).filter((e) => kinds.has(e.kind)), [entities, kinds]);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const positions = useMemo(() => layoutPositions(nodes), [nodes]);

  const edges = useMemo(
    () => (memberships ?? []).filter((m) => nodeIds.has(m.character_id) && nodeIds.has(m.group_id)),
    [memberships, nodeIds],
  );

  // Ego network of the selected node.
  const ego = useMemo(() => {
    if (!selectedId) return null;
    const linked = new Set<string>([selectedId]);
    const rels: { membership: EntityMembership; other: Entity }[] = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const m of edges) {
      const otherId = m.character_id === selectedId ? m.group_id : m.group_id === selectedId ? m.character_id : null;
      if (otherId && byId.has(otherId)) {
        linked.add(otherId);
        rels.push({ membership: m, other: byId.get(otherId)! });
      }
    }
    return { linked, rels };
  }, [selectedId, edges, nodes]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const searching = q.trim().length > 0;
  const matches = (e: Entity) =>
    !searching || [e.name, e.alias, e.role, e.category].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()));

  const dimmed = (id: string) => (selectedId ? !ego?.linked.has(id) : false);
  const edgeActive = (m: EntityMembership) =>
    !selectedId || m.character_id === selectedId || m.group_id === selectedId;

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const m of edges) {
      d.set(m.character_id, (d.get(m.character_id) ?? 0) + 1);
      d.set(m.group_id, (d.get(m.group_id) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const toggleKind = (k: Entity["kind"]) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const openEntity = (e: Entity) =>
    nav({ to: e.kind === "character" ? "/characters" : "/orgs", search: { q: e.name, open: e.id } });

  return (
    <div className="grid gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Highlight by name…" className="glass h-9 w-56 rounded-full" />
        {ALL_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => toggleKind(k)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition-opacity ${
              kinds.has(k) ? "bg-secondary text-foreground" : "text-muted-foreground opacity-50"
            }`}
          >
            {KIND_LABEL[k]}s
          </button>
        ))}
      </div>

      <div className="relative">
        {isLoading ? (
          <PanelSkeleton className="h-[70vh]" />
        ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <svg viewBox={`${W / 2 - W / (2 * zoom)} ${H / 2 - H / (2 * zoom)} ${W / zoom} ${H / zoom}`} className="block h-[70vh] w-full" role="img" aria-label="Entity relationship graph">
            {/* Edges */}
            {edges.map((m) => {
              const a = positions.get(m.character_id);
              const b = positions.get(m.group_id);
              if (!a || !b) return null;
              const active = edgeActive(m);
              const hot = selectedId && (m.character_id === selectedId || m.group_id === selectedId);
              return (
                <line
                  key={m.id}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={hot ? "var(--accent)" : "var(--muted-foreground)"}
                  strokeOpacity={active ? (hot ? 0.9 : 0.4) : 0.08}
                  strokeWidth={hot ? 1.6 : 0.8}
                  className="transition-[stroke,stroke-opacity,stroke-width] duration-300"
                />
              );
            })}
            {/* Nodes */}
            {nodes.map((e) => {
              const p = positions.get(e.id);
              if (!p) return null;
              const isSel = e.id === selectedId;
              const hide = dimmed(e.id) || (searching && !matches(e));
              const r = 7 + Math.min(8, (degree.get(e.id) ?? 0) * 1.5);
              return (
                <g
                  key={e.id}
                  onClick={() => setSelectedId(isSel ? null : e.id)}
                  className="cursor-pointer"
                  style={{ opacity: hide ? 0.15 : 1, transition: "opacity .25s" }}
                >
                  {isSel && <circle cx={p.x} cy={p.y} r={r + 7} fill="none" stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={1} />}
                  <circle
                    cx={p.x} cy={p.y} r={r}
                    fill={KIND_COLOR[e.kind]}
                    fillOpacity={isSel ? 1 : 0.85}
                    stroke="var(--background)"
                    strokeWidth={1.5}
                    style={{ transition: "r .2s" }}
                  />
                  <text
                    x={p.x} y={p.y + r + 11}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--muted-foreground)"
                    style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}
                  >
                    {(e.name ?? "").length > 22 ? `${(e.name ?? "").slice(0, 21)}…` : (e.name ?? "")}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        )}

        {/* zoom controls */}
        <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-sm font-bold hover:text-foreground">−</button>
          <button aria-label="Reset zoom" onClick={() => setZoom(1)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-[10px] font-bold hover:text-foreground">{Math.round(zoom * 100)}%</button>
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))} className="grid h-8 w-8 place-items-center rounded-full bg-secondary/90 text-sm font-bold hover:text-foreground">+</button>
        </div>

        {/* Selection panel */}
        {selected && (
          <div className="glass morph-in absolute right-3 top-3 w-64 rounded-2xl p-4 text-sm">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{KIND_LABEL[selected.kind]}</p>
            <h3 className="mt-1 font-display text-2xl">{selected.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {[selected.status, selected.category, selected.role].filter(Boolean).join(" · ")}
            </p>
            {ego && ego.rels.length > 0 && (
              <div className="mt-3 grid gap-1 border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Connections ({ego.rels.length})</p>
                {ego.rels.slice(0, 12).map(({ membership: m, other }) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(other.id)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-secondary/60"
                  >
                    <span className="truncate">{other.name}</span>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{m.status}</span>
                  </button>
                ))}
                {ego.rels.length > 12 && <p className="px-2 text-[10px] text-muted-foreground">+{ego.rels.length - 12} more</p>}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => openEntity(selected)}>
                <Maximize2 className="h-3.5 w-3.5" /> Open dossier
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav({ to: "/reader", search: { e: selected.id } })} aria-label="Reader mode">
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {nodes.length} nodes · {edges.length} links — click a node to isolate its relationships.
      </p>
    </div>
  );
}
