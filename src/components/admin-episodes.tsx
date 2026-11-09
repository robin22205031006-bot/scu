import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { allEpisodesQuery, type Episode } from "@/lib/map";
import { sfx } from "@/lib/scu-audio";

const DRAFT_KEY = "scu-episode-draft-v1";

interface LocalDraft {
  episodeId?: string | undefined;
  title: string;
  series: string;
  body: string;
  savedAt: number;
}

interface FormState {
  episodeId?: string | undefined;
  title: string;
  series: string;
  body: string;
  status: "draft" | "published";
}

const EMPTY: FormState = { title: "", series: "", body: "", status: "draft" };

function readLocalDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

/** Admin episode/chapter drafting studio with local autosave + Supabase publish. */
export function AdminEpisodes() {
  const qc = useQueryClient();
  const { data: episodes = [], isLoading } = useQuery(allEpisodesQuery);
  const [form, setForm] = useState<FormState | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Restore any unsaved local draft on mount.
  useEffect(() => {
    const d = readLocalDraft();
    if (d && (d.title || d.body)) {
      setForm({ episodeId: d.episodeId, title: d.title, series: d.series, body: d.body, status: "draft" });
      setLastSaved(d.savedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave to localStorage whenever the form changes.
  useEffect(() => {
    if (!form) return;
    const t = setTimeout(() => {
      const draft: LocalDraft = {
        episodeId: form.episodeId,
        title: form.title,
        series: form.series,
        body: form.body,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setLastSaved(draft.savedAt);
      } catch {
        /* storage full — ignore */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [form]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["episodes"] });

  const clearLocalDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setLastSaved(null);
  };

  const openNew = () => {
    setForm({ ...EMPTY });
    clearLocalDraft();
  };

  const openExisting = (ep: Episode) => {
    setForm({ episodeId: ep.id, title: ep.title, series: ep.series ?? "", body: ep.body, status: ep.status === "published" ? "published" : "draft" });
    clearLocalDraft();
  };

  const save = async (publish: boolean) => {
    if (!form || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      series: form.series.trim() || null,
      body: form.body,
      status: publish ? "published" : "draft",
      updated_at: new Date().toISOString(),
    };
    const { error } = form.episodeId
      ? await supabase.from("episodes").update(payload).eq("id", form.episodeId)
      : await supabase.from("episodes").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    sfx.add();
    toast.success(publish ? `Published "${payload.title}"` : `Saved draft "${payload.title}"`);
    clearLocalDraft();
    setForm(null);
    refresh();
  };

  const del = async (ep: Episode) => {
    const { error } = await supabase.from("episodes").delete().eq("id", ep.id);
    if (error) { toast.error(error.message); return; }
    sfx.remove();
    toast.success("Episode deleted");
    if (form?.episodeId === ep.id) { setForm(null); clearLocalDraft(); }
    refresh();
  };

  const drafts = useMemo(() => episodes.filter((e) => e.status !== "published"), [episodes]);
  const published = useMemo(() => episodes.filter((e) => e.status === "published"), [episodes]);

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Episode drafts</h2>
          <p className="text-xs text-muted-foreground">
            Markdown lore chapters — autosaves locally, publishes to the archive on demand.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus className="h-4 w-4" /> New draft
        </Button>
      </div>

      {form && (
        <div className="glass mb-5 grid gap-3 rounded-xl border border-accent/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">
              {form.episodeId ? "Editing" : "New draft"}
              {lastSaved ? ` · autosaved ${new Date(lastSaved).toLocaleTimeString()}` : ""}
            </p>
            <button aria-label="Close editor" onClick={() => setForm(null)} className="text-muted-foreground hover:text-foreground">
              ×
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Episode / chapter title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Series (optional)" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} />
          </div>
          <Textarea
            placeholder={"Write in Markdown…\n\n## Chapter heading\n- Bullet point\n**Bold** and *italic* work too."}
            rows={12}
            className="font-mono text-sm"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => void save(false)}>Save draft</Button>
            <Button size="sm" onClick={() => void save(true)}>
              <BookOpen className="h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : episodes.length === 0 && !form ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No episodes yet — draft your first chapter.</p>
      ) : (
        <ul className="grid gap-2">
          {[...drafts, ...published].map((ep) => (
            <li key={ep.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
              <FileText className={`h-4 w-4 shrink-0 ${ep.status === "published" ? "text-accent" : "text-muted-foreground"}`} />
              <span className="min-w-0 flex-1 truncate">
                {ep.title}
                {ep.series && <span className="ml-2 text-xs text-muted-foreground">{ep.series}</span>}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${ep.status === "published" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>
                {ep.status}
              </span>
              <button aria-label="Edit" onClick={() => openExisting(ep)} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button aria-label="Delete" onClick={() => void del(ep)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
