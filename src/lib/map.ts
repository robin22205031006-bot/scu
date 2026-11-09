import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MapLocation = Tables<"map_locations">;
export type Episode = Tables<"episodes">;

function isMissingTable(error: { message?: string } | null, table: string) {
  return !!error && new RegExp(`${table}|schema cache|does not exist`, "i").test(error.message ?? "");
}

/** All tactical map pins, ordered by name. */
export const mapLocationsQuery = queryOptions({
  queryKey: ["map-locations"],
  staleTime: 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("map_locations").select("*").order("name");
    if (error) {
      if (isMissingTable(error, "map_locations")) return [] as MapLocation[];
      throw error;
    }
    return data;
  },
});

/** Published episodes for public views. */
export const episodesQuery = queryOptions({
  queryKey: ["episodes", "published"],
  staleTime: 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("episodes")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error, "episodes")) return [] as Episode[];
      throw error;
    }
    return data;
  },
});

/** All episodes incl. drafts — staff only (RLS enforces). */
export const allEpisodesQuery = queryOptions({
  queryKey: ["episodes", "all"],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("episodes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      if (isMissingTable(error, "episodes")) return [] as Episode[];
      throw error;
    }
    return data;
  },
});

/** Parse the comma/newline-separated sentinel roster on a map pin. */
export function parseSentinels(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
