// Admin-controlled typography engine. Settings live in app_settings['ui_typography']
// (public read, admin write) and are applied as CSS variables on <html>.

export type SectionKey = "characters" | "organizations" | "series" | "timeline";

export const SECTION_KEYS: { key: SectionKey; label: string }[] = [
  { key: "characters", label: "Characters" },
  { key: "organizations", label: "Organizations" },
  { key: "series", label: "Series" },
  { key: "timeline", label: "Timeline" },
];

export interface SectionStyle {
  /** CSS color for primary text in this view. */
  text?: string | undefined;
  /** CSS color for accent highlights in this view. */
  accent?: string | undefined;
}

export interface CustomFont {
  name: string;
  url: string;
}

export type CardEffect =
  | "glass" | "neumorphism" | "drop-shadow" | "glow" | "gradient"
  | "outer-glow" | "inner-shadow" | "bevel" | "satin" | "texture" | "comic";

export const CARD_EFFECTS: { id: CardEffect; label: string }[] = [
  { id: "glass", label: "01. Glass Effect" },
  { id: "neumorphism", label: "02. Neumorphism" },
  { id: "drop-shadow", label: "03. Drop Shadow" },
  { id: "glow", label: "04. Glow Effect" },
  { id: "gradient", label: "05. Gradient Overlay" },
  { id: "outer-glow", label: "06. Outer Glow" },
  { id: "inner-shadow", label: "07. Inner Shadow" },
  { id: "bevel", label: "08. Bevel & Emboss" },
  { id: "satin", label: "09. Satin Effect" },
  { id: "texture", label: "10. Texture Overlay" },
  { id: "comic", label: "11. Comic Ink / Halftone" },
];

export type UiMode = "gaming" | "minimal" | "manga";

export const UI_MODES: { id: UiMode; label: string; desc: string }[] = [
  { id: "gaming", label: "Mode A — AAA Gaming / Cyberpunk", desc: "Glassmorphism, neon glow, HUD styling." },
  { id: "minimal", label: "Mode B — Calm / Minimalist", desc: "Soft neumorphism, clean type, relaxed padding." },
  { id: "manga", label: "Mode C — Manga & Comic", desc: "Ink-hatch borders, halftone dots, action panels." },
];

export type Density = "relaxed" | "standard" | "tight";

export interface TypographySettings {
  bodyFont: string;
  displayFont: string;
  customFonts: CustomFont[];
  /** Multiplier on the user's zoom level (0.85 – 1.5 → 10 visual steps). */
  baseScale: number;
  /** Font weight applied to h1–h4 headings (400–800). */
  headingWeight: number;
  sections: Record<SectionKey, SectionStyle>;
  /** Card surface effect applied globally. */
  cardEffect: CardEffect;
  /** Card corner radius in px (4–16). */
  cardRadius: number;
  /** Layout density. */
  density: Density;
  /** Smooth UI animations on/off. */
  smoothMotion: boolean;
  /** Bold focus rings on interactive elements. */
  boldFocus: boolean;
  /** Global UI/UX preset: gaming | minimal | manga. */
  uiMode?: UiMode;
  /** Display tuning: 0-200 sliders applied as CSS filter vars on .glass. */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  glow?: number;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  bodyFont: "Manrope",
  displayFont: "Cormorant Garamond",
  customFonts: [],
  baseScale: 1,
  headingWeight: 500,
  sections: {
    characters: {},
    organizations: {},
    series: {},
    timeline: {},
  },
  cardEffect: "glass",
  cardRadius: 16,
  density: "standard",
  smoothMotion: true,
  boldFocus: true,
  uiMode: "gaming",
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  glow: 100,
};

/** Curated tactical / sci-fi faces offered in the admin picker. */
export const CURATED_FONTS = [
  // Sans / UI
  "Manrope", "Inter", "Space Grotesk", "IBM Plex Sans", "Saira", "Chakra Petch",
  "Rajdhani", "Exo 2", "Orbitron", "Michroma", "Share Tech Mono", "Major Mono Display",
  // Display / serif
  "Cormorant Garamond", "Playfair Display", "EB Garamond", "Cinzel", "Marcellus",
  "Unbounded", "Zen Dots", "Silkscreen",
] as const;

const SANS_FALLBACK = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const SERIF_FALLBACK = `Georgia, "Times New Roman", serif`;

function isGoogleFont(name: string): boolean {
  return /^[A-Za-z0-9 ]+$/.test(name) && !name.includes("system");
}

function googleFontHref(name: string): string {
  const family = name.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800&display=swap`;
}

const loadedHrefs = new Set<string>();

/** Inject a stylesheet <link> once per href. */
export function ensureStylesheet(href: string): void {
  if (typeof document === "undefined" || loadedHrefs.has(href)) return;
  loadedHrefs.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Load every font the settings reference (Google fonts + custom imports). */
export function loadTypographyFonts(s: TypographySettings): void {
  const families = new Set([s.bodyFont, s.displayFont]);
  for (const f of s.customFonts) if (f.name.trim()) families.add(f.name.trim());
  for (const name of families) {
    if (isGoogleFont(name)) ensureStylesheet(googleFontHref(name));
  }
  for (const f of s.customFonts) {
    if (f.url.trim()) ensureStylesheet(f.url.trim());
  }
}

/** Push the settings onto <html> as CSS variables. */
export function applyTypography(s: TypographySettings): void {
  if (typeof document === "undefined") return;
  loadTypographyFonts(s);
  const root = document.documentElement;
  const bodyStack = isGoogleFont(s.bodyFont) || s.customFonts.some((f) => f.name === s.bodyFont)
    ? `"${s.bodyFont}", ${SANS_FALLBACK}`
    : s.bodyFont;
  const displayStack = `"${s.displayFont}", ${SERIF_FALLBACK}`;
  root.style.setProperty("--font-sans", bodyStack);
  root.style.setProperty("--font-display", displayStack);
  root.style.setProperty("--scu-base-scale", String(Math.min(1.5, Math.max(0.8, s.baseScale ?? 1))));
  root.style.setProperty("--scu-heading-weight", String(s.headingWeight ?? 500));
  root.style.setProperty("--scu-card-radius", `${Math.min(16, Math.max(4, s.cardRadius ?? 16))}px`);
  root.setAttribute("data-density", s.density ?? "standard");
  root.setAttribute("data-cardfx", s.cardEffect ?? "glass");
  root.setAttribute("data-motion", s.smoothMotion === false ? "off" : "on");
  root.setAttribute("data-focus", s.boldFocus === false ? "soft" : "bold");
  root.setAttribute("data-ui-mode", s.uiMode ?? "gaming");
  const pct = (v: number | undefined, d = 100) => `${Math.min(200, Math.max(0, v ?? d))}%`;
  root.style.setProperty("--scu-brightness", pct(s.brightness));
  root.style.setProperty("--scu-contrast", pct(s.contrast));
  root.style.setProperty("--scu-saturation", pct(s.saturation));
  root.style.setProperty("--scu-hue", `${Math.min(360, Math.max(-360, s.hue ?? 0))}deg`);
  root.style.setProperty("--scu-glow", pct(s.glow));
  for (const { key } of SECTION_KEYS) {
    const sec = s.sections[key];
    if (sec.text) root.style.setProperty(`--scu-sec-${key}-text`, sec.text);
    else root.style.removeProperty(`--scu-sec-${key}-text`);
    if (sec.accent) root.style.setProperty(`--scu-sec-${key}-accent`, sec.accent);
    else root.style.removeProperty(`--scu-sec-${key}-accent`);
  }
}

/** Per-view inline vars consumed by route <main> elements via useSectionStyle. */
export function sectionStyleVars(s: TypographySettings, view: SectionKey): Record<string, string> {
  const sec = s.sections[view];
  const vars: Record<string, string> = {};
  if (sec.text) vars["--foreground"] = sec.text;
  if (sec.accent) {
    vars["--accent"] = sec.accent;
    vars["--ring"] = sec.accent;
  }
  return vars;
}
