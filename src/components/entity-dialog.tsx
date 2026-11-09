import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sfx } from "@/lib/scu-audio";
import { CHARACTER_STATUSES, GROUP_LINK_KINDS, GROUP_STATUSES, RELATIONSHIP_LABELS, RELATIONSHIP_TYPES, characterRelationshipsQuery, entitiesQuery, fileToDataUrl, type Entity } from "@/lib/entities";
import { COMBAT_STATS, getCombatStats, splitStats, type CombatStats } from "@/lib/combat-stats";
import { mergeLocks } from "@/lib/lore-merge";
import { AbilityPicker } from "./ability-picker";
import { CARD_THEMES } from "./ability-canvas";
import { ANIMATION_LABELS, ANIMATION_STYLES, CHARACTER_TIERS } from "@/lib/character-tier";

type Kind = Entity["kind"];
const FIELDS = ["name", "alias", "role", "status", "category", "description", "image_url", "stats", "sketches"] as const;

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? "" : s)}
          className={`rounded-full border px-3 py-1 text-xs ${value === s ? "border-accent bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
          {s}
        </button>
      ))}
    </div>
  );
}

export function EntityDialog({
  open, onOpenChange, entity, defaultKind, allowedKinds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity?: Entity | null;
  defaultKind: Kind;
  allowedKinds: Kind[];
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>(entity?.kind ?? defaultKind);
  const [form, setForm] = useState({
    name: entity?.name ?? "",
    alias: entity?.alias ?? "",
    role: entity?.role ?? "",
    status: entity?.status ?? (defaultKind === "character" ? "Alive" : "Active"),
    category: entity?.category ?? "",
    description: entity?.description ?? "",
    image_url: entity?.image_url ?? "",
    stats: entity ? Object.entries((entity.stats as Record<string, string>) ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n") : "",
    sketches: entity?.sketches ?? [],
    parent_id: entity?.parent_id ?? "",
    abilities: entity?.abilities ?? [],
    character_tier: entity?.character_tier ?? "",
    animation_style: entity?.animation_style ?? "",
    theme_color: entity?.theme_color ?? "",
    accent_glow: entity?.accent_glow ?? "",
    theme_song_url: entity?.theme_song_url ?? "",
    card_theme: entity?.card_theme ?? "",
  });
  const [relTarget, setRelTarget] = useState("");
  const [relType, setRelType] = useState<string>(RELATIONSHIP_TYPES[0]);
  const [sketchUrl, setSketchUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const isChar = kind === "character";
  const [combat, setCombat] = useState<CombatStats>(() => getCombatStats(entity?.stats) ?? { power: 0, agility: 0, tactical_iq: 0, clan_mastery: 0, weapon_proficiency: 0 });

  // Existing sectors for this entity type — admins can also type a custom one.
  const kindsKey = [...allowedKinds].sort().join(",");
  const { data: existingCategories } = useQuery({
    queryKey: ["entity-categories", kindsKey],
    queryFn: async () => {
      const { data } = await supabase.from("entities").select("category").in("kind", allowedKinds);
      return [...new Set((data ?? []).map((e) => e.category).filter((c): c is string => typeof c === "string" && c.trim().length > 0))].sort();
    },
  });
  // Parent-organization candidates for group kinds, and character candidates for relationships.
  const { data: parentCandidates } = useQuery({
    ...entitiesQuery(GROUP_LINK_KINDS),
    enabled: open && !isChar,
  });
  const { data: rels } = useQuery({ ...characterRelationshipsQuery(entity?.id ?? ""), enabled: open && isChar && !!entity });
  const { data: charCandidates } = useQuery({
    ...entitiesQuery(["character"]),
    enabled: open && isChar && !!entity,
  });

  const addRelationship = async () => {
    if (!entity || !relTarget || !relType) return;
    const { error } = await supabase.from("character_relationships").insert({
      character_id_1: entity.id,
      character_id_2: relTarget,
      relationship_type: relType,
    });
    if (error) { toast.error(error.message); return; }
    sfx.add();
    setRelTarget("");
    qc.invalidateQueries({ queryKey: ["char-relationships"] });
  };

  const removeRelationship = async (id: string) => {
    const { error } = await supabase.from("character_relationships").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["char-relationships"] });
  };

  const set = (k: "name" | "alias" | "role" | "description" | "stats") => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const parsed = Object.fromEntries(
      form.stats.split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2 && (p[0] ?? "").trim()).map(([k, ...v]) => [(k ?? "").trim(), v.join(":").trim()]),
    );
    const { custom } = splitStats(parsed);
    // Canonical combat stats come from the sliders; the textarea keeps custom keys only.
    const stats = isChar
      ? { ...custom, ...Object.fromEntries(COMBAT_STATS.filter(({ key }) => combat[key] > 0).map(({ key }) => [key, combat[key]])) }
      : parsed;
    const row = {
      kind,
      name: form.name.trim(),
      alias: form.alias || null,
      role: form.role || null,
      status: form.status,
      category: form.category || null,
      description: form.description,
      image_url: form.image_url || null,
      stats,
      sketches: form.sketches,
      abilities: isChar ? form.abilities : (entity?.abilities ?? []),
      parent_id: isChar ? null : form.parent_id || null,
      ...(isChar
        ? {
            character_tier: form.character_tier || null,
            animation_style: form.animation_style || null,
            theme_color: form.theme_color || null,
            accent_glow: form.accent_glow || null,
            theme_song_url: form.theme_song_url || null,
            card_theme: form.card_theme || null,
          }
        : {}),
    };
    let error;
    if (entity) {
      const changed = FIELDS.filter((f) => JSON.stringify((entity as any)[f] ?? "") !== JSON.stringify((row as any)[f] ?? ""));
      ({ error } = await supabase.from("entities")
        .update({ ...row, locked_fields: mergeLocks(entity.locked_fields, changed), updated_at: new Date().toISOString() })
        .eq("id", entity.id));
    } else {
      ({ error } = await supabase.from("entities").insert({ ...row, locked_fields: [...FIELDS] }));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (entity) sfx.click(); else sfx.add();
    toast.success(entity ? "Saved" : "Created");
    qc.invalidateQueries({ queryKey: ["entities"] });
    qc.invalidateQueries({ queryKey: ["search-index"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{entity ? `Edit ${entity.name}` : "New entry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {allowedKinds.length > 1 && (
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm capitalize" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {allowedKinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-1.5"><Label>Name</Label><Input value={form.name} onChange={set("name")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{isChar ? "Alias / real name" : "Alias"}</Label><Input value={form.alias} onChange={set("alias")} /></div>
            <div className="grid gap-1.5"><Label>{isChar ? "Faction / role" : "Role"}</Label><Input value={form.role} onChange={set("role")} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Status</Label><Chips options={isChar ? CHARACTER_STATUSES : GROUP_STATUSES} value={form.status} onChange={(v) => setForm({ ...form, status: v || form.status })} /></div>
          <div className="grid gap-1.5">
            <Label>{isChar ? "Narrative role / sector" : "Group type / sector"}</Label>
            <Input
              list="entity-category-options"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={isChar ? "Protagonist, Anti-Hero, or custom tier…" : "Faction, Clan, or custom tier…"}
            />
            <datalist id="entity-category-options">
              {(existingCategories ?? []).map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          {!isChar && (
            <div className="grid gap-1.5">
              <Label>Parent organization (branch / sub-faction)</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              >
                <option value="">— None (top level) —</option>
                {(parentCandidates ?? [])
                  .filter((c) => c.id !== entity?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
                  ))}
              </select>
            </div>
          )}
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={5} value={form.description} onChange={set("description")} /></div>
          {isChar && (
            <div className="grid gap-3 rounded-xl border border-white/10 bg-secondary/30 p-4">
              <Label>Combat stats</Label>
              {COMBAT_STATS.map(({ key, label }) => (
                <div key={key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={combat[key]}
                    onChange={(e) => setCombat({ ...combat, [key]: Number(e.target.value) })}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-rose-500"
                    aria-label={label}
                  />
                  <span className="text-right font-mono text-xs text-foreground">{combat[key]}</span>
                </div>
              ))}
            </div>
          )}
          {isChar && (
            <AbilityPicker value={form.abilities} onChange={(abilities) => setForm({ ...form, abilities })} />
          )}
          {isChar && (
            <div className="grid gap-3 rounded-xl border border-white/10 bg-secondary/30 p-4">
              <Label>Character tier (admin)</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={form.character_tier}
                onChange={(e) => setForm({ ...form, character_tier: e.target.value })}
              >
                <option value="">— None —</option>
                {CHARACTER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Theme color</Label>
                  <Input type="color" value={form.theme_color || "#a855f7"} onChange={(e) => setForm({ ...form, theme_color: e.target.value })} className="h-9 p-1" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Accent glow</Label>
                  <Input type="color" value={form.accent_glow || "#a855f7"} onChange={(e) => setForm({ ...form, accent_glow: e.target.value })} className="h-9 p-1" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Card animation style</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.animation_style}
                  onChange={(e) => setForm({ ...form, animation_style: e.target.value })}
                >
                  {ANIMATION_STYLES.map((s) => <option key={s} value={s}>{ANIMATION_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Card live theme</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.card_theme}
                  onChange={(e) => setForm({ ...form, card_theme: e.target.value })}
                >
                  <option value="">Auto (from abilities)</option>
                  {CARD_THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Overrides the animated card/dossier background — pick the character's signature element.</p>
              </div>
              <div className="grid gap-1.5">
                <Label>Theme song</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.theme_song_url}
                    onChange={(e) => setForm({ ...form, theme_song_url: e.target.value })}
                    placeholder="https://…/theme.mp3"
                  />
                  <Input type="file" accept="audio/*" className="w-36 text-xs" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const dataUrl = await fileToDataUrl(file);
                      setForm((c) => ({ ...c, theme_song_url: dataUrl }));
                      toast.success(`Attached "${file.name}" as theme song.`);
                    } catch { toast.error("This audio file could not be processed."); }
                  }} />
                </div>
                <p className="text-xs text-muted-foreground">URL or upload an audio file — plays from the card &amp; dossier.</p>
              </div>
            </div>
          )}
          <div className="grid gap-1.5"><Label>{isChar ? "Additional stats (one per line, e.g. \"Rank: Warden\")" : "Stats (one per line, e.g. \"Power: 9\")"}</Label><Textarea rows={3} value={form.stats} onChange={set("stats")} /></div>
          <div className="grid gap-1.5">
            <Label>{isChar ? "Avatar" : "Emblem"}</Label>
            {form.image_url && <img src={form.image_url} alt="" loading="lazy" decoding="async" className="h-20 w-20 rounded-md object-cover" />}
            <div className="flex gap-2">
              <Input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const image_url = await fileToDataUrl(file);
                  setForm((current) => ({ ...current, image_url }));
                } catch { toast.error("This image could not be processed."); }
              }} />
              {form.image_url && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>}
            </div>
          </div>
          {isChar && (
            <div className="grid gap-2">
              <Label>Sketch gallery (angles, turnarounds, armor variants)</Label>
              <div className="flex flex-wrap gap-2">
                {form.sketches.map((s, i) => (
                  <div key={i} className="relative">
                    <img src={s} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-md object-cover" />
                    <button aria-label="Remove sketch" className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                      onClick={() => setForm({ ...form, sketches: form.sketches.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Paste image URL" value={sketchUrl} onChange={(e) => setSketchUrl(e.target.value)} />
                <Button variant="secondary" size="sm" disabled={!/^https?:\/\//.test(sketchUrl)} onClick={() => { setForm({ ...form, sketches: [...form.sketches, sketchUrl] }); setSketchUrl(""); }}>Add</Button>
              </div>
              <Input type="file" accept="image/*" multiple onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                try {
                  const urls: string[] = [];
                  for (const file of files) urls.push(await fileToDataUrl(file, 900));
                  setForm((f) => ({ ...f, sketches: [...f.sketches, ...urls] }));
                } catch { toast.error("This image could not be processed."); }
              }} />
            </div>
          )}
          {isChar && entity && (
            <div className="grid gap-2 rounded-xl border border-white/10 bg-secondary/30 p-4">
              <Label>Relationships &amp; lineage</Label>
              {(rels ?? []).length > 0 && (
                <ul className="grid gap-1">
                  {(rels ?? []).map((r) => {
                    const otherId = r.character_id_1 === entity.id ? r.character_id_2 : r.character_id_1;
                    const other = (charCandidates ?? []).find((c) => c.id === otherId);
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate">{other?.name ?? otherId.slice(0, 8)}</span>
                        <span className="text-muted-foreground">{RELATIONSHIP_LABELS[r.relationship_type] ?? r.relationship_type}</span>
                        <button aria-label="Remove relationship" className="text-muted-foreground hover:text-destructive" onClick={() => void removeRelationship(r.id)}><X className="h-3 w-3" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex gap-2">
                <select className="h-9 flex-1 rounded-md border bg-background px-2 text-xs" value={relTarget} onChange={(e) => setRelTarget(e.target.value)} aria-label="Related character">
                  <option value="">Link a character…</option>
                  {(charCandidates ?? []).filter((c) => c.id !== entity.id && !(rels ?? []).some((r) => r.character_id_1 === c.id || r.character_id_2 === c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select className="h-9 rounded-md border bg-background px-2 text-xs" value={relType} onChange={(e) => setRelType(e.target.value)} aria-label="Relationship type">
                  {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{RELATIONSHIP_LABELS[t]}</option>)}
                </select>
                <Button size="sm" variant="secondary" disabled={!relTarget} onClick={() => void addRelationship()}>Add</Button>
              </div>
            </div>
          )}
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
