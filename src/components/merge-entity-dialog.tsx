import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Entity } from "@/lib/entities";
import { sfx } from "@/lib/scu-audio";

interface Candidate {
  id: string;
  name: string;
  kind: Entity["kind"];
  alias: string | null;
  role: string | null;
  status: string;
  category: string | null;
}

/** Merge `entity` (secondary) into a chosen primary entity via the merge_entities RPC. */
export function MergeEntityDialog({
  open, onOpenChange, entity,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: Entity;
}) {
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["merge-candidates", entity.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("id, name, kind, alias, role, status, category")
        .neq("id", entity.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

  const { data: noteCounts } = useQuery({
    queryKey: ["merge-note-counts"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("lore_notes").select("entity_id");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const n of data ?? []) counts.set(n.entity_id, (counts.get(n.entity_id) ?? 0) + 1);
      return counts;
    },
  });

  const target = useMemo(() => (candidates ?? []).find((c) => c.id === targetId), [candidates, targetId]);

  useEffect(() => {
    if (open) setTargetId("");
  }, [open, entity.id]);

  const combinedAlias = [target?.alias, entity.alias].filter(Boolean).join(" · ");
  const combinedNotes = (noteCounts?.get(entity.id) ?? 0) + (targetId ? (noteCounts?.get(targetId) ?? 0) : 0);
  const kindDiffers = !!target && target.kind !== entity.kind;

  const confirm = async () => {
    if (!target) return;
    setMerging(true);
    try {
      // Re-point series appearances at the surviving entity first; the RPC's
      // cascade delete would otherwise drop them. No-op if the table/function
      // doesn't exist yet.
      const { error: remapError } = await supabase.rpc("remap_series_characters", {
        p_primary: target.id,
        p_secondary: entity.id,
      });
      if (remapError && !/remap_series_characters|does not exist|schema cache/i.test(remapError.message)) {
        throw remapError;
      }
      const { data, error } = await supabase.rpc("merge_entities", {
        primary_id: target.id,
        secondary_id: entity.id,
      });
      if (error) throw error;
      const moved = (data as { notes_moved?: number } | null)?.notes_moved ?? 0;
      sfx.merge();
      toast.success(`Merged "${entity.name}" into "${target.name}" — ${moved} lore note(s) transferred.`);
      qc.invalidateQueries({ queryKey: ["entities"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["search-index"] });
      qc.removeQueries({ queryKey: ["notes", entity.id] });
      onOpenChange(false);
    } catch (err) {
      console.error("MERGE ERROR DETAILS:", err);
      const detail =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Merge failed: ${detail}`);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <GitMerge className="h-5 w-5 text-accent" /> Merge {entity.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <p className="text-muted-foreground">
            {entity.name} will be merged <strong className="text-foreground">into</strong> the entry you pick.
            Its lore notes, sketches, stats, and aliases are preserved on the surviving entry, then {entity.name} is removed.
          </p>
          <div className="grid gap-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="merge-target">Surviving entry</label>
            <select
              id="merge-target"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select an entry…</option>
              {(candidates ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
              ))}
            </select>
          </div>
          {target && (
            <div className="grid gap-2 rounded-xl bg-secondary/50 p-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Merge preview</p>
              <dl className="grid gap-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Primary</dt>
                  <dd className="font-medium">{target.name} <span className="text-muted-foreground">({target.kind})</span></dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Merged away</dt>
                  <dd>{entity.name} <span className="text-muted-foreground">({entity.kind})</span></dd>
                </div>
                {combinedAlias && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Combined alias</dt>
                    <dd className="text-right">{combinedAlias}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Lore notes after merge</dt>
                  <dd>{combinedNotes}</dd>
                </div>
                {kindDiffers && (
                  <p className="text-xs text-amber-500">
                    Note: kinds differ ({entity.kind} → {target.kind}). The surviving entry keeps "{target.kind}".
                  </p>
                )}
              </dl>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={!target || merging}>
              {merging ? "Merging…" : "Confirm merge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
