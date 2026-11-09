import { useMemo } from "react";

/**
 * Ambient tactical backdrop: a few slow-drifting glow orbs and rising ember
 * particles. Pure CSS transform/opacity animation — no JS per frame, no
 * layout thrash, safe behind all content (pointer-events: none).
 */
export function AmbientField() {
  // Deterministic particle layout — stable across renders, no hydration drift.
  const embers = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 61 + 7) % 100}%`,
        size: 2 + ((i * 13) % 3),
        duration: 14 + ((i * 7) % 18),
        delay: -((i * 5) % 20),
        drift: `${((i * 29) % 120) - 60}px`,
        opacity: 0.25 + ((i * 11) % 40) / 100,
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep crimson / amber glow orbs */}
      <div className="scu-orb scu-orb-a" />
      <div className="scu-orb scu-orb-b" />
      <div className="scu-orb scu-orb-c" />
      {/* Rising embers */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="scu-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            ["--ember-x" as string]: e.drift,
            ["--ember-o" as string]: e.opacity,
          }}
        />
      ))}
    </div>
  );
}
