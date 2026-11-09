import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { sfx, ambientStart, ambientStop, ambientPlaying, setAudioFiles, playAudioFile } from "@/lib/scu-audio";
import type { Json } from "@/integrations/supabase/types";

const KEY = "audio_settings";
const MAX_FILE = 1_400_000; // ~1.4MB data-URL budget per clip

interface AudioSettings {
  masterVolume: number; // 0-100
  ambientEnabled: boolean;
  sfxEnabled: boolean;
  /** Uploaded audio clips as data URLs: welcome, ambient, sfx:<name>. */
  files?: Record<string, string>;
}

const DEFAULTS: AudioSettings = { masterVolume: 70, ambientEnabled: true, sfxEnabled: true, files: {} };

const SFX_SLOTS = ["click", "pop", "whoosh", "add", "remove", "merge", "angel", "mythic", "hud", "comic"] as const;
const MUSIC_SLOTS = [
  { key: "welcome", label: "Welcome track (after login)" },
  { key: "ambient", label: "Ambient bed override" },
] as const;

function FileSlot({ slotKey, label, value, onPick, onClear }: {
  slotKey: string; label: string; value: string | undefined;
  onPick: (dataUrl: string) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > MAX_FILE) { toast.error(`"${file.name}" is too large — keep clips under ~1MB.`); return; }
            const dataUrl = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.onerror = rej;
              r.readAsDataURL(file);
            });
            onPick(dataUrl);
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>Upload</Button>
        {value ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => playAudioFile(slotKey)}>Preview</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onClear}>Clear</Button>
            <span className="text-xs text-muted-foreground">custom audio attached</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">synth default</span>
        )}
      </div>
    </div>
  );
}

/** Admin audio control center — persisted to app_settings['audio_settings']. */
export function AdminAudio() {
  const qc = useQueryClient();
  const [s, setS] = useState<AudioSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const cur = s ?? DEFAULTS;

  const { data: saved } = useQuery({
    queryKey: ["app-settings", KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as AudioSettings | null;
    },
  });

  useEffect(() => {
    if (saved && !s) setS({ ...DEFAULTS, ...saved, files: saved.files ?? {} });
  }, [saved, s]);

  const setFile = (key: string, dataUrl?: string) => {
    const files = { ...(cur.files ?? {}) };
    if (dataUrl) files[key] = dataUrl; else delete files[key];
    setS({ ...cur, files });
  };

  const save = async (next: AudioSettings) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: next as unknown as Json, updated_at: new Date().toISOString() });
      if (error) throw error;
      setAudioFiles(next.files);
      // Apply live: ambient respects toggle immediately.
      if (!next.ambientEnabled && ambientPlaying()) ambientStop();
      else if (next.ambientEnabled && !ambientPlaying()) ambientStart();
      toast.success("Audio settings saved.");
      void qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save audio settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl"><Volume2 className="h-5 w-5 text-accent" />Audio Control</h2>
          <p className="text-xs text-muted-foreground">Music, ambient bed, UI &amp; tier SFX — attach your own clips or keep synth defaults. Live for all visitors.</p>
        </div>
        <Button size="sm" onClick={() => void save(cur)} disabled={saving}>{saving ? "Saving…" : "Save audio"}</Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Master volume — {cur.masterVolume}%</Label>
          <input type="range" min={0} max={100} value={cur.masterVolume} onChange={(e) => setS({ ...cur, masterVolume: Number(e.target.value) })} className="h-1.5 w-full accent-rose-500" />
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cur.ambientEnabled} onChange={(e) => setS({ ...cur, ambientEnabled: e.target.checked })} className="accent-rose-500" />
            Ambient bed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cur.sfxEnabled} onChange={(e) => setS({ ...cur, sfxEnabled: e.target.checked })} className="accent-rose-500" />
            UI &amp; tier SFX
          </label>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button size="sm" variant="secondary" onClick={() => sfx.click()}>Preview click</Button>
          <Button size="sm" variant="secondary" onClick={() => sfx.angel()}>Preview Angel chime</Button>
          <Button size="sm" variant="secondary" onClick={() => sfx.mythic()}>Preview Mythic pulse</Button>
          <Button size="sm" variant="secondary" onClick={() => sfx.whoosh()}>Preview whoosh</Button>
          <Button size="sm" variant="secondary" onClick={() => (ambientPlaying() ? ambientStop() : ambientStart())}>
            <Music className="h-4 w-4" /> {ambientPlaying() ? "Stop ambient" : "Play ambient"}
          </Button>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Music tracks</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {MUSIC_SLOTS.map((slot) => (
          <FileSlot
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            value={cur.files?.[slot.key]}
            onPick={(d) => setFile(slot.key, d)}
            onClear={() => setFile(slot.key)}
          />
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">UI &amp; SFX overrides</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SFX_SLOTS.map((name) => (
          <FileSlot
            key={name}
            slotKey={`sfx:${name}`}
            label={`${name} sound`}
            value={cur.files?.[`sfx:${name}`]}
            onPick={(d) => setFile(`sfx:${name}`, d)}
            onClear={() => setFile(`sfx:${name}`)}
          />
        ))}
      </div>
    </section>
  );
}
