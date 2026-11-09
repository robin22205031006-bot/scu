import { useEffect, useRef } from "react";
import { abilityDef } from "@/lib/abilities";
import { useAnimationsEnabled } from "@/lib/animations";

/** Shared rAF loop: pauses offscreen/hidden, handles DPR resize. */
function useCanvasLoop(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number) => void, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = canvas.getBoundingClientRect();
      drawRef.current(ctx, r.width, r.height, now / 1000, dpr);
      raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      visible = !!e?.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ---------------------------------- themes --------------------------------- */

export type ThemeKey = "wind" | "water" | "fire" | "storm" | "void" | "celestial" | "beast" | "blood" | "ice" | "tech" | "default";

export const CARD_THEMES: Array<{ key: ThemeKey; label: string }> = [
  { key: "wind", label: "Wind / Tempest" },
  { key: "water", label: "Water / Tide" },
  { key: "fire", label: "Fire / Inferno" },
  { key: "storm", label: "Lightning / Kinetic" },
  { key: "void", label: "Shadow / Void" },
  { key: "celestial", label: "Celestial / Holy" },
  { key: "beast", label: "Beast / Morph" },
  { key: "blood", label: "Blood / Crimson" },
  { key: "ice", label: "Ice / Frost" },
  { key: "tech", label: "Tech / Arcane" },
];

const THEME_BY_KEYWORD: Array<[RegExp, ThemeKey]> = [
  [/wind|aero|tempest|gale|storm.?front/i, "wind"],
  [/hydro|water|aqua|tide|wave|tsunami|ocean/i, "water"],
  [/fire|flame|inferno|ember|draconic|magma|blood|hemo/i, "fire"],
  [/lightning|electro|zap|astra|volt|thunder|shock/i, "storm"],
  [/shadow|void|dark|demonic|abyss|night|umbral|obsidian/i, "void"],
  [/celestial|holy|divine|angel|light|radiant|aureate|solar|moon|star/i, "celestial"],
];

const PALETTES: Record<ThemeKey, string[]> = {
  wind: ["#38bdf8", "#7dd3fc", "#e0f2fe"],
  water: ["#0284c7", "#38bdf8", "#bae6fd"],
  fire: ["#ef4444", "#f59e0b", "#fde68a"],
  storm: ["#a855f7", "#eab308", "#f5f3ff"],
  void: ["#1e1b4b", "#7c3aed", "#e9d5ff"],
  celestial: ["#fbbf24", "#ffffff", "#fde68a"],
  beast: ["#f97316", "#fbbf24", "#dc2626"],
  blood: ["#dc2626", "#7f1d1d", "#fca5a5"],
  ice: ["#7dd3fc", "#e0f2fe", "#38bdf8"],
  tech: ["#22d3ee", "#a78bfa", "#67e8f9"],
  default: ["#818cf8", "#c4b5fd", "#e0e7ff"],
};

const THEME_KEYWORDS: Array<[RegExp, ThemeKey]> = [
  ...THEME_BY_KEYWORD,
  [/beast|morph|animal|tiger|wolf|dragon.?kin|feral/i, "beast"],
  [/blood|hemokin|crimson|vampire/i, "blood"],
  [/ice|cryo|frost|freeze|glacier/i, "ice"],
  [/tech|cyber|mech|android|nano|plasma.?tech/i, "tech"],
];

function pickTheme(abilities: string[] | undefined): ThemeKey {
  const text = (abilities ?? []).map((a) => abilityDef(a)?.label ?? a).join(" ");
  for (const [re, theme] of THEME_KEYWORDS) if (re.test(text)) return theme;
  return "default";
}

/* ------------------------- AbilityCardCanvas ------------------------------- */

interface Props {
  abilities?: string[];
  /** Admin override — explicit theme key wins over ability-derived theme. */
  theme?: string | null;
  className?: string;
  /** particle count multiplier */
  density?: number;
}

export function AbilityCardCanvas({ abilities, theme: themeOverride, className, density = 1 }: Props) {
  const animOn = useAnimationsEnabled();
  const derived = pickTheme(abilities);
  const theme: ThemeKey = (themeOverride && themeOverride in PALETTES ? themeOverride : derived) as ThemeKey;
  const colors = PALETTES[theme];
  const mouse = useRef({ x: -9999, y: -9999, down: false });

  const ref = useCanvasLoop((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    if (!animOn) return;
    const count = Math.floor(46 * density);
    const boost = mouse.current.down ? 2.2 : 1;
    // ambient gradient
    const g = ctx.createRadialGradient(w / 2, h * 0.75, 0, w / 2, h / 2, Math.max(w, h));
    g.addColorStop(0, `${colors[0]}14`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < count; i++) {
      const seed = i * 137.508;
      const speed = (theme === "fire" ? -26 : theme === "void" ? 8 : 18) * boost;
      const px = ((seed * 7.13 + t * (12 + (i % 5) * 4)) % (w + 40)) - 20;
      const py = theme === "fire"
        ? h - ((seed * 3.7 + t * speed * -1 * (0.6 + (i % 4) * 0.2)) % (h + 60) + 60) % (h + 60)
        : ((seed * 5.9 + t * speed * (theme === "void" ? -0.4 : 1)) % (h + 40) + 40) % (h + 40);
      // cursor turbulence
      const dx = px - mouse.current.x, dy = py - mouse.current.y;
      const dist = Math.hypot(dx, dy);
      const turb = dist < 90 ? (90 - dist) / 90 : 0;
      const ox = px + (dx / (dist || 1)) * turb * 14;
      const oy = py + (dy / (dist || 1)) * turb * 14;
      const r = (theme === "celestial" ? 2.2 : 1.6) + (i % 3) * 0.7;
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + seed));
      ctx.beginPath();
      ctx.arc(ox, oy, r * (1 + turb * 0.8), 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length] + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
    }

    // themed accents
    if (theme === "storm") {
      // crackling perimeter arcs
      if (Math.random() < 0.06) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.strokeStyle = `${colors[0]}aa`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
        ctx.stroke();
      }
    }
    if (theme === "water" || theme === "wind") {
      // flowing sine wave crests
      ctx.strokeStyle = `${colors[0]}55`;
      ctx.lineWidth = 1.2;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = h * (0.55 + row * 0.16) + Math.sin(x * 0.04 + t * (1.4 + row * 0.4)) * (6 + row * 4);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    if (theme === "void") {
      // inward swirl arcs
      ctx.strokeStyle = `${colors[1]}30`;
      for (let i = 0; i < 4; i++) {
        const r = ((t * 22 + i * 34) % 120) + 20;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, t + i, t + i + 2.2);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, [theme, density]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mouse.current.x = e.clientX - r.left;
        mouse.current.y = e.clientY - r.top;
      }}
      onMouseLeave={() => { mouse.current.x = -9999; mouse.current.y = -9999; }}
      onMouseDown={() => { mouse.current.down = true; }}
      onMouseUp={() => { mouse.current.down = false; }}
    />
  );
}

/* --------------------------- CrimsonBloodlineTheme ------------------------- */

export function CrimsonBloodlineTheme({ className }: { className?: string }) {
  const animOn = useAnimationsEnabled();
  const mouse = useRef({ x: -9999, y: -9999 });
  const pulses = useRef<Array<{ x: number; y: number; r: number; a: number }>>([]);

  const ref = useCanvasLoop((ctx, w, h, t) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!animOn) return;
    const cx = w / 2, cy = h / 2;
    const beat = 1 + Math.sin(t * 1.8) * 0.06;
    const nodes: Array<[number, number, number]> = [];

    // dense central cluster
    const clusterN = 90;
    for (let i = 0; i < clusterN; i++) {
      const a = (i / clusterN) * Math.PI * 2 + i * 0.7;
      const rr = Math.pow((i * 37 % 100) / 100, 1.6) * Math.min(w, h) * 0.16 * beat;
      nodes.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, 1]);
    }
    // jagged exploratory branches
    for (let b = 0; b < 26; b++) {
      const a = b * 2.4;
      let x = cx + Math.cos(a) * 10, y = cy + Math.sin(a) * 10;
      for (let s = 0; s < 9; s++) {
        const step = 14 + (b % 4) * 6;
        x += Math.cos(a + Math.sin(t * 0.4 + b) * 0.9) * step;
        y += Math.sin(a + Math.cos(t * 0.3 + b * 2) * 0.9) * step;
        nodes.push([x, y, 0.4]);
      }
    }

    // connective threads
    ctx.lineWidth = 0.6;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < Math.min(i + 8, nodes.length); j++) {
        const [x1, y1, b1] = nodes[i]!; const [x2, y2, b2] = nodes[j]!;
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < Math.min(w, h) * 0.22) {
          ctx.strokeStyle = `rgba(239,68,68,${(0.25 * b1 * b2).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
    }
    // traveling pulse flashes along primary paths
    for (let p = 0; p < 3; p++) {
      const k = (t * 0.35 + p * 0.33) % 1;
      const i0 = Math.floor(k * (nodes.length - 1));
      const [x1, y1] = nodes[i0]!; const [x2, y2] = nodes[i0 + 1]!;
      ctx.strokeStyle = "rgba(252,165,165,0.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // nodes + spores
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, b] of nodes) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * b + 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239,68,68,${(0.75 * b).toFixed(2)})`;
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const seed = i * 91.7;
      const ang = seed + t * 0.15;
      const rr = ((seed * 13 + t * 14) % (Math.min(w, h) * 0.55));
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.85;
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,38,38,${(0.5 - rr / (Math.min(w, h))).toFixed(2)})`;
      ctx.fill();
    }
    // shockwave pulses from pointer
    pulses.current = pulses.current.filter((p) => p.a > 0.01);
    for (const p of pulses.current) {
      p.r += 4.5; p.a *= 0.94;
      ctx.strokeStyle = `rgba(239,68,68,${p.a.toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  });

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    pulses.current.push({ x: mouse.current.x, y: mouse.current.y, r: 4, a: 0.55 });
    if (pulses.current.length > 6) pulses.current.shift();
  };

  return <canvas ref={ref} className={className} aria-hidden onMouseMove={onMove} />;
}

/* --------------------------- CyanNeuralPlexusTheme ------------------------- */

export function CyanNeuralPlexusTheme({ className }: { className?: string }) {
  const animOn = useAnimationsEnabled();
  const mouse = useRef({ x: -999, y: -999 });
  const nodes = useRef<Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }>>([]);
  const init = useRef(false);

  const ref = useCanvasLoop((ctx, w, h, t) => {
    if (!animOn) { ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, w, h); return; }
    if (!init.current || nodes.current.length !== 90) {
      nodes.current = Array.from({ length: 90 }, (_, i) => ({
        x: ((i * 73) % 100) / 100 - 0.5,
        y: ((i * 41) % 100) / 100 - 0.5,
        z: ((i * 29) % 100) / 100,
        vx: 0, vy: 0, vz: 0,
      }));
      init.current = true;
    }
    // deep void background
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, "#0b1e3a");
    g.addColorStop(1, "#020617");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const rot = t * 0.08;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const pts = nodes.current.map((n) => {
      // slow drift + gentle mouse gravity
      const wx = n.x + t * 0.008, wy = n.y + Math.sin(t * 0.2 + n.z * 9) * 0.02;
      const rz = n.z;
      const x1 = wx * cos - wy * sin, y1 = wx * sin + wy * cos;
      const persp = 1 / (1.6 - rz * 0.5);
      const sx = w / 2 + x1 * w * 0.42 * persp;
      const sy = h / 2 + y1 * h * 0.42 * persp + Math.sin(t * 0.3 + n.x * 12) * 4;
      const mdx = (sx - mouse.current.x) / w, mdy = (sy - mouse.current.y) / h;
      const md = Math.hypot(mdx, mdy);
      const pull = md < 0.25 ? (0.25 - md) * 0.02 : 0;
      n.vx += (-mdx / (md || 1)) * pull; n.vy += (-mdy / (md || 1)) * pull;
      n.vx *= 0.96; n.vy *= 0.96;
      n.x += n.vx * 0.01; n.y += n.vy * 0.01;
      return { sx, sy, z: rz, persp };
    });

    // polygon facets for close clusters
    ctx.fillStyle = "rgba(6,182,212,0.05)";
    for (let i = 0; i < pts.length; i += 3) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!, c = pts[(i + 2) % pts.length]!;
      if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < w * 0.2) {
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.lineTo(c.sx, c.sy); ctx.closePath(); ctx.fill();
      }
    }
    // threads
    ctx.lineWidth = 0.7;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < Math.min(i + 6, pts.length); j++) {
        const a = pts[i]!, b = pts[j]!;
        const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
        if (d < w * 0.16) {
          const nearMouse = Math.hypot((a.sx + b.sx) / 2 - mouse.current.x, (a.sy + b.sy) / 2 - mouse.current.y) < 140;
          ctx.strokeStyle = `rgba(6,182,212,${(nearMouse ? 0.4 : 0.15 + 0.1 * a.persp).toFixed(2)})`;
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }
    }
    // nodes
    ctx.globalCompositeOperation = "lighter";
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 1.4 + p.persp, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(6,182,212,${(0.4 + 0.6 * p.persp).toFixed(2)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  });

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }}
      onMouseLeave={() => { mouse.current = { x: -999, y: -999 }; }}
    />
  );
}
