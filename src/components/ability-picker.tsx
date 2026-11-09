import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ABILITY_GROUP_LABELS,
  allAbilityDefs,
  abilityDef,
  normalizeAbilityKey,
  sortAbilities,
} from "@/lib/abilities";
import { AbilityBadge } from "./ability-badge";

/**
 * Admin tag-style multi-select for entities.abilities — searchable registry
 * suggestions plus unlimited custom entries, reorderable, with live badge
 * previews (legendary glow, beast colors, tier tooltips).
 */
export function AbilityPicker({
  value, onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");

  const selected = useMemo(() => sortAbilities(value), [value]);
  const needle = q.trim().toLowerCase();

  const suggestions = useMemo(() => {
    const chosen = new Set(value.map(normalizeAbilityKey));
    return allAbilityDefs().filter(
      (a) =>
        !chosen.has(a.key) &&
        (!needle ||
          a.label.toLowerCase().includes(needle) ||
          a.tier.toLowerCase().includes(needle) ||
          a.group.toLowerCase().includes(needle)),
    );
  }, [value, needle]);

  const add = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (value.some((v) => normalizeAbilityKey(v) === normalizeAbilityKey(clean))) return;
    onChange(sortAbilities([...value, clean]));
    setQ("");
    setCustom("");
  };

  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  const move = (name: string, dir: -1 | 1) => {
    const sorted = sortAbilities(value);
    const i = sorted.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
    onChange(sorted);
  };

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Abilities, powers &amp; traits</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{value.length} assigned</span>
      </div>

      {/* Selected tags with reorder + remove */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => {
            const def = abilityDef(name);
            const i = selected.indexOf(name);
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-1 text-[10px] font-medium uppercase tracking-wider"
                style={{ color: def.color, borderColor: `${def.color}55`, background: `${def.color}14` }}
                title={`${def.label} — ${def.tier}`}
              >
                <def.icon className="h-3 w-3" style={{ color: def.color }} />
                {name}
                <button aria-label={`Move ${name} up`} onClick={() => move(name, -1)} className="text-muted-foreground hover:text-foreground"><ArrowUp className="h-2.5 w-2.5" /></button>
                <button aria-label={`Move ${name} down`} onClick={() => move(name, 1)} className="text-muted-foreground hover:text-foreground"><ArrowDown className="h-2.5 w-2.5" /></button>
                <button aria-label={`Remove ${name}`} onClick={() => remove(name)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            );
          })}
        </div>
      )}

      {/* Live badge preview */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-background/50 p-2">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Preview</span>
          {selected.slice(0, 8).map((n) => <AbilityBadge key={n} name={n} />)}
          {selected.length > 8 && <span className="text-[10px] text-muted-foreground">+{selected.length - 8}</span>}
        </div>
      )}

      {/* Registry search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search powers, beasts, roles…"
          className="h-9 pl-8 text-sm"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
          {suggestions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => add(a.label)}
              title={`${a.label} — ${a.tier} · ${ABILITY_GROUP_LABELS[a.group]}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-secondary"
            >
              <a.icon className="h-3.5 w-3.5 shrink-0" style={{ color: a.color }} />
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
              <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      {needle && suggestions.length === 0 && !custom.trim() && (
        <p className="text-[11px] text-muted-foreground">No registry match — add it as a custom tag below.</p>
      )}

      {/* Custom tag */}
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(custom))}
          placeholder='Custom tag, e.g. "Architect Cube Guardian"'
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" variant="secondary" disabled={!custom.trim()} onClick={() => add(custom)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
