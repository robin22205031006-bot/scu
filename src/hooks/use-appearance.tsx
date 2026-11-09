import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, FONT_SCALES, THEMES, themeVars } from "@/lib/themes";

interface Appearance {
  theme: string;
  dark: boolean;
  scaleIndex: number;
  setTheme: (id: string) => void;
  setDark: (d: boolean) => void;
  zoom: (dir: 1 | -1) => void;
}

const Ctx = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [dark, setDark] = useState(true);
  const [scaleIndex, setScale] = useState(2);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("scu-theme-id");
      setTheme(THEMES.some((t) => t.id === saved) && saved ? saved : DEFAULT_THEME);
      setDark(localStorage.getItem("scu-theme") !== "light");
      const rawScale = localStorage.getItem("scu-scale");
      const s = Number(rawScale);
      if (rawScale && Number.isInteger(s) && s >= 0 && s < FONT_SCALES.length) setScale(s);
    } catch { /* Appearance remains usable when browser storage is disabled. */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = THEMES.find((x) => x.id === theme) ?? THEMES[0];
    if (!t) return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVars(t, dark))) root.style.setProperty(k, v);
    root.classList.toggle("dark", dark);
    root.dataset["minimal"] = t.minimal ? "true" : "false";
    root.setAttribute("data-theme", t.id);
    // Zoom is expressed as a CSS var so the admin typography base-scale can compose with it.
    root.style.setProperty("--scu-zoom", String(FONT_SCALES[scaleIndex] ?? 1));
    try {
      localStorage.setItem("scu-theme-id", t.id);
      localStorage.setItem("scu-theme", dark ? "dark" : "light");
      localStorage.setItem("scu-scale", String(scaleIndex));
    } catch { /* Storage is optional. */ }
  }, [theme, dark, scaleIndex, loaded]);

  const zoom = (dir: 1 | -1) => setScale((i) => Math.min(FONT_SCALES.length - 1, Math.max(0, i + dir)));

  return <Ctx.Provider value={{ theme, dark, scaleIndex, setTheme, setDark, zoom }}>{children}</Ctx.Provider>;
}

export function useAppearance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppearance outside provider");
  return v;
}
