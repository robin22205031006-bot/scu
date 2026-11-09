import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-admin";
import { analyzeLore, applyLore } from "@/lib/ingest.functions";
import { ingestAdminPdf } from "@/controllers/adminController.js";
import type { IngestStage } from "@/controllers/adminController.js";

export const Route = createFileRoute("/_authenticated/ingest")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Lore Ingest — SCU Admin" },
      { name: "description", content: "Upload story PDFs to update the SCU archive." },
      { property: "og:title", content: "Lore Ingest — SCU Admin" },
      { property: "og:description", content: "Upload story PDFs to update the SCU archive." },
    ],
  }),
  component: Ingest,
});

function Ingest() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeLore);
  const apply = useServerFn(applyLore);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<IngestStage>("idle");
  const [retry, setRetry] = useState(false);
  const running = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  if (!isAdmin) return <main className="mx-auto max-w-xl px-5 pt-32 text-sm text-muted-foreground">Only the admin can use this page.</main>;

  const run = async (selected: File) => {
    if (running.current) return;
    running.current = true;
    setFile(selected);
    setRetry(false);
    try {
      const r = await ingestAdminPdf(selected, {
        analyze,
        apply,
        onStage: setStage,
        refresh: () => Promise.all([
          qc.invalidateQueries({ queryKey: ["entities"] }),
          qc.invalidateQueries({ queryKey: ["notes"] }),
          qc.invalidateQueries({ queryKey: ["timeline"] }),
          qc.invalidateQueries({ queryKey: ["search-index"] }),
        ]),
      });
      toast.success(`Added ${r.created}, updated ${r.updated}, ${r.events} timeline events`);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The PDF could not be imported.");
      setRetry(true);
    } finally {
      running.current = false;
      setStage("idle");
      if (input.current) input.current.value = "";
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-28">
      <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Admin</p>
      <h1 className="mt-2 text-5xl font-medium">Lore Ingest</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a story PDF. Names and facts supported by the text are saved automatically. Pictures and fields you edited by hand are never overwritten.
      </p>

      <label className="mt-10 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed bg-card p-6">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <span className="flex-1 text-sm">{file ? file.name : "Choose a PDF"}</span>
        <input ref={input} type="file" accept="application/pdf,.pdf" aria-label="Choose a PDF" className="hidden" disabled={stage !== "idle"} onChange={(e) => { const selected = e.target.files?.[0]; if (selected) void run(selected); }} />
      </label>
      <Button className="mt-4" disabled={stage !== "idle"} onClick={() => { if (retry && file) void run(file); else input.current?.click(); }}>
        {stage === "reading" ? "Reading PDF…" : stage === "analyzing" ? "Analyzing lore…" : stage === "saving" ? "Saving…" : retry ? "Retry import" : "Upload PDF"}
      </Button>
    </main>
  );
}
