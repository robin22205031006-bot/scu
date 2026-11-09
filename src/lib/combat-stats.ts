import type { Entity } from "@/lib/entities";

export const COMBAT_STATS = [
  { key: "power", label: "Power" },
  { key: "agility", label: "Agility" },
  { key: "tactical_iq", label: "Tactical IQ" },
  { key: "clan_mastery", label: "Clan Mastery" },
  { key: "weapon_proficiency", label: "Weapon Proficiency" },
] as const;

export type CombatStatKey = (typeof COMBAT_STATS)[number]["key"];
export type CombatStats = Record<CombatStatKey, number>;

const KEY_SET = new Set<string>(COMBAT_STATS.map((s) => s.key));

/** "Tactical IQ" / "tactical-iq" / "tactical_iq" all normalize to tactical_iq. */
function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const ZERO: CombatStats = { power: 0, agility: 0, tactical_iq: 0, clan_mastery: 0, weapon_proficiency: 0 };

/**
 * Pulls the five canonical combat stats out of entities.stats (JSONB).
 * Accepts numbers or numeric strings under any casing/spacing of the labels.
 * Returns null when the entity has no combat stats at all.
 */
export function getCombatStats(stats: unknown): CombatStats | null {
  if (!stats || typeof stats !== "object") return null;
  const out: CombatStats = { ...ZERO };
  let found = false;
  for (const [k, v] of Object.entries(stats as Record<string, unknown>)) {
    const key = normalizeKey(k);
    if (!KEY_SET.has(key)) continue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      out[key as CombatStatKey] = Math.max(0, Math.min(100, Math.round(n)));
      found = true;
    }
  }
  return found ? out : null;
}

export function hasCombatStats(e: Pick<Entity, "stats">): boolean {
  const s = getCombatStats(e.stats);
  return !!s && COMBAT_STATS.some(({ key }) => s[key] > 0);
}

/** Splits parsed custom stats into { combat, custom } — canonical keys go to sliders. */
export function splitStats(raw: Record<string, unknown>): { combat: CombatStats; custom: Record<string, string> } {
  const combat = { ...ZERO };
  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = normalizeKey(k);
    const n = typeof v === "number" ? v : Number(v);
    if (KEY_SET.has(key) && Number.isFinite(n)) combat[key as CombatStatKey] = Math.max(0, Math.min(100, Math.round(n)));
    else custom[k] = String(v);
  }
  return { combat, custom };
}
