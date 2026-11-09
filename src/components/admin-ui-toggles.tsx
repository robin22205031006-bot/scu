import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { UI_TOGGLE_DEFAULTS, type UiToggles } from "@/lib/ui-toggles";
import type { Json } from "@/integrations/supabase/types";

const LABELS: Array<{ key: keyof UiToggles; label: string; hint: string }> = [
  { key: "showJourneyGraph", label: "Journey graphs", hint: "Trajectory bars + compare mode in dossiers" },
  { key: "showArcRoles", label: "Arc role badges", hint: "Lead/Antagonist/etc pills on series chips" },
  { key: "showRosterRoles", label: "Roster role tiers", hint: "Role categorization on series rosters" },
  { key: "showSeriesAppearances", label: "Series appearances", hint: "Series chip block in dossier Bonds tab" },
];

/** Admin panel: global visibility toggles for reader-facing dossier sections. */
export function AdminUiToggles() {
  const qc = useQueryClient();
  const [t, setT] = useState<UiToggles>(UI_TOGGLE_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from("app_settings").select("value").eq("key", "ui_toggles").maybeSingle().then(({ data }) => {
      if (data?.value) setT({ ...UI_TOGGLE_DEFAULTS, ...(data.value as Partial<UiToggles>) });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: "ui_toggles", value: t as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("UI toggles saved.");
      void qc.invalidateQueries({ queryKey: ["app-settings", "ui_toggles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save toggles.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Reader UI toggles</h2>
          <p className="text-xs text-muted-foreground">Globally show or hide dossier sections for all readers.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save toggles"}</Button>
      </div>
      <ul className="grid gap-2">
        {LABELS.map(({ key, label, hint }) => (
          <li key={key} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-rose-500"
              checked={t[key]}
              onChange={(e) => setT({ ...t, [key]: e.target.checked })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
