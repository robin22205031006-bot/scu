import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Entity = Tables<"entities">;
export type LoreNote = Tables<"lore_notes">;
export type TimelineEvent = Tables<"timeline_events">;
export type EntityMembership = Tables<"entity_memberships">;
export type EntityRelation = Tables<"entity_relations">;
export type CharacterRelationship = Tables<"character_relationships">;

/** Typed kinship/social bonds between two characters. */
export const RELATIONSHIP_TYPES = [
  "father_son", "mother_daughter", "parent_child",
  "brother_sister", "brother_brother", "sister_sister", "siblings",
  "lovers", "spouses", "best_friends", "rivals",
  "mentor_student", "ally", "enemy",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_LABELS: Record<string, string> = {
  father_son: "Father / Son",
  mother_daughter: "Mother / Daughter",
  parent_child: "Parent / Child",
  brother_sister: "Brother / Sister",
  brother_brother: "Brother / Brother",
  sister_sister: "Sister / Sister",
  siblings: "Siblings",
  lovers: "Lovers",
  spouses: "Spouses",
  best_friends: "Best Friends",
  rivals: "Rivals",
  mentor_student: "Mentor / Student",
  ally: "Allies",
  enemy: "Enemies",
};

/** Directed relation kinds used by the clan/lineage graph. */
export const REL_TYPES = ["commands", "ally", "rival", "mentor", "kin"] as const;
export type RelType = (typeof REL_TYPES)[number];

/** Kinds that can act as the "group" side of a membership link. */
export const GROUP_LINK_KINDS: Entity["kind"][] = ["organization", "clan", "bloodline", "faction"];

import { CHARACTER_CATEGORIES, GROUP_CATEGORIES } from "./lore-merge";

export const CHARACTER_STATUSES = ["Alive", "Dead", "Presumed Dead", "Retired", "Missing", "Legend"];
export const GROUP_STATUSES = ["Active", "Inactive"];
export { CHARACTER_CATEGORIES, GROUP_CATEGORIES };

export const entitiesQuery = (kinds: string[]) =>
  queryOptions({
    queryKey: ["entities", kinds],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .in("kind", kinds as Entity["kind"][])
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const entityByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["entity", id],
    enabled: !!id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Memberships where this entity is the character side. */
export const characterLinksQuery = (characterId: string) =>
  queryOptions({
    queryKey: ["entity-links", "character", characterId],
    enabled: !!characterId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entity_memberships").select("*").eq("character_id", characterId);
      if (error) {
        // Table may not exist yet if the SQL migration hasn't been applied.
        if (/entity_memberships|schema cache|does not exist/i.test(error.message)) return [] as EntityMembership[];
        throw error;
      }
      return data;
    },
  });

/** Memberships where this entity is the group side. */
export const groupLinksQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["entity-links", "group", groupId],
    enabled: !!groupId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entity_memberships").select("*").eq("group_id", groupId);
      if (error) {
        if (/entity_memberships|schema cache|does not exist/i.test(error.message)) return [] as EntityMembership[];
        throw error;
      }
      return data;
    },
  });

export const entityRelationsQuery = queryOptions({
  queryKey: ["entity-relations"],
  staleTime: 120_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("entity_relations").select("*");
    if (error) {
      if (/entity_relations|schema cache|does not exist/i.test(error.message)) return [] as EntityRelation[];
      throw error;
    }
    return data;
  },
});

/** All typed relationships touching an entity (either side). */
export const characterRelationshipsQuery = (entityId: string) =>
  queryOptions({
    queryKey: ["char-relationships", entityId],
    enabled: !!entityId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_relationships")
        .select("*")
        .or(`character_id_1.eq.${entityId},character_id_2.eq.${entityId}`);
      if (error) {
        if (/character_relationships|schema cache|does not exist/i.test(error.message)) return [] as CharacterRelationship[];
        throw error;
      }
      return data;
    },
  });

/** Branch entities whose parent_id points at this entity. */
export const childEntitiesQuery = (parentId: string) =>
  queryOptions({
    queryKey: ["entity-children", parentId],
    enabled: !!parentId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").eq("parent_id", parentId).order("name");
      if (error) {
        if (/parent_id|schema cache|does not exist/i.test(error.message)) return [] as Entity[];
        throw error;
      }
      return data;
    },
  });

export const notesQuery = (entityId: string) =>
  queryOptions({
    queryKey: ["notes", entityId],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lore_notes")
        .select("*")
        .eq("entity_id", entityId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const timelineQuery = queryOptions({
  queryKey: ["timeline"],
  staleTime: 300_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("timeline_events").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

/** Resize an image file to a small data URL so it can be stored with the entry. */
export async function fileToDataUrl(file: File, max = 640): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const context = c.getContext("2d");
    if (!context) throw new Error("This image could not be processed.");
    context.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    bmp.close();
  }
}

/** Case-insensitive match on name, alias, role or category. */
export function matchesSearch(e: Pick<Entity, "name" | "alias" | "role" | "category">, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [e.name, e.alias, e.role, e.category].some((v) => v?.toLowerCase().includes(s));
}
