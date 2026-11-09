import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Entity } from "@/lib/entities";

export type Series = Tables<"series">;
export type SeriesCharacter = Tables<"series_characters">;

export const SERIES_STATUSES = ["Alive", "Dead", "Presumed Dead", "Missing", "Unknown"] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];

export const seriesStatusClass: Record<string, string> = {
  Alive: "text-status-alive",
  Dead: "text-status-dead",
  Missing: "text-status-legend",
  "Presumed Dead": "text-status-legend",
  Unknown: "text-status-neutral",
};

const missingTable = (error: { message?: string } | null) =>
  !!error && /series|schema cache|does not exist/i.test(error.message ?? "");

export const seriesQuery = queryOptions({
  queryKey: ["series"],
  staleTime: 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("series").select("*").order("title");
    if (error) {
      if (missingTable(error)) return [] as Series[];
      throw error;
    }
    return data;
  },
});

export const seriesByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["series", id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const seriesCharactersQuery = (seriesId: string) =>
  queryOptions({
    queryKey: ["series-characters", seriesId],
    enabled: !!seriesId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_characters")
        .select("*")
        .eq("series_id", seriesId)
        .order("created_at");
      if (error) {
        if (missingTable(error)) return [] as SeriesCharacter[];
        throw error;
      }
      return data;
    },
  });

/** All series a character appears in, with their per-series status. */
export const characterSeriesQuery = (characterId: string) =>
  queryOptions({
    queryKey: ["character-series", characterId],
    enabled: !!characterId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_characters")
        .select("*, series:series_id(id, title, cover_image_url)")
        .eq("character_id", characterId);
      if (error) {
        if (missingTable(error)) return [] as (SeriesCharacter & { series: Pick<Series, "id" | "title" | "cover_image_url"> | null })[];
        throw error;
      }
      return data as unknown as (SeriesCharacter & { series: Pick<Series, "id" | "title" | "cover_image_url"> | null })[];
    },
  });

/** Resolve the character entities referenced by a set of series_characters rows. */
export function seriesMembersQuery(rows: SeriesCharacter[] | undefined) {
  const ids = [...new Set((rows ?? []).map((r) => r.character_id))].sort();
  return queryOptions({
    queryKey: ["series-member-entities", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").in("id", ids);
      if (error) throw error;
      return (data ?? []) as Entity[];
    },
  });
}
