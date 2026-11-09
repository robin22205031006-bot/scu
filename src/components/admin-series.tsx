import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { entitiesQuery, fileToDataUrl, matchesSearch, type Entity } from "@/lib/entities";
import { SERIES_STATUSES, seriesCharactersQuery, seriesMembersQuery, seriesQuery, seriesStatusClass, type Series, type SeriesCharacter } from "@/lib/series";
import { CARD_THEMES } from "./ability-canvas";
import { sfx } from "@/lib/scu-audio";

interface SeriesForm {
  title: string;
  description: string;
  cover_image_url: string;
  genres: string[];
  season_count: string;
  season_names: string;
  timeline_note: string;
}

const GENRE_PRESETS = [
  "Superhero", "Dark Superhero", "Sci-Fi", "Cyberpunk", "Thriller", "Drama", "Action",
  "Horror", "Dark Fantasy", "Dark Mythic", "Mythical", "Mystery", "Fantasy", "Noir",
  "Mecha", "Urban Fantasy", "Post-Apocalyptic", "Dystopian", "Psychological", "Crime",
  "Supernatural", "Occult", "Martial Arts", "Espionage", "Military", "Survival",
];
const ROLE_SUGGESTIONS = ["Lead", "Antagonist", "Protagonist", "Debut", "Supporting", "Anti-hero", "Mentor", "Victim", "Survivor"];

const EMPTY_FORM: SeriesForm = { title: "", description: "", cover_image_url: "", genres: [], season_count: "", season_names: "", timeline_note: "" };
const toForm = (s: Series): SeriesForm => ({
  title: s.title,
  description: s.description,
  cover_image_url: s.cover_image_url ?? "",
  genres: s.genres ?? [],
  season_count: s.season_count?.toString() ?? "",
  season_names: (s.season_names ?? []).join(", "),
  timeline_note: s.timeline_note ?? "",
});

function SeriesFormDialog({
  open, onOpenChange, series,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  series: Series | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SeriesForm>(() => (series ? toForm(series) : EMPTY_FORM));
  const [genreDraft, setGenreDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const seasonCount = form.season_count.trim() ? Math.max(0, parseInt(form.season_count, 10) || 0) : null;
      const payload = {
        title: form.title.trim(),
        description: form.description,
        cover_image_url: form.cover_image_url || null,
        genres: form.genres,
        season_count: seasonCount,
        season_names: form.season_names.split(",").map((s) => s.trim()).filter(Boolean),
        timeline_note: form.timeline_note.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = series
        ? await supabase.from("series").update(payload).eq("id", series.id)
        : await supabase.from("series").insert(payload);
      if (error) throw error;
      sfx.add();
      toast.success(series ? "Series updated" : "Series created");
      qc.invalidateQueries({ queryKey: ["series"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The series could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <BookMarked className="h-5 w-5 text-accent" />
            {series ? `Edit ${series.title}` : "New series"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <Input placeholder="Series title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass h-10 rounded-full" />
          <Textarea placeholder="Description / arc summary" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="glass rounded-xl" />
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Genres</Label>
            <div className="flex flex-wrap gap-1.5">
              {[...GENRE_PRESETS, ...form.genres.filter((g) => !GENRE_PRESETS.includes(g))].map((g) => {
                const on = form.genres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, genres: on ? f.genres.filter((x) => x !== g) : [...f.genres, g] }))}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent/15 text-accent" : "text-muted-foreground hover:border-foreground/40"}`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom genre…"
                value={genreDraft}
                onChange={(e) => setGenreDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && genreDraft.trim()) {
                    e.preventDefault();
                    const g = genreDraft.trim();
                    if (!form.genres.includes(g)) setForm((f) => ({ ...f, genres: [...f.genres, g] }));
                    setGenreDraft("");
                  }
                }}
                className="glass h-8 rounded-full text-xs"
              />
              <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => {
                const g = genreDraft.trim();
                if (g && !form.genres.includes(g)) setForm((f) => ({ ...f, genres: [...f.genres, g] }));
                setGenreDraft("");
              }}>Add</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Seasons</Label>
              <Input type="number" min={0} placeholder="e.g. 5" value={form.season_count} onChange={(e) => setForm({ ...form, season_count: e.target.value })} className="glass h-9 rounded-full text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Season names</Label>
              <Input placeholder="comma-separated" value={form.season_names} onChange={(e) => setForm({ ...form, season_names: e.target.value })} className="glass h-9 rounded-full text-xs" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Timeline note</Label>
            <Textarea placeholder="Where this arc sits in the SCU timeline…" value={form.timeline_note} onChange={(e) => setForm({ ...form, timeline_note: e.target.value })} rows={2} className="glass rounded-xl text-xs" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Cover image</label>
            <div className="flex items-center gap-3">
              {form.cover_image_url && <img src={form.cover_image_url} alt="" loading="lazy" decoding="async" className="h-14 w-14 rounded-lg object-cover" />}
              <Input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setForm((f) => ({ ...f, cover_image_url: URL.createObjectURL(file) }));
                    const dataUrl = await fileToDataUrl(file, 800);
                    setForm((f) => ({ ...f, cover_image_url: dataUrl }));
                  } catch {
                    toast.error("That image could not be processed.");
                  }
                }}
              />
            </div>
            <Input placeholder="…or paste an image URL" value={form.cover_image_url.startsWith("blob:") ? "" : form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} className="glass h-9 rounded-full text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.title.trim() || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCharacterDialog({
  open, onOpenChange, series, linkedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  series: Series;
  linkedIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: candidates } = useQuery({ ...entitiesQuery(["character"]), enabled: open });
  const list = useMemo(
    () => (candidates ?? []).filter((c) => !linkedIds.has(c.id) && matchesSearch(c, q)),
    [candidates, linkedIds, q],
  );

  const add = async (c: Entity) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("series_characters").insert({
        series_id: series.id,
        character_id: c.id,
        status: "Unknown",
      });
      if (error) throw error;
      sfx.add();
      toast.success(`Added ${c.name} to ${series.title}`);
      qc.invalidateQueries({ queryKey: ["series-characters", series.id] });
      qc.invalidateQueries({ queryKey: ["character-series"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the character.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Users className="h-5 w-5 text-accent" /> Add character to {series.title}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters…" className="glass h-10 rounded-full" />
          <div className="grid max-h-72 gap-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No matching characters.</p>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  disabled={saving}
                  onClick={() => add(c)}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[c.category, c.status].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-accent" />
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SeriesMembers({ series }: { series: Series }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: rows } = useQuery(seriesCharactersQuery(series.id));
  const { data: members } = useQuery(seriesMembersQuery(rows));
  const byId = useMemo(() => new Map((members ?? []).map((e) => [e.id, e])), [members]);
  const linkedIds = useMemo(() => new Set((rows ?? []).map((r) => r.character_id)), [rows]);

  const update = async (row: SeriesCharacter, patch: Partial<SeriesCharacter>) => {
    const { error } = await supabase.from("series_characters").update(patch).eq("id", row.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["series-characters", series.id] });
  };

  const remove = async (row: SeriesCharacter) => {
    const { error } = await supabase.from("series_characters").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      qc.invalidateQueries({ queryKey: ["series-characters", series.id] });
      qc.invalidateQueries({ queryKey: ["character-series"] });
    }
  };

  const sorted = useMemo(
    () => [...(rows ?? [])].sort((a, b) => (byId.get(a.character_id)?.name ?? "").localeCompare(byId.get(b.character_id)?.name ?? "")),
    [rows, byId],
  );

  return (
    <div className="mt-3 grid gap-2 rounded-xl bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{sorted.length} character{sorted.length === 1 ? "" : "s"}</p>
        <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add character
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No characters assigned.</p>
      ) : (
        sorted.map((row) => {
          const c = byId.get(row.character_id);
          if (!c) return null;
          const statusOptions = SERIES_STATUSES.includes(row.status as (typeof SERIES_STATUSES)[number])
            ? [...SERIES_STATUSES]
            : [row.status, ...SERIES_STATUSES];
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-background/40 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
              <select
                value={row.status}
                onChange={(e) => update(row, { status: e.target.value })}
                className={`h-7 rounded-md border bg-background px-1.5 text-xs ${seriesStatusClass[row.status] ?? ""}`}
                aria-label={`Status of ${c.name} in ${series.title}`}
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={row.arc_role ?? ""}
                onChange={(e) => update(row, { arc_role: e.target.value || null })}
                className="h-7 rounded-md border bg-background px-1.5 text-xs"
                aria-label={`Arc role of ${c.name} in ${series.title}`}
                title="Arc role"
              >
                <option value="">Arc role…</option>
                {["Lead protagonist", "Protagonist", "Main antagonist", "Antagonist", "Anti-hero", "Support", "Legend", "Cameo"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={row.card_theme ?? ""}
                onChange={(e) => update(row, { card_theme: e.target.value || null })}
                className="h-7 rounded-md border bg-background px-1.5 text-xs"
                aria-label={`Card theme of ${c.name} in ${series.title}`}
                title="Live card theme for this season"
              >
                <option value="">Auto theme</option>
                {CARD_THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <Input
                placeholder="Role / arc note"
                list={`series-roles-${series.id}`}
                defaultValue={row.role_in_series ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (row.role_in_series ?? "")) update(row, { role_in_series: v || null });
                }}
                className="glass h-7 w-40 rounded-md px-2 text-xs"
              />
              <datalist id={`series-roles-${series.id}`}>
                {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
              <button aria-label={`Remove ${c.name} from ${series.title}`} onClick={() => remove(row)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
      {adding && <AddCharacterDialog open={adding} onOpenChange={setAdding} series={series} linkedIds={linkedIds} />}
    </div>
  );
}

export function AdminSeries() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Series | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Series | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: series } = useQuery(seriesQuery);

  const doDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("series").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      toast.success(`${deleting.title} deleted`);
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["series-characters"] });
      qc.invalidateQueries({ queryKey: ["character-series"] });
    }
    setDeleting(null);
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Series</h2>
          <p className="text-xs text-muted-foreground">Story arcs and per-series character statuses.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />New series</Button>
      </div>
      {(series ?? []).length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No series yet.</p>
      ) : (
        <ul className="grid gap-2">
          {(series ?? []).map((s) => (
            <li key={s.id} className="rounded-xl bg-secondary/40 px-3 py-2">
              <div className="flex items-center gap-3">
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {s.cover_image_url ? (
                    <img src={s.cover_image_url} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60 text-muted-foreground"><BookMarked className="h-4 w-4" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    {s.description && <span className="block truncate text-xs text-muted-foreground">{s.description}</span>}
                  </span>
                </button>
                <Button size="icon" variant="ghost" className="h-8 w-8 active:scale-90" aria-label={`Edit ${s.title}`} onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive active:scale-90" aria-label={`Delete ${s.title}`} onClick={() => setDeleting(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {expanded === s.id && <SeriesMembers series={s} />}
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <SeriesFormDialog key={editing?.id ?? "new"} open onOpenChange={(o) => !o && setEditing(undefined)} series={editing} />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the series and all character assignments in it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
