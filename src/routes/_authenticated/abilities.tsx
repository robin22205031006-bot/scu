import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { entitiesQuery, type Entity } from "@/lib/entities";
import {
  ABILITY_GROUP_LABELS,
  ABILITY_REGISTRY,
  TIER_LABELS,
  TIER_ORDER,
  abilityDef,
  allAbilityDefs,
  normalizeAbilityKey,
  removeCustomAbility,
  saveCustomAbility,
  saveAbilityOverride,
  getAbilityOverrides,
  removeAbilityOverride,
  type AbilityOverride,
  type AbilityDef,
  type AbilityTier,
} from "@/lib/abilities";
import { AbilityBadge } from "@/components/ability-badge";
import { EntityGridSkeleton } from "@/components/route-skeleton";
import { sfx } from "@/lib/scu-audio";
import type { Json } from "@/integrations/supabase/types";

const ALL_KINDS = ["character", "organization", "clan", "bloodline", "faction"] as const;
const CUSTOM_SETTINGS_KEY = "ability_registry";
const OVERRIDES_SETTINGS_KEY = "ability_overrides";
const REGISTRY_KEYS = new Set(ABILITY_REGISTRY.map((a) => a.key));

export const Route = createFileRoute("/_authenticated/abilities")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Abilities Hub — Sentinels Cinematic Universe" },
      { name: "description", content: "Every power, beast trait and role in the SCU — cross-referenced to the characters who wield them." },
      { property: "og:title", content: "Abilities Hub — SCU" },
      { property: "og:description", content: "The complete SCU ability registry with rarity tiers and character cross-references." },
    ],
  }),
  component: AbilitiesHub,
});

function AbilitiesHub() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: entities, isLoading } = useQuery(entitiesQuery([...ALL_KINDS]));
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<AbilityTier | "all">("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDef, setEditingDef] = useState<AbilityDef | null>(null);
  const [customsVersion, setCustomsVersion] = useState(0);

  // Hydrate admin-defined abilities from app_settings into the local registry cache.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", CUSTOM_SETTINGS_KEY).maybeSingle();
      const list = Array.isArray(data?.value) ? (data.value as unknown as AbilityDef[]) : [];
      if (!alive || !list.length) return;
      try {
        localStorage.setItem("scu_custom_abilities", JSON.stringify(list));
        setCustomsVersion((v) => v + 1);
      } catch { /* storage optional */ }
      // Hydrate admin overrides (edited tiers/descriptions) the same way.
      const { data: ov } = await supabase.from("app_settings").select("value").eq("key", OVERRIDES_SETTINGS_KEY).maybeSingle();
      if (alive && ov?.value && typeof ov.value === "object" && !Array.isArray(ov.value)) {
        try {
          localStorage.setItem("scu_ability_overrides", JSON.stringify(ov.value));
          setCustomsVersion((v) => v + 1);
        } catch { /* storage optional */ }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Reverse index: ability key -> entities that carry it in abilities/beast_traits.
  const holders = useMemo(() => {
    const map = new Map<string, Entity[]>();
    for (const e of entities ?? []) {
      const names = [...(e.abilities ?? []), ...(e.beast_traits ?? [])];
      const seen = new Set<string>();
      for (const n of names) {
        const def = abilityDef(n);
        if (seen.has(def.key)) continue;
        seen.add(def.key);
        const arr = map.get(def.key) ?? [];
        arr.push(e);
        map.set(def.key, arr);
      }
    }
    return map;
    // customsVersion forces recompute after admin adds an ability
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, customsVersion]);

  // Registry defs + any ad-hoc strings found on entities that aren't registered.
  const defs = useMemo(() => {
    const base = allAbilityDefs();
    const known = new Set(base.map((d) => normalizeAbilityKey(d.key)));
    const extras: AbilityDef[] = [];
    for (const e of entities ?? []) {
      for (const n of [...(e.abilities ?? []), ...(e.beast_traits ?? [])]) {
        const d = abilityDef(n);
        if (!known.has(normalizeAbilityKey(d.key))) {
          known.add(normalizeAbilityKey(d.key));
          extras.push(d);
        }
      }
    }
    return [...base, ...extras];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, customsVersion]);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      defs.filter((d) => {
        if (tier !== "all" && d.tier !== tier) return false;
        if (!needle) return true;
        return (
          d.label.toLowerCase().includes(needle) ||
          d.tier.toLowerCase().includes(needle) ||
          ABILITY_GROUP_LABELS[d.group].toLowerCase().includes(needle) ||
          (holders.get(d.key) ?? []).some((e) => e.name.toLowerCase().includes(needle))
        );
      }),
    [defs, tier, needle, holders],
  );

  const byTier = useMemo(() => {
    const groups = new Map<AbilityTier, AbilityDef[]>();
    for (const d of filtered) {
      const arr = groups.get(d.tier) ?? [];
      arr.push(d);
      groups.set(d.tier, arr);
    }
    for (const arr of groups.values()) arr.sort((a, b) => a.label.localeCompare(b.label));
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, customsVersion]);

  const presentTiers = TIER_ORDER.filter((t) => byTier.has(t));
  const customKeys = useMemo(
    () => new Set(allAbilityDefs().filter((d) => !REGISTRY_KEYS.has(d.key)).map((d) => d.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customsVersion],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-5">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archive</p>
          <h1 className="mt-2 flex items-center gap-2 text-5xl font-medium glow-text">
            <Sparkles className="h-8 w-8 text-accent" /> Abilities Hub
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Every power, beast trait and role — cross-referenced to the characters who wield them.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Add ability
          </Button>
        )}
      </header>

      {isAdmin && showAdd && <AddAbilityForm onSaved={() => { setShowAdd(false); setCustomsVersion((v) => v + 1); void qc.invalidateQueries({ queryKey: ["app-settings"] }); }} />}
      {isAdmin && editingDef && <EditAbilityForm def={editingDef} onClose={() => setEditingDef(null)} onSaved={() => { setEditingDef(null); setCustomsVersion((v) => v + 1); void qc.invalidateQueries({ queryKey: ["app-settings"] }); }} />}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search abilities or characters…" className="glass h-9 w-64 rounded-full pl-8 text-sm" />
        </div>
        <button onClick={() => setTier("all")} className={`rounded-full px-3 py-1 text-xs ${tier === "all" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>All</button>
        {TIER_ORDER.map((t) => (
          <button key={t} onClick={() => setTier(tier === t ? "all" : t)}
            className={`rounded-full px-3 py-1 text-xs ${tier === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {TIER_LABELS[t]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EntityGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No abilities match.</p>
      ) : (
        presentTiers.map((t) => (
          <section key={t} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tierColor(t) }} />
              {TIER_LABELS[t]} <span className="text-muted-foreground/60">({byTier.get(t)?.length ?? 0})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(byTier.get(t) ?? []).map((d) => (
                <AbilityCard
                  key={d.key}
                  def={d}
                  holders={holders.get(d.key) ?? []}
                  open={openKey === d.key}
                  onToggle={() => { sfx.click(); setOpenKey(openKey === d.key ? null : d.key); }}
                  isAdmin={isAdmin}
                  isCustom={customKeys.has(d.key)}
                  onEdit={() => setEditingDef(d)}
                  onDeleteCustom={() => {
                    removeCustomAbility(d.key);
                    setCustomsVersion((v) => v + 1);
                    toast.success(`Removed "${d.label}" from the registry.`);
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function tierColor(t: AbilityTier): string {
  switch (t) {
    case "Mythic": return "#ff2d2d";
    case "Legendary": return "#d4af37";
    case "Rare": return "#38bdf8";
    case "Exceptional": return "#a78bfa";
    case "Unique": return "#f59e0b";
    case "Ancient": return "#78716c";
    default: return "#64748b";
  }
}

function AbilityCard({
  def, holders, open, onToggle, isAdmin, isCustom, onDeleteCustom, onEdit,
}: {
  def: AbilityDef;
  holders: Entity[];
  open: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isCustom: boolean;
  onDeleteCustom: () => void;
  onEdit: () => void;
}) {
  const Icon = def.icon;
  return (
    <div
      className="glass rounded-2xl p-4 transition-shadow"
      style={{ boxShadow: `0 0 12px ${def.color}22, inset 0 0 0 1px ${def.color}33` }}
    >
      <button onClick={onToggle} className="flex w-full items-start gap-3 text-left">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${def.color}1f`, color: def.color, boxShadow: `0 0 10px ${def.color}44` }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{def.label}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span style={{ color: def.color }}>{def.tier}</span>
            <span>·</span>
            <span>{ABILITY_GROUP_LABELS[def.group]}</span>
            <span>·</span>
            <span>{holders.length} {holders.length === 1 ? "holder" : "holders"}</span>
          </span>
        </span>
      </button>
      {def.description && <p className="mt-2 text-xs text-muted-foreground">{def.description}</p>}

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          {holders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No characters carry this yet — assign it from a character's editor.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {holders.map((e) => (
                <Link
                  key={e.id}
                  to="/reader"
                  search={{ e: e.id }}
                  className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  {e.name}
                </Link>
              ))}
            </div>
          )}
          {isAdmin && (
            <div className="mt-3 flex items-center gap-3">
              <button onClick={onEdit} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent">
                <Pencil className="h-3 w-3" /> Edit ability
              </button>
              {isCustom && (
                <button onClick={onDeleteCustom} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> Remove from registry
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddAbilityForm({ onSaved }: { onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState<AbilityTier>("Rare");
  const [color, setColor] = useState("#a855f7");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = label.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const def: AbilityDef = {
        key: `custom_${normalizeAbilityKey(clean)}`,
        label: clean,
        tier,
        group: "power",
        color,
        icon: Sparkles,
        ...(description.trim() ? { description: description.trim() } : {}),
      };
      saveCustomAbility(def);
      // Mirror to app_settings so other devices pick it up.
      const { data: existing } = await supabase.from("app_settings").select("value").eq("key", CUSTOM_SETTINGS_KEY).maybeSingle();
      const list = Array.isArray(existing?.value) ? [...(existing.value as unknown as AbilityDef[])] : [];
      const idx = list.findIndex((a) => normalizeAbilityKey(a.key) === def.key);
      if (idx >= 0) list[idx] = def; else list.push(def);
      const { error } = await supabase.from("app_settings").upsert({ key: CUSTOM_SETTINGS_KEY, value: list as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success(`"${clean}" added to the registry.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save ability.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label>Ability name</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Null Field"' className="h-9" />
      </div>
      <div className="grid gap-1.5">
        <Label>Rarity tier</Label>
        <select value={tier} onChange={(e) => setTier(e.target.value as AbilityTier)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {TIER_ORDER.filter((t) => t !== "Role").map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          <option value="Role">Role</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label>Glow color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input bg-background" />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 font-mono text-xs" />
        </div>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label>Description (optional)</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown on the ability card and badge tooltip" className="h-9" />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button size="sm" onClick={() => void submit()} disabled={busy || !label.trim()}>{busy ? "Saving…" : "Add to registry"}</Button>
        <Button size="sm" variant="ghost" onClick={onSaved}>Cancel</Button>
      </div>
    </div>
  );
}

/** Admin edit form — writes an override (name/tier/color/description) for any ability. */
function EditAbilityForm({ def, onClose, onSaved }: { def: AbilityDef; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(def.label);
  const [tier, setTier] = useState<AbilityTier>(def.tier);
  const [color, setColor] = useState(def.color);
  const [description, setDescription] = useState(def.description ?? "");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const submit = async (reset: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const override: AbilityOverride = reset
        ? {}
        : {
            ...(label.trim() && label.trim() !== def.label ? { label: label.trim() } : {}),
            ...(tier !== def.tier ? { tier } : {}),
            ...(color !== def.color ? { color } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          };
      if (reset) removeAbilityOverride(def.key); else saveAbilityOverride(def.key, override);
      const merged = { ...(getAbilityOverrides()[normalizeAbilityKey(def.key)] ?? {}), ...(reset ? {} : override) };
      void merged;
      // Mirror overrides map to app_settings so other devices see the same ranks.
      const all = getAbilityOverrides();
      const { error } = await supabase.from("app_settings").upsert({ key: OVERRIDES_SETTINGS_KEY, value: all as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success(reset ? `"${def.label}" reset to registry defaults.` : `"${label || def.label}" updated.`);
      void qc.invalidateQueries({ queryKey: ["app-settings"] });
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save ability.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass mb-6 grid gap-3 rounded-2xl border border-accent/30 p-4 sm:grid-cols-2">
      <p className="text-xs font-medium text-accent sm:col-span-2">Editing: {def.label} <span className="text-muted-foreground">({def.key})</span></p>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label>Display name</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
      </div>
      <div className="grid gap-1.5">
        <Label>Rarity tier</Label>
        <select value={tier} onChange={(e) => setTier(e.target.value as AbilityTier)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {TIER_ORDER.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label>Glow color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input bg-background" />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 font-mono text-xs" />
        </div>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label>Description / usage context</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="How this character wields it in battle" className="h-9" />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" onClick={() => void submit(false)} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        <Button size="sm" variant="ghost" onClick={() => void submit(true)} disabled={busy}>Reset to defaults</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
