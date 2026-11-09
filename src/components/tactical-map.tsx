import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { mapLocationsQuery, parseSentinels, type MapLocation } from "@/lib/map";
import { sfx } from "@/lib/scu-audio";

const EMPTY_PIN = {
  name: "",
  pos_x: 50,
  pos_y: 50,
  era: "",
  faction: "",
  report: "",
  battles: "",
  sentinels: "",
};

type PinForm = typeof EMPTY_PIN;

/** Deterministic pseudo-random terrain blobs so the map looks organic but stable. */
function blob(seed: number, cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = r * (0.75 + 0.25 * Math.sin(seed * 12.9898 + i * 78.233));
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.7).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function TacticalMap() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: pins = [], isLoading } = useQuery(mapLocationsQuery);
  const [selected, setSelected] = useState<MapLocation | null>(null);
  const [editing, setEditing] = useState<MapLocation | "new" | null>(null);
  const [f, setF] = useState<PinForm>(EMPTY_PIN);
  const [eraFilter, setEraFilter] = useState<string>("all");
  const eras = [...new Set(pins.map((p) => p.era).filter((e): e is string => !!e && e.trim().length > 0))].sort();
  const visiblePins = eraFilter === "all" ? pins : pins.filter((p) => p.era === eraFilter);

  const terrain = useMemo(
    () => [
      { seed: 3, cx: 22, cy: 30, r: 16, fill: "var(--accent)", op: 0.05 },
      { seed: 7, cx: 68, cy: 62, r: 20, fill: "var(--accent)", op: 0.04 },
      { seed: 11, cx: 45, cy: 78, r: 14, fill: "#f59e0b", op: 0.05 },
      { seed: 17, cx: 82, cy: 26, r: 12, fill: "#ef4444", op: 0.05 },
      { seed: 23, cx: 30, cy: 70, r: 12, fill: "#38bdf8", op: 0.04 },
    ],
    [],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["map-locations"] });

  const startEdit = (pin: MapLocation | "new") => {
    setEditing(pin);
    setSelected(null);
    setF(
      pin === "new"
        ? EMPTY_PIN
        : {
            name: pin.name,
            pos_x: pin.pos_x,
            pos_y: pin.pos_y,
            era: pin.era ?? "",
            faction: pin.faction ?? "",
            report: pin.report,
            battles: pin.battles,
            sentinels: pin.sentinels,
          },
    );
  };

  const save = async () => {
    if (!f.name.trim()) return;
    const payload = {
      name: f.name.trim(),
      pos_x: Math.min(100, Math.max(0, f.pos_x)),
      pos_y: Math.min(100, Math.max(0, f.pos_y)),
      era: f.era || null,
      faction: f.faction || null,
      report: f.report,
      battles: f.battles,
      sentinels: f.sentinels,
      updated_at: new Date().toISOString(),
    };
    const { error } =
      editing === "new" || editing === null
        ? await supabase.from("map_locations").insert(payload)
        : await supabase.from("map_locations").update(payload).eq("id", (editing as MapLocation).id);
    if (error) { toast.error(error.message); return; }
    sfx.click();
    toast.success(editing === "new" || editing === null ? "Pin added" : "Pin updated");
    setEditing(null);
    setF(EMPTY_PIN);
    refresh();
  };

  const del = async (pin: MapLocation) => {
    const { error } = await supabase.from("map_locations").delete().eq("id", pin.id);
    if (error) { toast.error(error.message); return; }
    sfx.remove();
    toast.success(`Removed ${pin.name}`);
    if (selected?.id === pin.id) setSelected(null);
    if (editing !== "new" && editing?.id === pin.id) setEditing(null);
    refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* ---- Theater map ---- */}
      <div className="glass relative overflow-hidden rounded-2xl">
        <svg viewBox="0 0 100 62.5" className="block h-auto w-full" role="img" aria-label="SCU tactical map">
          <defs>
            <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--border)" strokeOpacity="0.25" strokeWidth="0.15" />
            </pattern>
            <radialGradient id="vign" cx="50%" cy="50%" r="75%">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="var(--background)" stopOpacity="0.55" />
            </radialGradient>
          </defs>

          <rect width="100" height="62.5" fill="var(--card)" />
          <rect width="100" height="62.5" fill="url(#grid)" />

          {terrain.map((t) => (
            <polygon key={t.seed} points={blob(t.seed, t.cx, t.cy, t.r)} fill={t.fill} opacity={t.op} />
          ))}

          {/* stylized coastline hint */}
          <path
            d="M0,58 C15,54 22,60 34,57 C46,54 52,60 66,56 C78,53 88,58 100,55 L100,62.5 L0,62.5 Z"
            fill="var(--accent)"
            opacity="0.08"
          />

          {/* graticule labels */}
          {[10, 30, 50, 70, 90].map((x) => (
            <text key={`x${x}`} x={x} y="61.8" fontSize="1.6" fill="var(--muted-foreground)" opacity="0.6" textAnchor="middle">
              {String(x).padStart(2, "0")}E
            </text>
          ))}
          {[10, 30, 50].map((y) => (
            <text key={`y${y}`} x="1" y={y} fontSize="1.6" fill="var(--muted-foreground)" opacity="0.6">
              {String(y).padStart(2, "0")}N
            </text>
          ))}

          {/* pins */}
          {visiblePins.map((pin, i) => {
            const x = (pin.pos_x / 100) * 100;
            const y = (pin.pos_y / 100) * 62.5;
            const active = selected?.id === pin.id;
            return (
              <g
                key={pin.id}
                transform={`translate(${x},${y})`}
                className="cursor-pointer"
                onClick={() => {
                  sfx.click();
                  setSelected(active ? null : pin);
                  setEditing(null);
                }}
              >
                <motion.circle
                  r={active ? 3.2 : 2.2}
                  fill="var(--accent)"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                />
                <circle r={active ? 5.5 : 4} fill="none" stroke="var(--accent)" strokeOpacity={active ? 0.9 : 0.45} strokeWidth="0.35">
                  {!active && (
                    <animate attributeName="r" values="4;7;4" dur="2.4s" repeatCount="indefinite" />
                  )}
                </circle>
                {(active || i % 3 === 0) && (
                  <text y="-3.4" fontSize="1.9" fill="var(--foreground)" textAnchor="middle" style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 0.5 }}>
                    {pin.name.length > 18 ? `${pin.name.slice(0, 17)}…` : pin.name}
                  </text>
                )}
              </g>
            );
          })}

          <rect width="100" height="62.5" fill="url(#vign)" pointerEvents="none" />
        </svg>

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-accent" /> Tactical survey // SCU theater
        </div>
        {isAdmin && (
          <div className="absolute right-3 top-3">
            <Button size="sm" variant="secondary" onClick={() => startEdit("new")}>
              <Plus className="h-3.5 w-3.5" /> Pin
            </Button>
          </div>
        )}
        {!isLoading && pins.length === 0 && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "No pins yet — add the first location." : "No locations charted yet."}
            </p>
          </div>
        )}
        {eras.length > 0 && (
          <div className="pointer-events-auto absolute bottom-3 left-3 flex max-w-[70%] flex-wrap gap-1.5">
            {["all", ...eras].map((era) => (
              <button
                key={era}
                onClick={() => setEraFilter(era)}
                className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider backdrop-blur transition-colors ${eraFilter === era ? "bg-accent text-accent-foreground" : "bg-background/70 text-muted-foreground hover:text-foreground"}`}
              >
                {era === "all" ? "All eras" : era}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- Detail / editor panel ---- */}
      <div className="glass h-fit rounded-2xl p-5">
        {editing ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{editing === "new" ? "New pin" : "Edit pin"}</h3>
              <button aria-label="Close editor" onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input placeholder="Location name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Easting %
                <Input type="number" min={0} max={100} value={f.pos_x} onChange={(e) => setF({ ...f, pos_x: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Northing %
                <Input type="number" min={0} max={100} value={f.pos_y} onChange={(e) => setF({ ...f, pos_y: Number(e.target.value) })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Era" value={f.era} onChange={(e) => setF({ ...f, era: e.target.value })} />
              <Input placeholder="Controlling faction" value={f.faction} onChange={(e) => setF({ ...f, faction: e.target.value })} />
            </div>
            <Textarea placeholder="Field report" rows={3} value={f.report} onChange={(e) => setF({ ...f, report: e.target.value })} />
            <Textarea placeholder="Historic battles" rows={2} value={f.battles} onChange={(e) => setF({ ...f, battles: e.target.value })} />
            <Textarea placeholder="Sentinels stationed (comma-separated)" rows={2} value={f.sentinels} onChange={(e) => setF({ ...f, sentinels: e.target.value })} />
            <div className="flex justify-end gap-2">
              {editing !== "new" && (
                <Button size="sm" variant="destructive" onClick={() => del(editing as MapLocation)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" onClick={save}>Save pin</Button>
            </div>
          </div>
        ) : selected ? (
          <div>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                  {[selected.era, selected.faction].filter(Boolean).join(" · ") || "Uncharted"}
                </p>
                <h3 className="mt-1 text-2xl font-medium">{selected.name}</h3>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {String(selected.pos_x).padStart(2, "0")}E / {String(selected.pos_y).padStart(2, "0")}N
                </p>
              </div>
              <button aria-label="Close" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {selected.report && (
              <section className="mb-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Field report</p>
                <p className="text-sm leading-relaxed text-foreground/85">{selected.report}</p>
              </section>
            )}
            {selected.battles && (
              <section className="mb-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Historic battles</p>
                <p className="text-sm leading-relaxed text-foreground/85">{selected.battles}</p>
              </section>
            )}
            {parseSentinels(selected.sentinels).length > 0 && (
              <section>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Sentinels stationed</p>
                <div className="flex flex-wrap gap-1.5">
                  {parseSentinels(selected.sentinels).map((s) => (
                    <span key={s} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent">{s}</span>
                  ))}
                </div>
              </section>
            )}
            {isAdmin && (
              <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={() => startEdit(selected)}>
                <Pencil className="h-3.5 w-3.5" /> Edit pin
              </Button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Select a pin to view field intelligence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
