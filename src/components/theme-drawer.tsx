import { useState } from "react";
import { Palette } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppearance } from "@/hooks/use-appearance";
import { navMode, setNavMode, type NavMode } from "@/components/floating-nav";
import { THEMES } from "@/lib/themes";

export function ThemeDrawer({ open, onOpenChange }: { open?: boolean; onOpenChange?: (o: boolean) => void } = {}) {
  const { theme, setTheme, zoom, scaleIndex } = useAppearance();
  const [tab, setTab] = useState<"live" | "plain">("live");
  const liveThemes = THEMES.filter((t) => t.live);
  const plainThemes = THEMES.filter((t) => !t.live);
  const visible = tab === "live" ? liveThemes : plainThemes;
  return (
    <Sheet {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      <SheetTrigger asChild>
        <button aria-label="Appearance" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-accent hover:glow-ring">
          <Palette className="h-3.5 w-3.5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display text-2xl">Appearance</SheetTitle></SheetHeader>
        <div className="flex gap-1.5 px-4 pt-1">
          {([["live", "Live 3D"], ["plain", "Plain"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-xs ${tab === t ? "bg-accent text-accent-foreground" : "border text-muted-foreground"}`}
            >
              {label} ({t === "live" ? liveThemes.length : plainThemes.length})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
          {visible.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left text-xs transition ${theme === t.id ? "border-accent glow-ring" : "hover:border-foreground/30"}`}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-full"
                style={{ background: `conic-gradient(oklch(0.72 ${t.chroma} ${t.hue}), oklch(0.65 ${t.chroma} ${t.glow}), oklch(0.2 0.02 ${t.hue}), oklch(0.72 ${t.chroma} ${t.hue}))` }}
              />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 pb-6 text-sm">
          <span className="text-muted-foreground">Text size</span>
          <button className="rounded-full border px-3 py-1" onClick={() => zoom(-1)} aria-label="Zoom out">A−</button>
          <span className="w-8 text-center text-xs">{scaleIndex + 1}/6</span>
          <button className="rounded-full border px-3 py-1" onClick={() => zoom(1)} aria-label="Zoom in">A+</button>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 pb-6 pt-4 text-sm">
          <span className="text-muted-foreground">Navigation mode</span>
          <div className="flex gap-1.5">
            {([["standard", "Header"], ["hud", "HUD"]] as [NavMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setNavMode(m)}
                className={`rounded-full px-3 py-1 text-xs ${navMode() === m ? "bg-accent text-accent-foreground" : "border text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
