import { COMBAT_STATS, type CombatStats } from "@/lib/combat-stats";

const CX = 110;
const CY = 105;
const R = 78;

function point(i: number, value: number) {
  const angle = (Math.PI * 2 * i) / COMBAT_STATS.length - Math.PI / 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * R;
  return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
}

function ringPath(scale: number) {
  return COMBAT_STATS.map((_, i) => {
    const p = point(i, 100 * scale);
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function seriesPath(stats: CombatStats) {
  return COMBAT_STATS.map((s, i) => {
    const p = point(i, stats[s.key]);
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ") + " Z";
}

const SERIES_COLORS = ["#fb4d6d", "#f5b942"] as const;

/**
 * Cinematic radar chart for the five canonical combat stats.
 * `a` renders crimson, optional `b` renders gold — used for comparisons.
 */
export function StatRadar({
  a,
  b,
  nameA,
  nameB,
  size = 220,
}: {
  a: CombatStats;
  b?: CombatStats;
  nameA?: string;
  nameB?: string;
  size?: number;
}) {
  const labelR = R + 20;
  return (
    <div className="grid justify-items-center gap-2">
      <svg viewBox="0 0 220 215" width={size} height={size * (215 / 220)} role="img" aria-label="Combat stats radar">
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <path key={s} d={ringPath(s)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={s === 1 ? 1.2 : 0.7} />
        ))}
        {COMBAT_STATS.map((_, i) => {
          const p = point(i, 100);
          return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.07)" strokeWidth={0.7} />;
        })}
        {b && (
          <path d={seriesPath(b)} fill={SERIES_COLORS[1]} fillOpacity={0.12} stroke={SERIES_COLORS[1]} strokeWidth={1.6} strokeLinejoin="round" />
        )}
        <path d={seriesPath(a)} fill={SERIES_COLORS[0]} fillOpacity={0.16} stroke={SERIES_COLORS[0]} strokeWidth={2} strokeLinejoin="round" />
        {COMBAT_STATS.map((s, i) => {
          const p = point(i, 100);
          const lp = {
            x: CX + Math.cos((Math.PI * 2 * i) / COMBAT_STATS.length - Math.PI / 2) * labelR,
            y: CY + Math.sin((Math.PI * 2 * i) / COMBAT_STATS.length - Math.PI / 2) * labelR,
          };
          return (
            <text
              key={s.key}
              x={lp.x}
              y={lp.y}
              textAnchor={lp.x > CX + 4 ? "start" : lp.x < CX - 4 ? "end" : "middle"}
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={8.5}
              letterSpacing={0.6}
            >
              {s.label.toUpperCase()}
            </text>
          );
        })}
        {COMBAT_STATS.map((s, i) => {
          const v = a[s.key];
          const p = point(i, v);
          return (
            <circle key={s.key} cx={p.x} cy={p.y} r={2.4} fill={SERIES_COLORS[0]}>
              <title>{`${s.label}: ${v}`}</title>
            </circle>
          );
        })}
      </svg>
      {(nameA || nameB) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-widest">
          {nameA && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[0] }} />{nameA}
            </span>
          )}
          {nameB && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[1] }} />{nameB}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
