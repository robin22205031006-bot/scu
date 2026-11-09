import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  characterLinksQuery,
  entitiesQuery,
  groupLinksQuery,
  GROUP_LINK_KINDS,
  matchesSearch,
  type Entity,
  type EntityMembership,
} from "@/lib/entities";
import { sfx } from "@/lib/scu-audio";

const MEMBERSHIP_STATUSES = ["Current", "Former"];

interface LinkedRow {
  membership: EntityMembership;
  entity: Entity;
}

/** Fetch the entities on the "other side" of a set of memberships. */
function useLinkedEntities(memberships: EntityMembership[] | undefined, otherKey: "character_id" | "group_id") {
  const ids = useMemo(() => [...new Set((memberships ?? []).map((m) => m[otherKey]))].sort(), [memberships, otherKey]);
  return useQuery({
    queryKey: ["entity-link-targets", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Admin dialog to link an existing entity to `entity` via entity_memberships. */
function LinkEntityDialog({
  open, onOpenChange, entity, linkedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: Entity;
  linkedIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const isCharacterSide = entity.kind === "character";

  const { data: candidates } = useQuery({
    ...entitiesQuery(isCharacterSide ? GROUP_LINK_KINDS : ["character"]),
    enabled: open,
  });

  const list = useMemo(
    () =>
      (candidates ?? []).filter(
        (c) => c.id !== entity.id && !linkedIds.has(c.id) && matchesSearch(c, q),
      ),
    [candidates, entity.id, linkedIds, q],
  );

  const link = async (target: Entity) => {
    setSaving(true);
    try {
      const entityIsCharacter = entity.kind === "character";
      const { error } = await supabase.from("entity_memberships").insert({
        character_id: entityIsCharacter ? entity.id : target.id,
        group_id: entityIsCharacter ? target.id : entity.id,
        status: "Current",
      });
      if (error) throw error;
      sfx.add();
      toast.success(`Linked ${target.name} to ${entity.name}`);
      qc.invalidateQueries({ queryKey: ["entity-links"] });
      onOpenChange(false);
    } catch (err) {
      const detail =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Link failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Link2 className="h-5 w-5 text-accent" />
            {isCharacterSide ? "Add organization / bloodline" : "Add character"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <p className="text-muted-foreground">
            Pick an existing {isCharacterSide ? "organization, clan, bloodline, or faction" : "character"} to link to {entity.name}.
          </p>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="glass h-10 rounded-full" />
          <div className="grid max-h-72 gap-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No matching entries.</p>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  disabled={saving}
                  onClick={() => link(c)}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.kind, c.category, c.status].filter(Boolean).join(" · ")}
                    </span>
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

/**
 * Bidirectional membership links shown inside an entity's dossier.
 * Characters see their groups (orgs/clans/bloodlines/factions); group-kind
 * entities see their characters. Names navigate to the linked dossier.
 */
export function EntityLinks({
  entity, isAdmin, onOpen,
}: {
  entity: Entity;
  isAdmin: boolean;
  onOpen: (e: Entity) => void;
}) {
  const qc = useQueryClient();
  const isCharacter = entity.kind === "character";
  const isGroup = GROUP_LINK_KINDS.includes(entity.kind);
  const [adding, setAdding] = useState(false);

  const charQuery = useQuery({ ...characterLinksQuery(entity.id), enabled: isCharacter });
  const groupQuery = useQuery({ ...groupLinksQuery(entity.id), enabled: isGroup && !isCharacter });
  const memberships = isCharacter ? charQuery.data : isGroup ? groupQuery.data : undefined;
  const otherKey = isCharacter ? "group_id" : "character_id";
  const { data: linkedEntities } = useLinkedEntities(memberships, otherKey);

  const rows: LinkedRow[] = useMemo(() => {
    const byId = new Map((linkedEntities ?? []).map((e) => [e.id, e]));
    return (memberships ?? [])
      .map((m) => ({ membership: m, entity: byId.get(m[otherKey]) }))
      .filter((r): r is LinkedRow => !!r.entity);
  }, [memberships, linkedEntities, otherKey]);

  const linkedIds = useMemo(() => new Set(rows.map((r) => r.entity.id)), [rows]);

  const updateStatus = async (m: EntityMembership, status: string) => {
    const { error } = await supabase.from("entity_memberships").update({ status }).eq("id", m.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["entity-links"] });
  };

  const remove = async (m: EntityMembership) => {
    const { error } = await supabase.from("entity_memberships").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      toast.success("Link removed");
      qc.invalidateQueries({ queryKey: ["entity-links"] });
    }
  };

  if (!isCharacter && !isGroup) return null;

  const statusOptions = (current: string) =>
    MEMBERSHIP_STATUSES.includes(current) ? MEMBERSHIP_STATUSES : [current, ...MEMBERSHIP_STATUSES];

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {isCharacter ? "Affiliations" : "Members"}
        </h4>
        {isAdmin && (
          <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            {isCharacter ? "Add organization / bloodline" : "Add character"}
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No links yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map(({ membership: m, entity: linked }) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2">
              <button
                onClick={() => onOpen(linked)}
                className="min-w-0 flex-1 text-left hover:text-accent"
              >
                <span className="block truncate font-medium">{linked.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {linked.kind}
                  {linked.category ? ` · ${linked.category}` : ""}
                </span>
              </button>
              {isAdmin ? (
                <select
                  value={m.status}
                  onChange={(e) => updateStatus(m, e.target.value)}
                  className="h-7 rounded-md border bg-background px-1.5 text-xs"
                  aria-label={`Membership status for ${linked.name}`}
                >
                  {statusOptions(m.status).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{m.status}</span>
              )}
              {isAdmin && (
                <button
                  aria-label={`Remove link to ${linked.name}`}
                  onClick={() => remove(m)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && (
        <LinkEntityDialog
          open={adding}
          onOpenChange={setAdding}
          entity={entity}
          linkedIds={linkedIds}
        />
      )}
    </div>
  );
}
