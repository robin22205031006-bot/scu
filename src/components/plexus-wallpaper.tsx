import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * 3D "plexus" live wallpaper: drifting points in depth, joined by glowing
 * lines when close, slowly rotating. Crimson on story pages, blue on
 * archive/browsing pages. Pauses when hidden or reduced motion is set.
 */
const BLUE_ROUTES = ["/characters", "/archive", "/reader", "/abilities", "/timeline"];

export function PlexusWallpaper() {
  const ref = useRef<HTMLCanvasElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden = path === "/character"; // dossier has its own elemental wallpaper
  const rgb = BLUE_ROUTES.some((r) => path.startsWith(r)) ? "59,130,246" : "220,38,38";

  useEffect(() => {
    if (hidden) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = window.innerWidth < 640 ? 60 : 110;
    const pts = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * 0.002, vy: (Math.random() - 0.5) * 0.002, vz: (Math.random() - 0.5) * 0.002,
    }));
    let w = 0, h = 0, raf = 0, angle = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const proj = new Array(N);
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      angle += 0.0012;
      const c = Math.cos(angle), s = Math.sin(angle);
      const scale = Math.max(w, h) * 0.55;
      for (let i = 0; i < N; i++) {
        const p = pts[i]!;
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        if (Math.abs(p.x) > 1) p.vx *= -1;
        if (Math.abs(p.y) > 1) p.vy *= -1;
        if (Math.abs(p.z) > 1) p.vz *= -1;
        const rx = p.x * c - p.z * s, rz = p.x * s + p.z * c + 2.6;
        const f = 1.6 / rz;
        proj[i] = { x: w / 2 + rx * f * scale, y: h / 2 + p.y * f * scale, d: f, wx: p.x, wy: p.y, wz: p.z };
      }
      ctx.lineWidth = 0.7;
      for (let i = 0; i < N; i++) {
        const a = proj[i];
        for (let j = i + 1; j < N; j++) {
          const b = proj[j];
          const dx = a.wx - b.wx, dy = a.wy - b.wy, dz = a.wz - b.wz;
          const dd = dx * dx + dy * dy + dz * dz;
          if (dd < 0.12) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - dd / 0.12) * 0.35 * a.d})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${rgb},${0.5 * a.d + 0.2})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, 1.6 * a.d, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduced) raf = requestAnimationFrame(draw); };
    document.addEventListener("visibilitychange", onVis);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hidden, rgb]);

  if (hidden) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-70" />;
}
