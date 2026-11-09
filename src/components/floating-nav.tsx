import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { TABS } from "@/lib/nav";
import { ThemeDrawer } from "./theme-drawer";
import { sfx } from "@/lib/scu-audio";
import { useNavHidden } from "@/lib/nav-visibility";

const LS_MODE = "scu-nav-mode";
const LS_POS = "scu-hud-pos";
/** Bump this when the default anchor moves so stale saved positions reset. */
const POS_VERSION = 2;
export type NavMode = "standard" | "hud";
export const navMode = (): NavMode => {
  if (typeof window === "undefined") return "standard";
  const v = localStorage.getItem(LS_MODE);
  if (v === "1") return "hud"; // legacy boolean
  return v === "hud" ? "hud" : "standard";
};
export const setNavMode = (m: NavMode) => {
  try { localStorage.setItem(LS_MODE, m); } catch { /* noop */ }
  window.dispatchEvent(new Event("scu-nav-mode"));
};
// Back-compat helpers used by the Appearance drawer.
export const hudNavEnabled = () => navMode() === "hud";
export const setHudNav = (on: boolean) => setNavMode(on ? "hud" : "standard");

const defaultPos = () =>
  typeof window === "undefined" ? { x: 0, y: 0 } : { x: window.innerWidth - 76, y: 84 };
const loadPos = (): { x: number; y: number } => {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  try {
    const raw = localStorage.getItem(LS_POS);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.v === POS_VERSION && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }
  } catch { /* noop */ }
  return defaultPos();
};

/** Floating circular HUD menu — draggable anchor + spring radial fan-out. */
export function FloatingNav() {
  const [mode, setMode] = useState<NavMode>(navMode);
  const navHidden = useNavHidden();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  // Spin offset (degrees) — spring-smoothed for buttery rotation.
  const spinMV = useMotionValue(0);
  const spin = useSpring(spinMV, { stiffness: 120, damping: 18, mass: 0.6 });
  const spinDeg = useRef(0);

  useEffect(() => {
    const sync = () => setMode(navMode());
    window.addEventListener("scu-nav-mode", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("scu-nav-mode", sync); window.removeEventListener("storage", sync); };
  }, []);

  // Persist position + clamp on resize.
  useEffect(() => {
    try { localStorage.setItem(LS_POS, JSON.stringify({ ...pos, v: POS_VERSION })); } catch { /* noop */ }
  }, [pos]);
  useEffect(() => {
    const clamp = () =>
      setPos((p) => ({
        x: Math.min(Math.max(p.x, 8), window.innerWidth - 68),
        y: Math.min(Math.max(p.y, 8), window.innerHeight - 68),
      }));
    window.addEventListener("resize", clamp);
    clamp();
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    setPos({
      x: Math.min(Math.max(d.ox + dx, 8), window.innerWidth - 68),
      y: Math.min(Math.max(d.oy + dy, 8), window.innerHeight - 68),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (!wasDrag) { sfx.click(); setOpen((o) => !o); }
    else (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const spinBy = (delta: number) => {
    spinDeg.current += delta;
    spinMV.set(spinDeg.current);
    sfx.pop();
  };
  // Drag horizontally on the rotate handle for continuous spin.
  const spinDrag = useRef<{ sx: number; start: number } | null>(null);
  const onSpinDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    spinDrag.current = { sx: e.clientX, start: spinDeg.current };
  };
  const onSpinMove = (e: React.PointerEvent) => {
    const d = spinDrag.current;
    if (!d) return;
    spinDeg.current = d.start + (e.clientX - d.sx) * 0.6;
    spinMV.set(spinDeg.current);
  };
  const onSpinUp = (e: React.PointerEvent) => {
    spinDrag.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // The full-screen character dossier has its own header; keep the floating menu off it.
  if (mode !== "hud" || navHidden || (typeof window !== "undefined" && window.location.pathname === "/character")) return null;
  const items = [...TABS, { to: "/profile", label: "Profile" }, { to: "#theme", label: "Theme" }] as const;
  const spread = items.length > 8 ? 30 : 38;
  // Fan direction follows screen half so nodes never clip off-viewport.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const fanDown = pos.y < vh / 2;
  const baseAngle = fanDown ? 90 : -90;
  const radius = 112;
  // Keep the whole ring inside horizontal bounds.
  const ringCenterX = pos.x + 28;
  const ringHalf = radius + 30;
  const clampedCenter = Math.min(Math.max(ringCenterX, ringHalf + 8), vw - ringHalf - 8);
  const offsetX = clampedCenter - ringCenterX;

  return (
    <div className="fixed z-40" style={{ left: pos.x, top: pos.y }}>
      <AnimatePresence>
        {open && (
          <>
            {/* rotate handle — drag horizontally to spin the ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute -top-12 left-1/2 -translate-x-1/2"
            >
              <button
                aria-label="Spin menu"
                onPointerDown={onSpinDown}
                onPointerMove={onSpinMove}
                onPointerUp={onSpinUp}
                onPointerCancel={onSpinUp}
                className="glass glow-ring grid h-9 w-9 cursor-grab touch-none place-items-center rounded-full text-muted-foreground active:cursor-grabbing"
              >
                <RefreshCw size={14} />
              </button>
            </motion.div>
            {/* nudge buttons */}
            <motion.div
              className="absolute -top-12 right-0 flex gap-1"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <button onClick={() => spinBy(-45)} className="glass grid h-9 w-9 place-items-center rounded-full text-xs" aria-label="Rotate counter-clockwise">↺</button>
              <button onClick={() => spinBy(45)} className="glass grid h-9 w-9 place-items-center rounded-full text-xs" aria-label="Rotate clockwise">↻</button>
            </motion.div>
            <motion.div
              className={`absolute left-1/2 ${fanDown ? "top-16" : "bottom-16"}`}
              style={{ x: `calc(-50% + ${offsetX}px)`, rotate: spin }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {items.map((item, i) => {
                const isTheme = item.to === "#theme";
                const angle = baseAngle + (i - (items.length - 1) / 2) * spread;
                const rad = (angle * Math.PI) / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;
                return (
                  <motion.div
                    key={item.to}
                    variants={{
                      hidden: { opacity: 0, scale: 0.3, x: 0, y: 0 },
                      show: { opacity: 1, scale: 1, x, y, transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.8, delay: i * 0.05 } },
                    }}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, scale: 0.3, x: 0, y: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                    className="absolute left-0 top-0"
                  >
                    {isTheme ? (
                      <button
                        onClick={() => { sfx.pop(); setOpen(false); setThemeOpen(true); }}
                        className="glass glow-ring flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide"
                        aria-label="Theme"
                      >
                        {item.label.slice(0, 2)}
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                        onClick={() => { sfx.pop(); setOpen(false); }}
                        className="glass glow-ring flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wide"
                        aria-label={item.label}
                      >
                        {item.label.slice(0, 2)}
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={open ? "Close menu" : "Open menu"}
        className="glass glow-ring grid h-14 w-14 touch-none place-items-center rounded-full text-xl"
      >
        {open ? "✕" : "◉"}
      </motion.button>
      <ThemeDrawer open={themeOpen} onOpenChange={setThemeOpen} />
    </div>
  );
}
