import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ambientPlaying, ambientStart, ambientStop } from "@/lib/scu-audio";
import { useAppearance } from "@/hooks/use-appearance";
import { sfx } from "@/lib/scu-audio";

export const Route = createFileRoute("/_authenticated/story")({
  validateSearch: (s: Record<string, unknown>): { ep?: string } =>
    typeof s["ep"] === "string" ? { ep: s["ep"] } : {},
  head: () => ({ meta: [{ title: "Story — SCU" }] }),
  component: Story,
});

function Story() {
  const { ep } = Route.useSearch();
  const { zoom, scaleIndex } = useAppearance();
  const [eyeCare, setEyeCare] = useState(() => localStorage.getItem("scu-story-eyecare") === "1");
  const [ambient, setAmbient] = useState(false);

  const { data: episodes } = useQuery({
    queryKey: ["episodes-public"],
    queryFn: async () => {
      const { data } = await supabase.from("episodes").select("id,title,series,status").eq("status", "published").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: story } = useQuery({
    queryKey: ["episode", ep],
    enabled: !!ep,
    queryFn: async () => {
      const { data } = await supabase.from("episodes").select("*").eq("id", ep!).maybeSingle();
      return data;
    },
  });

  // Content protection: block copy/cut/context menu while reading.
  useEffect(() => {
    if (!ep) return;
    const block = (e: Event) => e.preventDefault();
    const ctx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", ctx);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", ctx);
    };
  }, [ep]);

  const toggleAmbient = () => {
    if (ambientPlaying() || ambient) { ambientStop(); setAmbient(false); }
    else { ambientStart(); setAmbient(true); }
  };

  const toggleEyeCare = () => {
    setEyeCare((v) => {
      localStorage.setItem("scu-story-eyecare", v ? "0" : "1");
      return !v;
    });
  };

  // Render markdown-ish body: paragraphs + ## headings.
  const blocks = useMemo(() => {
    if (!story?.body) return [];
    return story.body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  }, [story?.body]);

  if (ep && story) {
    return (
      <div
        className={`min-h-screen select-none ${eyeCare ? "bg-[#141210] text-[#e8ddc8]" : "bg-black text-foreground"}`}
        style={{ fontSize: `${zoom}%` }}
        onCopy={(e) => e.preventDefault()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-2 backdrop-blur">
          <Link to="/story" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Library</Link>
          <div className="flex items-center gap-1">
            <button onClick={() => { zoom(-1); }} className="rounded-full border p-1.5" aria-label="Smaller text"><Minus className="h-3.5 w-3.5" /></button>
            <button onClick={() => { zoom(1); }} className="rounded-full border p-1.5" aria-label="Larger text"><Plus className="h-3.5 w-3.5" /></button>
            <button onClick={toggleEyeCare} className={`rounded-full border px-2.5 py-1 text-xs ${eyeCare ? "border-accent text-accent" : "text-muted-foreground"}`}>Eye care</button>
            <button onClick={toggleAmbient} className="rounded-full border p-1.5" aria-label="Ambient sound">{ambient ? <Volume2 className="h-3.5 w-3.5 text-accent" /> : <VolumeX className="h-3.5 w-3.5" />}</button>
          </div>
        </div>
        <article className="mx-auto max-w-2xl px-6 py-10">
          {story.series && <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">{story.series}</p>}
          <h1 className="font-display text-4xl font-bold">{story.title}</h1>
          <div className="mt-8 space-y-5 leading-relaxed">
            {blocks.map((b, i) =>
              b.startsWith("## ") ? (
                <h2 key={i} className="pt-4 font-display text-2xl">{b.slice(3)}</h2>
              ) : b.startsWith("# ") ? (
                <h2 key={i} className="pt-4 font-display text-3xl">{b.slice(2)}</h2>
              ) : (
                <p key={i} className="whitespace-pre-line">{b}</p>
              ),
            )}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 font-display text-4xl"><BookOpen className="h-7 w-7 text-accent" /> Story</h1>
      <p className="mt-1 text-sm text-muted-foreground">Official SCU epics and published stories.</p>
      <ul className="mt-6 grid gap-2">
        {(episodes ?? []).map((e) => (
          <li key={e.id}>
            <Link
              to="/story"
              search={{ ep: e.id }}
              onClick={() => sfx.whoosh()}
              className="glass flex items-center justify-between rounded-2xl px-4 py-3 transition hover:border-accent/50"
            >
              <span>
                <span className="block font-medium">{e.title}</span>
                {e.series && <span className="text-xs text-muted-foreground">{e.series}</span>}
              </span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{e.status}</span>
            </Link>
          </li>
        ))}
        {(episodes ?? []).length === 0 && <li className="text-sm text-muted-foreground">No published stories yet.</li>}
      </ul>
    </div>
  );
}
