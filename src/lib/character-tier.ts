/** Character-level tier system — display names, glow colors, card VFX classes. */

export type CharacterTier = "Mythic" | "Angle" | "Guardian" | "Legendary" | "Heroic";

export const CHARACTER_TIERS: CharacterTier[] = ["Mythic", "Angle", "Guardian", "Legendary", "Heroic"];

export interface TierDef {
  label: string;
  color: string;
  /** CSS class applied to the card wrapper for the tier VFX. */
  vfxClass: string;
}

export const TIER_DEFS: Record<string, TierDef> = {
  Mythic: { label: "Mythic", color: "#ff0033", vfxClass: "tier-vfx-mythic" },
  Angle: { label: "Angle", color: "#ffd700", vfxClass: "tier-vfx-angle" },
  Angel: { label: "Angle", color: "#ffd700", vfxClass: "tier-vfx-angle" },
  Guardian: { label: "Guardian", color: "#0e7490", vfxClass: "tier-vfx-guardian" },
  Legendary: { label: "Legendary", color: "#d4af37", vfxClass: "tier-vfx-legendary" },
  Heroic: { label: "Heroic", color: "#22d3ee", vfxClass: "tier-vfx-heroic" },
};

export function tierDef(tier: string | null | undefined): TierDef | null {
  if (!tier) return null;
  return TIER_DEFS[tier] ?? TIER_DEFS[tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()] ?? null;
}

/** Admin-selectable animation styles for card overlays. */
export const ANIMATION_STYLES = ["", "aura-pulse", "embers", "void-rift", "holographic"] as const;
export type AnimationStyle = (typeof ANIMATION_STYLES)[number];

export const ANIMATION_LABELS: Record<string, string> = {
  "": "None",
  "aura-pulse": "Aura Pulse",
  embers: "Embers",
  "void-rift": "Void Rift",
  holographic: "Holographic",
};

export function animationClass(style: string | null | undefined): string {
  return style && (ANIMATION_STYLES as readonly string[]).includes(style) ? `anim-${style}` : "";
}
