import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UiToggles {
  showJourneyGraph: boolean;
  showArcRoles: boolean;
  showRosterRoles: boolean;
  showSeriesAppearances: boolean;
}

export const UI_TOGGLE_DEFAULTS: UiToggles = {
  showJourneyGraph: true,
  showArcRoles: true,
  showRosterRoles: true,
  showSeriesAppearances: true,
};

const KEY = "ui_toggles";

/** Public read of admin UI toggles — defaults ON when unset. */
export function useUiToggles(): UiToggles {
  const { data } = useQuery({
    queryKey: ["app-settings", KEY],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
      return { ...UI_TOGGLE_DEFAULTS, ...((data?.value as Partial<UiToggles>) ?? {}) };
    },
  });
  return data ?? UI_TOGGLE_DEFAULTS;
}
