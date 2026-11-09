import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  applyTypography,
  DEFAULT_TYPOGRAPHY,
  sectionStyleVars,
  type SectionKey,
  type TypographySettings,
} from "@/lib/typography";

const SETTINGS_KEY = "ui_typography";

interface TypographyCtx {
  settings: TypographySettings;
  /** Refetch settings from app_settings (call after admin saves). */
  reload: () => void;
}

const Ctx = createContext<TypographyCtx | null>(null);

function normalize(raw: unknown): TypographySettings {
  const r = (raw ?? {}) as Partial<TypographySettings>;
  return {
    ...DEFAULT_TYPOGRAPHY,
    ...r,
    customFonts: Array.isArray(r.customFonts) ? r.customFonts : [],
    sections: { ...DEFAULT_TYPOGRAPHY.sections, ...(r.sections ?? {}) },
  };
}

export function TypographyProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["app-settings", SETTINGS_KEY],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (error) {
        // Table may not exist until the SQL migration is applied.
        if (/app_settings|schema cache|does not exist/i.test(error.message)) return DEFAULT_TYPOGRAPHY;
        throw error;
      }
      return normalize(data?.value);
    },
  });

  const settings = data ?? DEFAULT_TYPOGRAPHY;

  useEffect(() => {
    applyTypography(settings);
  }, [settings]);

  return (
    <Ctx.Provider value={{ settings, reload: () => qc.invalidateQueries({ queryKey: ["app-settings"] }) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTypography(): TypographyCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTypography outside provider");
  return v;
}

/** Inline CSS vars that re-theme a whole archive view (Characters/Orgs/Series/Timeline). */
export function useSectionStyle(view?: SectionKey): CSSProperties {
  const { settings } = useTypography();
  return (view ? sectionStyleVars(settings, view) : {}) as CSSProperties;
}
