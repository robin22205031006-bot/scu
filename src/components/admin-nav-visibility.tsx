import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TABS } from "@/lib/nav";
import type { Json } from "@/integrations/supabase/types";

const KEY = "nav_visibility";

/** Admin control: toggle visibility of each main nav tab (stored in app_settings). */
export function AdminNavVisibility() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["app-settings", KEY],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
      if (error) {
        if (/app_settings|schema cache|does not exist/i.test(error.message)) return {} as Record<string, boolean>;
        throw error;
      }
      return (data?.value ?? {}) as Record<string, boolean>;
    },
  });
  const hidden = data ?? {};
  const [saving, setSaving] = useState(false);

  const toggle = async (to: string) => {
    const next = { ...hidden, [to]: !(hidden[to] ?? true) };
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: next as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      qc.setQueryData(["app-settings", KEY], next);
      toast.success(`"${TABS.find((t) => t.to === to)?.label ?? to}" ${next[to] ? "shown" : "hidden"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-2xl">Navigation visibility</h2>
      <p className="mt-1 text-xs text-muted-foreground">Turn main tabs on or off for every visitor. Admin tab is never hidden.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const visible = hidden[t.to] ?? true;
          return (
            <button
              key={t.to}
              disabled={saving}
              onClick={() => void toggle(t.to)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${visible ? "border-accent/50 text-foreground" : "border-border text-muted-foreground opacity-50"}`}
            >
              {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {t.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
