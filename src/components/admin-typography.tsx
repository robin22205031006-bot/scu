import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useTypography } from "@/hooks/use-typography";
import {
  CURATED_FONTS,
  SECTION_KEYS,
  type CustomFont,
  type SectionKey,
  type TypographySettings,
} from "@/lib/typography";

const WEIGHTS = [300, 400, 500, 600, 700, 800];

function FontPicker({
  label, value, onChange, extra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  extra: string[];
}) {
  const options = Array.from(new Set([...CURATED_FONTS, ...extra])).sort();
  return (
    <label className="grid gap-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={options.includes(value) ? value : "__custom__"}
        onChange={(e) => {
          if (e.target.value !== "__custom__") onChange(e.target.value);
        }}
      >
        {!options.includes(value) && value && <option value="__custom__">{value} (custom)</option>}
        {options.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <Input
        placeholder="Or type any font family name"
        defaultValue={options.includes(value) ? "" : value}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v) onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v) onChange(v);
          }
        }}
        className="glass h-9 rounded-full text-xs"
      />
    </label>
  );
}

function ColorField({
  label, value, onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={value ?? "#e4e4e7"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background p-0.5"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`rounded-md border px-2 py-1 text-[10px] ${value ? "border-border text-muted-foreground" : "border-accent/50 text-accent"}`}
        >
          {value ? "Reset" : "Default"}
        </button>
      </span>
    </label>
  );
}

export function AdminTypography() {
  const qc = useQueryClient();
  const { settings, reload } = useTypography();
  const [draft, setDraft] = useState<TypographySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFontName, setNewFontName] = useState("");
  const [newFontUrl, setNewFontUrl] = useState("");

  const s = draft ?? settings;
  const set = (patch: Partial<TypographySettings>) => setDraft({ ...s, ...patch });
  const setSection = (key: SectionKey, patch: Partial<TypographySettings["sections"][SectionKey]>) =>
    set({ sections: { ...s.sections, [key]: { ...s.sections[key], ...patch } } });

  const customNames = s.customFonts.map((f) => f.name);

  const addFont = () => {
    const name = newFontName.trim();
    const url = newFontUrl.trim();
    if (!name || !url) return;
    set({ customFonts: [...s.customFonts, { name, url }] });
    setNewFontName("");
    setNewFontUrl("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ui_typography", value: s as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Typography settings saved — applied instantly.");
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
          <h2 className="flex items-center gap-2 text-2xl"><Type className="h-5 w-5 text-accent" />Typography &amp; Theme</h2>
          <p className="text-xs text-muted-foreground">Fonts, colors and sizing — applied live for every visitor.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save typography"}</Button>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <FontPicker label="Body font" value={s.bodyFont} onChange={(v) => set({ bodyFont: v })} extra={customNames} />
          <FontPicker label="Display / heading font" value={s.displayFont} onChange={(v) => set({ displayFont: v })} extra={customNames} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Base text scale ({Math.round(s.baseScale * 100)}%)</span>
            <input
              type="range" min={85} max={115} step={5}
              value={Math.round(s.baseScale * 100)}
              onChange={(e) => set({ baseScale: Number(e.target.value) / 100 })}
              className="accent-[var(--accent)]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Heading weight</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={s.headingWeight}
              onChange={(e) => set({ headingWeight: Number(e.target.value) })}
            >
              {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Custom font imports</p>
          {s.customFonts.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{f.name} — <span className="text-muted-foreground">{f.url}</span></span>
              <button aria-label={`Remove font ${f.name}`} onClick={() => set({ customFonts: s.customFonts.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Family name (e.g. My Font)" value={newFontName} onChange={(e) => setNewFontName(e.target.value)} className="glass h-9 rounded-full text-xs" />
            <Input placeholder="Stylesheet URL (Google Fonts / Fontshare link)" value={newFontUrl} onChange={(e) => setNewFontUrl(e.target.value)} className="glass h-9 rounded-full text-xs" />
            <Button size="sm" variant="secondary" onClick={addFont} disabled={!newFontName.trim() || !newFontUrl.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Per-section colors (optional overrides)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTION_KEYS.map(({ key, label }) => (
              <div key={key} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                <p className="text-xs font-medium">{label}</p>
                <div className="flex gap-4">
                  <ColorField label="Text" value={s.sections[key].text} onChange={(v) => setSection(key, { text: v })} />
                  <ColorField label="Accent" value={s.sections[key].accent} onChange={(v) => setSection(key, { accent: v })} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {draft && (
          <Button variant="secondary" size="sm" className="w-fit" onClick={() => setDraft(null)}>Discard changes</Button>
        )}
      </div>
    </section>
  );
}
