import { useEffect, useRef } from "react";

/**
 * Slim tactical scroll-progress bar pinned to the top of the viewport.
 * Updates via transform only (scaleX) inside requestAnimationFrame — no
 * React re-renders, no layout work, 60fps-safe on mobile.
 */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = bar.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        ref={bar}
        className="h-full w-full origin-left bg-accent"
        style={{ boxShadow: "0 0 8px 1px color-mix(in oklab, var(--accent) 70%, transparent)", transform: "scaleX(0)" }}
      />
    </div>
  );
}
