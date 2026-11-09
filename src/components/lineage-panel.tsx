import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  childEntitiesQuery,
  characterRelationshipsQuery,
  entityByIdQuery,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type CharacterRelationship,
  type Entity,
} from "@/lib/entities";
import { sfx } from "@/lib/scu-audio";

function useRelatedEntities(rels: CharacterRelationship[] | undefined, selfId: string) {
  const ids = useMemo(
    () => [...new Set((rels ?? []).map((r) => (r.character_id_1 === selfId ? r.character_id_2 : r.character_id_1)))].sort(),
    [rels, selfId],
  );
  return useQuery({
    queryKey: ["rel-targets", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Dossier panel: typed relationships grouped by tag, with quick links. */
export function CharacterRelationships({
  entity, isAdmin, onOpen,
}: {
  entity: Entity;
  isAdmin: boolean;
  onOpen: (e: Entity) => void;
}) {
  const qc = useQueryClient();
  const { data: rels } = useQuery(characterRelationshipsQuery(entity.id));
  const { data: targets } = useRelatedEntities(rels, entity.id);

  const rows = useMemo(() => {
    const byId = new Map((targets ?? []).map((t) => [t.id, t]));
    return (rels ?? [])
      .map((r) => {
        const otherId = r.character_id_1 === entity.id ? r.character_id_2 : r.character_id_1;
        const other = byId.get(otherId);
        return other ? { rel: r, other } : null;
      })
      .filter((x): x is { rel: CharacterRelationship; other: Entity } => !!x);
  }, [rels, targets, entity.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, { rel: CharacterRelationship; other: Entity }[]>();
    for (const r of rows) {
      const k = RELATIONSHIP_LABELS[r.rel.relationship_type] ?? r.rel.relationship_type;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const remove = async (rel: CharacterRelationship) => {
    const { error } = await supabase.from("character_relationships").delete().eq("id", rel.id);
    if (error) toast.error(error.message);
    else {
      sfx.remove();
      qc.invalidateQueries({ queryKey: ["char-relationships"] });
    }
  };

  if (!rels?.length) return null;

  return (
    <div className="grid gap-3">
      <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Relationships &amp; lineage
      </h4>
      {grouped.map(([label, items]) => (
        <div key={label}>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-accent">{label}</p>
          <div className="grid gap-1.5">
            {items.map(({ rel, other }) => (
              <div key={rel.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                <button onClick={() => onOpen(other)} className="min-w-0 flex-1 text-left hover:text-accent">
                  <span className="block truncate font-medium">{other.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[other.kind, other.status].filter(Boolean).join(" · ")}</span>
                </button>
                {isAdmin && (
                  <button
                    aria-label={`Remove relationship with ${other.name}`}
                    onClick={() => void remove(rel)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dossier panel: parent org + branch sub-organizations. */
export function OrgHierarchy({ entity, onOpen }: { entity: Entity; onOpen: (e: Entity) => void }) {
  const { data: parent } = useQuery({ ...entityByIdQuery(entity.parent_id ?? ""), enabled: !!entity.parent_id });
  const { data: children } = useQuery(childEntitiesQuery(entity.id));

  if (!entity.parent_id && !(children?.length)) return null;

  return (
    <div className="grid gap-3">
      <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" /> Organizational hierarchy
      </h4>
      {parent && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Parent organization</p>
          <button onClick={() => onOpen(parent)} className="rounded-xl bg-secondary/40 px-3 py-2 text-left hover:text-accent">
            <span className="block truncate font-medium">{parent.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{parent.kind}</span>
          </button>
        </div>
      )}
      {(children?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Sub-branches ({children!.length})</p>
          <div className="grid gap-1.5">
            {children!.map((c) => (
              <button key={c.id} onClick={() => onOpen(c)} className="rounded-xl bg-secondary/40 px-3 py-2 text-left hover:text-accent">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[c.kind, c.status].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { RELATIONSHIP_TYPES };
