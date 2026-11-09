import { abilityDef, type AbilityTier } from "@/lib/abilities";

const TIER_RANK: Record<AbilityTier, number> = {
  Mythic: 7, Legendary: 6, Rare: 5, Exceptional: 4, Unique: 3, Ancient: 2, Standard: 1, Role: 0,
};

/** Compact ability badge with registry color/icon and tier tooltip. */
export function AbilityBadge({ name, className = "" }: { name: string; className?: string }) {
  const def = abilityDef(name);
  const Icon = def.icon;
  const mythic = def.tier === "Mythic";
  const legendary = def.tier === "Legendary";
  const rarePlus = def.tier === "Rare" || def.tier === "Exceptional" || def.tier === "Unique";
  const ancient = def.tier === "Ancient";
  const title = `${def.label} — ${def.tier}${def.group === "beast" ? " · Beast trait" : ""}${def.description ? `\n${def.description}` : ""}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${mythic ? "animate-pulse" : ""} ${className}`}
      style={{
        color: def.color,
        borderColor: mythic ? "#ff2d2d" : `${def.color}66`,
        background: mythic
          ? "linear-gradient(90deg, #ff2d2d33, #7c3aed33)"
          : legendary
            ? `linear-gradient(90deg, ${def.color}30, #d4af3730)`
            : rarePlus
              ? `${def.color}1f`
              : ancient
                ? `${def.color}1a`
                : `${def.color}14`,
        boxShadow: mythic
          ? `0 0 10px #ff2d2daa, 0 0 22px #ff2d2d55, inset 0 0 6px #ff2d2d33`
          : legendary
            ? `0 0 10px ${def.color}55, 0 0 20px #d4af3733`
            : rarePlus
              ? `0 0 7px ${def.color}40`
              : ancient
                ? `0 0 5px ${def.color}26`
                : undefined,
      }}
    >
      <Icon className="h-3 w-3" style={{ color: def.color }} />
      {def.label}
    </span>
  );
}

/** Row of ability badges: top N featured + "+X more" expander. */
export function AbilityBadgeRow({ abilities, max = 3 }: { abilities: string[]; max?: number }) {
  if (!abilities.length) return null;
  const shown = abilities.slice(0, max);
  const rest = abilities.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((a) => <AbilityBadge key={a} name={a} />)}
      {rest > 0 && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          +{rest} more
        </span>
      )}
    </div>
  );
}

export { TIER_RANK };
