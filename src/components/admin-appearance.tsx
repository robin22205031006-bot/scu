import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTypography } from "@/hooks/use-typography";
import { CARD_EFFECTS, UI_MODES, type TypographySettings } from "@/lib/typography";
import type { Json } from "@/integrations/supabase/types";

const FONT_SIZE_STEPS = 10;

/** Admin Appearance controls: card effects, radius, density, motion, focus, font scale. */
export function AdminAppearance() {
  const qc = useQueryClient();
  const { settings, reload } = useTypography();
  const [draft, setDraft] = useState<TypographySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const s = draft ?? settings;
  const set = (patch: Partial<TypographySettings>) => setDraft({ ...s, ...patch });

  // Map baseScale (0.8–1.5) onto 10 discrete steps for the UI.
  const scaleStep = Math.min(FONT_SIZE_STEPS - 1, Math.max(0, Math.round(((s.baseScale ?? 1) - 0.8) / 0.7 * (FONT_SIZE_STEPS - 1))));
  const setScaleStep = (i: number) => set({ baseScale: +(0.8 + (i / (FONT_SIZE_STEPS - 1)) * 0.7).toFixed(2) });

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ui_typography", value: s as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Appearance saved — applied instantly.");
      setDraft(null);
      reload();
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl"><SlidersHorizontal className="h-5 w-5 text-accent" />Appearance</h2>
          <p className="text-xs text-muted-foreground">Card effects, density, radius and text scaling — applied live.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save appearance"}</Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>Global UI/UX mode</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {UI_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => set({ uiMode: m.id })}
                className={`rounded-xl border p-3 text-left text-sm transition-all ${s.uiMode === m.id ? "border-accent bg-accent/10 glow-ring" : "border-border hover:border-accent/50"}`}
              >
                <span className="block font-medium">{m.label}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Card surface effect</Label>
          <select value={s.cardEffect ?? "glass"} onChange={(e) => set({ cardEffect: e.target.value as TypographySettings["cardEffect"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {CARD_EFFECTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Layout density</Label>
          <select value={s.density ?? "standard"} onChange={(e) => set({ density: e.target.value as TypographySettings["density"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize">
            <option value="relaxed">Relaxed</option>
            <option value="standard">Standard</option>
            <option value="tight">Tight</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Card corner radius — {s.cardRadius ?? 16}px</Label>
          <input type="range" min={4} max={16} value={s.cardRadius ?? 16} onChange={(e) => set({ cardRadius: Number(e.target.value) })} className="h-1.5 w-full accent-rose-500" />
        </div>
        <div className="grid gap-1.5">
          <Label>Font size — step {scaleStep + 1}/{FONT_SIZE_STEPS}</Label>
          <input type="range" min={0} max={FONT_SIZE_STEPS - 1} value={scaleStep} onChange={(e) => setScaleStep(Number(e.target.value))} className="h-1.5 w-full accent-rose-500" />
        </div>
        <div className="flex items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.smoothMotion !== false} onChange={(e) => set({ smoothMotion: e.target.checked })} className="accent-rose-500" />
            Smooth animations
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.boldFocus !== false} onChange={(e) => set({ boldFocus: e.target.checked })} className="accent-rose-500" />
            Bold focus rings
          </label>
        </div>
        {/* Display tuning HUD */}
        {([
          ["brightness", "Brightness"], ["contrast", "Contrast"], ["saturation", "Saturation"],
          ["hue", "Hue tint"], ["glow", "Glow intensity"],
        ] as const).map(([key, label]) => (
          <div key={key} className="grid gap-1.5">
            <Label>{label} — {key === "hue" ? `${s[key] ?? 0}°` : `${s[key] ?? 100}%`}</Label>
            <input
              type="range"
              min={key === "hue" ? -180 : 0}
              max={key === "hue" ? 180 : 200}
              value={s[key] ?? (key === "hue" ? 0 : 100)}
              onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<TypographySettings>)}
              className="h-1.5 w-full accent-rose-500"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
