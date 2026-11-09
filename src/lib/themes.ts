// Theme engine: each preset sets CSS custom properties on <html> without reload.

export interface ThemePreset {
  id: string;
  label: string;
  /** Accent hue (oklch degrees) and chroma; base surfaces tint toward the hue. */
  hue: number;
  chroma: number;
  /** Secondary glow hue for gradients. */
  glow: number;
  /** Minimal = calm editorial look, no glass/glow. */
  minimal?: boolean;
  /** Live 3D — animated/glowing presentation preset. */
  live?: boolean;
}

export const THEMES: ThemePreset[] = [
  { id: "ancient", live: true, label: "Ancient · Ethereal Rune", hue: 85, chroma: 0.12, glow: 160 },
  { id: "modern", live: true, label: "Modern · Neon Agency", hue: 200, chroma: 0.16, glow: 320 },
  { id: "evil", live: true, label: "Evil · Crimson Haze", hue: 22, chroma: 0.2, glow: 350 },
  { id: "darkness", live: true, label: "Darkness · Midnight Abyss", hue: 265, chroma: 0.12, glow: 230 },
  { id: "healing", label: "Healing · Jade Whisper", hue: 160, chroma: 0.13, glow: 120 },
  { id: "wind", label: "Wind · Aero Tempest", hue: 215, chroma: 0.09, glow: 180 },
  { id: "power", live: true, label: "Power · Velvet Twilight", hue: 300, chroma: 0.15, glow: 20 },
  { id: "aggression", live: true, label: "Aggression · Marple Apex", hue: 40, chroma: 0.18, glow: 10 },
  { id: "blackops", label: "Black Ops · H.A.W.K.S.", hue: 135, chroma: 0.1, glow: 95 },
  { id: "astral", live: true, label: "Astral Lagoon · Cosmic Mirage", hue: 245, chroma: 0.14, glow: 185 },
  { id: "minimal", label: "Minimal · Editorial", hue: 70, chroma: 0.11, glow: 70, minimal: true },
  { id: "dune", label: "Dune · Spice Sands", hue: 60, chroma: 0.13, glow: 35 },
  { id: "magic", live: true, label: "Magic · Arcane Bloom", hue: 325, chroma: 0.17, glow: 280 },
  { id: "thunder", live: true, label: "Thunder · Storm Crown", hue: 95, chroma: 0.17, glow: 250 },
  { id: "frost", label: "Frost · Glacier Vow", hue: 225, chroma: 0.07, glow: 200 },
  { id: "inferno", live: true, label: "Inferno · Ember Core", hue: 45, chroma: 0.2, glow: 25 },
  { id: "solid", label: "Solid · Carbon Ops", hue: 260, chroma: 0.004, glow: 260 },
  { id: "eyecare", label: "Eye Care · Warm Dossier", hue: 55, chroma: 0.09, glow: 45 },
  { id: "forest", label: "Forest · Deep Canopy", hue: 150, chroma: 0.1, glow: 190 },
  { id: "mint", label: "Mint · Cool Frost", hue: 175, chroma: 0.08, glow: 200 },
  { id: "ivory", label: "Ivory · Parchment", hue: 85, chroma: 0.05, glow: 60 },
  { id: "stone", label: "Stone · Slate Grey", hue: 220, chroma: 0.02, glow: 210 },
  // Jewel tones — metallic/satin finishes
  { id: "ruby", label: "Jewel · Ruby", hue: 350, chroma: 0.16, glow: 350 },
  { id: "emerald", label: "Jewel · Emerald", hue: 150, chroma: 0.15, glow: 160 },
  { id: "sapphire", label: "Jewel · Sapphire", hue: 215, chroma: 0.14, glow: 220 },
  { id: "gold", live: true, label: "Jewel · Gold", hue: 42, chroma: 0.13, glow: 45 },
  { id: "bronze", label: "Jewel · Bronze", hue: 28, chroma: 0.1, glow: 30 },
  { id: "onyx", label: "Jewel · Onyx", hue: 280, chroma: 0.05, glow: 280 },
  { id: "pewter", label: "Jewel · Pewter", hue: 210, chroma: 0.03, glow: 200 },
  { id: "opal", live: true, label: "Jewel · Rainbow Opal", hue: 200, chroma: 0.12, glow: 320 },
  // Textured finishes (tint via hue/chroma)
  { id: "brushed", label: "Texture · Brushed Metal", hue: 220, chroma: 0.04, glow: 210 },
  { id: "grunge", label: "Texture · Distressed", hue: 30, chroma: 0.08, glow: 20 },
  { id: "ink", label: "Texture · Manga Ink", hue: 0, chroma: 0.02, glow: 0 },
  { id: "weave", label: "Texture · Woven", hue: 90, chroma: 0.06, glow: 80 },
  { id: "fabric", label: "Texture · Fabric Relief", hue: 340, chroma: 0.07, glow: 330 },
  // Live 3D animated presets
  { id: "aurora", label: "Live · Aurora Veil", hue: 190, chroma: 0.18, glow: 280, live: true },
  { id: "plasma", label: "Live · Plasma Storm", hue: 315, chroma: 0.22, glow: 200, live: true },
  { id: "nebula", label: "Live · Deep Nebula", hue: 255, chroma: 0.2, glow: 300, live: true },
  { id: "ember", label: "Live · Ember Drift", hue: 25, chroma: 0.2, glow: 350, live: true },
  { id: "abyss", label: "Live · Void Rift", hue: 285, chroma: 0.16, glow: 240, live: true },
  { id: "prism", label: "Live · Prismatic Shard", hue: 175, chroma: 0.15, glow: 40, live: true },
  { id: "solar", label: "Live · Solar Flare", hue: 50, chroma: 0.2, glow: 15, live: true },
  { id: "glacier", label: "Live · Glacier Core", hue: 205, chroma: 0.12, glow: 190, live: true },
];

export const DEFAULT_THEME = "blackops";

const c = (l: number, ch: number, h: number, a?: number) =>
  `oklch(${l} ${ch} ${h}${a !== undefined ? ` / ${a}` : ""})`;

export function themeVars(t: ThemePreset, dark: boolean): Record<string, string> {
  const h = t.hue;
  const tint = t.minimal ? 0.012 : 0.02;
  const accent = c(dark ? 0.76 : 0.6, t.chroma, h);
  const glow = c(dark ? 0.7 : 0.62, t.chroma, t.glow);
  const base = dark
    ? {
        "--background": c(t.minimal ? 0.17 : 0.13, tint, h),
        "--foreground": c(0.94, 0.01, h),
        "--card": c(t.minimal ? 0.21 : 0.18, tint, h, t.minimal ? 1 : 0.62),
        "--popover": c(0.19, tint, h),
        "--primary": accent,
        "--primary-foreground": c(0.14, 0.02, h),
        "--secondary": c(0.24, tint, h, 0.8),
        "--muted": c(0.24, tint, h),
        "--muted-foreground": c(0.68, 0.02, h),
        "--border": c(1, 0, 0, t.minimal ? 0.09 : 0.11),
        "--input": c(1, 0, 0, 0.14),
      }
    : {
        "--background": c(0.97, 0.01, h),
        "--foreground": c(0.2, 0.02, h),
        "--card": c(0.99, 0.006, h, t.minimal ? 1 : 0.7),
        "--popover": c(0.99, 0.006, h),
        "--primary": t.minimal ? c(0.22, 0.02, h) : accent,
        "--primary-foreground": c(0.98, 0.005, h),
        "--secondary": c(0.93, 0.015, h, 0.85),
        "--muted": c(0.93, 0.015, h),
        "--muted-foreground": c(0.48, 0.02, h),
        "--border": c(0.2, 0.02, h, 0.12),
        "--input": c(0.2, 0.02, h, 0.16),
      };
  return {
    ...base,
    "--card-foreground": base["--foreground"],
    "--popover-foreground": base["--foreground"],
    "--secondary-foreground": base["--foreground"],
    "--accent": accent,
    "--accent-foreground": c(0.14, 0.02, h),
    "--ring": accent,
    "--glow": glow,
    "--glow-strength": t.minimal ? "0" : "1",
    "--glass-blur": t.minimal ? "0px" : "18px",
  };
}

export const FONT_SCALES = [0.875, 0.9375, 1, 1.0625, 1.125, 1.25];
