import { useEffect, useRef } from "react";
import { abilityDef } from "@/lib/abilities";

export type Element = "wind" | "fire" | "water" | "lightning" | "shadow" | "celestial";

export const ELEMENT_LABEL: Record<Element, string> = {
  wind: "Wind", fire: "Fire", water: "Water", lightning: "Lightning", shadow: "Shadow", celestial: "Celestial",
};

const RULES: Array<[RegExp, Element]> = [
  [/wind|aero|tempest|gale/i, "wind"],
  [/hydro|water|aqua|tide|wave|tsunami|ocean|ice|cryo|frost/i, "water"],
  [/fire|flame|inferno|ember|draconic|magma|blood|hemo/i, "fire"],
  [/lightning|electro|zap|astra|volt|thunder|shock|storm/i, "lightning"],
  [/shadow|void|dark|demonic|abyss|night|umbral|obsidian/i, "shadow"],
  [/celestial|holy|divine|angel|light|radiant|aureate|solar|moon|star/i, "celestial"],
];

const THEME_MAP: Record<string, Element> = {
  wind: "wind", water: "water", ice: "water", fire: "fire", blood: "fire", beast: "fire",
  storm: "lightning", tech: "lightning", void: "shadow", celestial: "celestial",
};

/** Theme override wins; otherwise the first ability keyword match; default celestial. */
export function resolveElement(abilities: string[] | undefined, theme?: string | null): Element {
  if (theme && THEME_MAP[theme]) return THEME_MAP[theme];
  const text = (abilities ?? []).map((a) => abilityDef(a)?.label ?? a).join(" ");
  for (const [re, el] of RULES) if (re.test(text)) return el;
  return "celestial";
}

const COLORS: Record<Element, [string, string]> = {
  wind: ["56,189,248", "186,230,253"],
  fire: ["239,68,68", "251,191,36"],
  water: ["2,132,199", "125,211,252"],
  lightning: ["168,85,247", "250,250,210"],
  shadow: ["124,58,237", "30,27,75"],
  celestial: ["251,191,36", "255,255,255"],
};

/** Full-bleed, low-opacity animated backdrop for the dossier. Pauses when the tab is hidden. */
export function ElementalWallpaper({ element, enabled }: { element: Element; enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const [c1, c2] = COLORS[element];
    const parts = Array.from({ length: 70 }, (_, i) => ({ s: i * 137.508, r: ((i * 7919) % 100) / 100 }));
    let bolt = { until: 0, pts: [] as Array<[number, number]> };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h / 2, Math.max(w, h));
      g.addColorStop(0, `rgba(${c1},0.14)`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      if (!enabled) return;
      ctx.globalCompositeOperation = "lighter";
      if (element === "wind" || element === "water") {
        const lines = element === "wind" ? 7 : 5;
        for (let l = 0; l < lines; l++) {
          ctx.beginPath();
          const y0 = (h / (lines + 1)) * (l + 1);
          for (let x = 0; x <= w; x += 12) {
            const y = element === "wind"
              ? y0 + Math.sin(x * 0.006 + t * 0.9 + l) * 26
              : y0 + Math.sin(x * 0.01 - t * 0.6 + l * 1.7) * 10 + Math.sin(x * 0.003 + t * 0.3) * 18;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${l % 2 ? c2 : c1},${element === "wind" ? 0.18 : 0.14})`;
          ctx.lineWidth = element === "wind" ? 1.2 : 2;
          ctx.stroke();
        }
        if (element === "water") {
          for (let i = 0; i < 4; i++) {
            const p = (t * 0.25 + i / 4) % 1;
            ctx.beginPath();
            ctx.arc(w * (0.2 + 0.2 * i), h * (0.3 + 0.15 * (i % 3)), p * 160, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c2},${0.22 * (1 - p)})`; ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
      } else {
        for (const p of parts) {
          let x = 0, y = 0, size = 1.5, a = 0.5;
          if (element === "fire") {
            const life = (t * (0.08 + p.r * 0.1) + p.r) % 1;
            x = ((p.s * 3.1) % w) + Math.sin(t * 2 + p.s) * 14; y = h * (1 - life); size = 1 + p.r * 2.5; a = 0.7 * (1 - life);
          } else if (element === "shadow") {
            x = ((p.s * 5.3) % w) + Math.sin(t * 0.2 + p.s) * 40; y = ((p.s * 2.7) % h) + Math.cos(t * 0.25 + p.s) * 40;
            size = 6 + p.r * 20; a = 0.08 + 0.06 * Math.sin(t + p.s);
          } else {
            x = (p.s * 4.7) % w; y = (p.s * 3.3) % h; size = 0.6 + p.r * 1.6; a = 0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + p.r) + p.s));
          }
          const col = p.r > 0.5 ? c2 : c1;
          const rg = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
          rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, size * 3, 0, Math.PI * 2); ctx.fill();
        }
        if (element === "lightning") {
          if (t > bolt.until + 2.5 + Math.random() * 3) {
            let x = Math.random() * w, y = 0; const pts: Array<[number, number]> = [[x, y]];
            while (y < h) { x += (Math.random() - 0.5) * 60; y += 20 + Math.random() * 30; pts.push([x, y]); }
            bolt = { until: t + 0.18, pts };
          }
          if (t < bolt.until) {
            ctx.beginPath(); bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.strokeStyle = `rgba(${c2},0.5)`; ctx.lineWidth = 1.5; ctx.shadowBlur = 16; ctx.shadowColor = `rgb(${c1})`; ctx.stroke(); ctx.shadowBlur = 0;
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const tick = (now: number) => { draw(now / 1000); raf = !document.hidden && enabled && !reduce ? requestAnimationFrame(tick) : 0; };
    const onVis = () => { if (!document.hidden && !raf && enabled && !reduce) raf = requestAnimationFrame(tick); };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [element, enabled]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60" />;
}
