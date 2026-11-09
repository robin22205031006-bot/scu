import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatRadar } from "@/components/stat-radar";
import { entitiesQuery, matchesSearch, type Entity } from "@/lib/entities";
import { COMBAT_STATS, getCombatStats, type CombatStats } from "@/lib/combat-stats";

function Delta({ a, b }: { a: number; b: number }) {
  const d = a - b;
  if (d === 0) return <span className="text-muted-foreground">±0</span>;
  return (
    <span className={d > 0 ? "text-emerald-400" : "text-rose-400"}>
      {d > 0 ? `+${d}` : d}
    </span>
  );
}

function StatTable({ a, b, nameA, nameB }: { a: CombatStats; b: CombatStats; nameA: string; nameB: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Stat</th>
            <th className="py-1 pr-3 font-normal">{nameA}</th>
            <th className="py-1 pr-3 font-normal">{nameB}</th>
            <th className="py-1 font-normal">Δ</th>
          </tr>
        </thead>
        <tbody>
          {COMBAT_STATS.map(({ key, label }) => (
            <tr key={key} className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-muted-foreground">{label}</td>
              <td className="py-1.5 pr-3 font-medium text-rose-300">{a[key]}</td>
              <td className="py-1.5 pr-3 font-medium text-amber-300">{b[key]}</td>
              <td className="py-1.5"><Delta a={a[key]} b={b[key]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Side-by-side combat comparison for two characters. */
export function CompareSentinel({
  open,
  onOpenChange,
  entity,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: Entity;
}) {
  const [q, setQ] = useState("");
  const [otherId, setOtherId] = useState<string | null>(null);
  const { data: characters } = useQuery({ ...entitiesQuery(["character"]), enabled: open });

  const options = useMemo(
    () => (characters ?? []).filter((c) => c.id !== entity.id && matchesSearch(c, q)),
    [characters, entity.id, q],
  );
  const other = (characters ?? []).find((c) => c.id === otherId) ?? null;
  const statsA = getCombatStats(entity.stats);
  const statsB = other ? getCombatStats(other.stats) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <GitCompareArrows className="h-5 w-5 text-accent" /> Compare Sentinel
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters…" />
          <div className="grid max-h-40 gap-1 overflow-y-auto">
            {options.slice(0, 30).map((c) => (
              <button
                key={c.id}
                onClick={() => setOtherId(c.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${otherId === c.id ? "bg-accent/15 text-foreground" : "hover:bg-secondary"}`}
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.status}</span>
              </button>
            ))}
            {options.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No characters found.</p>}
          </div>

          {other && statsA && statsB ? (
            <div className="grid gap-5">
              <div className="grid gap-6 sm:grid-cols-2">
                <StatRadar a={statsA} nameA={entity.name} size={200} />
                <StatRadar a={statsB} nameA={other.name} size={200} />
              </div>
              <StatTable a={statsA} b={statsB} nameA={entity.name} nameB={other.name} />
            </div>
          ) : other ? (
            <p className="text-sm text-muted-foreground">
              {entity.name} or {other.name} has no combat stats yet — an admin can set them in the entity editor.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Select a second character to overlay their combat metrics.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
