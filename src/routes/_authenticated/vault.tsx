import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { embedVaultTexts } from "@/lib/pdf-vault.functions";
import { chunkText } from "@/lib/pdf-chunks";
import { parsePdf } from "@/utils/pdfParser";
import { sfx } from "@/lib/scu-audio";
import { ListSkeleton } from "@/components/route-skeleton";
import type { Tables } from "@/integrations/supabase/types";

type PdfVaultDoc = Tables<"pdf_vault">;

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "PDF Vault — Sentinels Cinematic Universe" },
      { name: "description", content: "Scripts, lore books and documents from the SCU archive." },
      { property: "og:title", content: "PDF Vault — SCU" },
      { property: "og:description", content: "Scripts, lore books and documents from the SCU archive." },
    ],
  }),
  component: Vault,
});

const EMBED_BATCH = 20;

function Vault() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [downloadable, setDownloadable] = useState(true);
  const [busy, setBusy] = useState(false);

  // ---- RAG vault state ----
  const embed = useServerFn(embedVaultTexts);
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragProgress, setRagProgress] = useState("");
  const { data: ragDocs } = useQuery({
    queryKey: ["pdf-vault"],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pdf_vault").select("*").order("uploaded_at", { ascending: false });
      if (error) {
        if (/pdf_vault|schema cache|does not exist/i.test(error.message)) return [] as PdfVaultDoc[];
        throw error;
      }
      return data ?? [];
    },
  });

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("vault").upload(path, file, { contentType: file.type || "application/pdf" });
    if (up.error) { setBusy(false); toast.error(up.error.message); return; }
    const { error } = await supabase.from("vault_documents").insert({ title: title.trim() || file.name, file_path: path, is_public: isPublic, downloadable });
    setBusy(false);
    if (error) {
      await supabase.storage.from("vault").remove([path]);
      toast.error(error.message); return;
    }
    setFile(null); setTitle("");
    qc.invalidateQueries({ queryKey: ["vault"] });
    qc.invalidateQueries({ queryKey: ["search-index"] });
    toast.success("Uploaded");
  };

  /** Extract -> chunk -> embed -> store, so the AI Box can cite this PDF. */
  const indexForAi = async () => {
    if (!ragFile || ragBusy) return;
    setRagBusy(true);
    try {
      setRagProgress("Extracting text…");
      const text = await parsePdf(ragFile);
      const chunks = chunkText(text);
      if (!chunks.length) throw new Error("No usable text chunks found in this PDF.");

      const storagePath = `rag/${crypto.randomUUID()}-${ragFile.name.replace(/[^\w.-]/g, "_")}`;
      const { data: auth } = await supabase.auth.getUser();
      const { data: doc, error: docErr } = await supabase
        .from("pdf_vault")
        .insert({
          file_name: ragFile.name,
          storage_path: storagePath,
          uploaded_by: auth.user?.id ?? null,
          status: "processing",
          chunk_count: 0,
        })
        .select("id")
        .single();
      if (docErr || !doc) throw new Error(docErr?.message ?? "Could not register the document.");

      // Best-effort file archival into the existing vault bucket.
      const up = await supabase.storage.from("vault").upload(storagePath, ragFile, { contentType: "application/pdf" });
      if (up.error) console.warn("[pdf-vault] storage upload failed:", up.error.message);

      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        setRagProgress(`Embedding chunks ${i + 1}–${Math.min(i + EMBED_BATCH, chunks.length)} of ${chunks.length}…`);
        const { embeddings } = await embed({ data: { texts: batch } });
        const rows = batch.map((content_text, j) => ({
          pdf_id: doc.id,
          chunk_index: i + j,
          content_text,
          embedding: `[${(embeddings[j] ?? []).join(",")}]`,
        }));
        const { error: chunkErr } = await supabase.from("pdf_chunks").insert(rows);
        if (chunkErr) throw new Error(`Chunk insert failed: ${chunkErr.message}`);
      }

      await supabase.from("pdf_vault").update({ status: "ready", chunk_count: chunks.length }).eq("id", doc.id);
      sfx.add();
      toast.success(`Indexed ${ragFile.name} — ${chunks.length} chunks ready for the AI Box.`);
      setRagFile(null);
      qc.invalidateQueries({ queryKey: ["pdf-vault"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setRagBusy(false);
      setRagProgress("");
    }
  };

  const deleteRagDoc = async (d: PdfVaultDoc) => {
    await supabase.storage.from("vault").remove([d.storage_path]);
    const { error } = await supabase.from("pdf_vault").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      qc.invalidateQueries({ queryKey: ["pdf-vault"] });
    }
  };

  const open = async (path: string) => {
    const { data: s, error } = await supabase.storage.from("vault").createSignedUrl(path, 600);
    if (error || !s) { toast.error("This document isn't available for download."); return; }
    window.open(s.signedUrl, "_blank", "noopener");
  };

  const toggle = async (id: string, patch: { is_public?: boolean; downloadable?: boolean }) => {
    const { error } = await supabase.from("vault_documents").update(patch).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["vault"] });
  };

  const del = async (id: string, path: string) => {
    const removal = await supabase.storage.from("vault").remove([path]);
    if (removal.error) { toast.error(removal.error.message); return; }
    const { error } = await supabase.from("vault_documents").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["vault"] });
    qc.invalidateQueries({ queryKey: ["search-index"] });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-5">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archive</p>
        <h1 className="mt-2 text-5xl font-medium glow-text">PDF Vault</h1>
      </header>

      {isAdmin && (
        <section className="glass mb-8 grid gap-3 rounded-2xl p-5">
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <Label className="flex items-center gap-2"><Switch checked={isPublic} onCheckedChange={setIsPublic} />Visible to members</Label>
            <Label className="flex items-center gap-2"><Switch checked={downloadable} onCheckedChange={setDownloadable} />Downloadable</Label>
            <Button className="ml-auto" size="sm" disabled={!file || busy} onClick={upload}><Upload className="h-4 w-4" />{busy ? "Uploading…" : "Upload"}</Button>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="glass mb-8 rounded-2xl border border-accent/20 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <h2 className="text-lg font-medium">AI knowledge index</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Index a PDF for the AI Box: text is extracted, chunked, embedded, and cited as an official SCU source.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              className="max-w-xs"
              disabled={ragBusy}
              onChange={(e) => setRagFile(e.target.files?.[0] ?? null)}
            />
            <Button size="sm" disabled={!ragFile || ragBusy} onClick={() => void indexForAi()}>
              {ragBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {ragBusy ? "Indexing…" : "Index for AI"}
            </Button>
          </div>
          {ragProgress && <p className="mt-2 text-xs text-muted-foreground">{ragProgress}</p>}

          {(ragDocs?.length ?? 0) > 0 && (
            <ul className="mt-4 grid gap-2">
              {ragDocs!.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate">{d.file_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.status === "ready" ? `${d.chunk_count} chunks` : d.status}
                  </span>
                  <Button size="icon" variant="ghost" aria-label="Delete index" onClick={() => void deleteRagDoc(d)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isLoading ? <ListSkeleton /> : !data?.length ? (
        <p className="text-muted-foreground">No documents in the vault yet.</p>
      ) : (
        <ul className="grid gap-3">
          {data.map((d) => (
            <li key={d.id} className="glass flex items-center gap-3 rounded-xl p-4">
              <FileText className="h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                {isAdmin && <p className="text-xs text-muted-foreground">{d.is_public ? "Visible" : "Hidden"} · {d.downloadable ? "Downloadable" : "View locked"}</p>}
              </div>
              {isAdmin && (
                <>
                  <Switch aria-label="Visible" checked={d.is_public} onCheckedChange={(v) => toggle(d.id, { is_public: v })} />
                  <Switch aria-label="Downloadable" checked={d.downloadable} onCheckedChange={(v) => toggle(d.id, { downloadable: v })} />
                </>
              )}
              {(isAdmin || d.downloadable) && (
                <Button size="icon" variant="ghost" aria-label="Download" onClick={() => open(d.file_path)}><Download className="h-4 w-4" /></Button>
              )}
              {isAdmin && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del(d.id, d.file_path)}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
