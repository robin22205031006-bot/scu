// Pure helpers for PDF lore ingestion: grounding checks and safe merging.

export type EntityKind = "character" | "organization" | "clan" | "bloodline" | "faction";

export function validLoreStatus(kind: EntityKind, status: string | null): string | null {
  const allowed = kind === "character"
    ? ["Alive", "Dead", "Retired", "Missing", "Legend"]
    : ["Active", "Inactive"];
  return status && allowed.includes(status) ? status : null;
}

export const CHARACTER_CATEGORIES = ["Protagonist", "Antagonist", "Anti-Hero", "Anti-Villain", "Support"];
export const GROUP_CATEGORIES = ["Faction", "Black Ops Team", "Clan", "Organization", "Cult", "Bloodline"];

export function validEntityCategory(_kind: EntityKind, category: string | null | undefined): string | null {
  // Category is a free-text "sector": standard archetypes and admin-defined
  // custom tiers are all accepted; only blank values are rejected.
  const c = category?.trim();
  return c ? c : null;
}

export interface ProposedEntity {
  kind: EntityKind;
  name: string;
  alias: string | null;
  role: string | null;
  status: string | null;
  description: string;
  quote: string;
  category?: string | null | undefined;
  /** Non-destructive conflict flags collected during consolidation (kind/status/role divergences). */
  conflicts?: string[];
}

export interface ProposedUpdate {
  existing_name: string;
  new_facts: string;
  status: string | null;
  quote: string;
}

export interface ProposedEvent {
  title: string;
  era: string | null;
  description: string;
  quote: string;
}

export interface Extraction {
  new_entities: ProposedEntity[];
  updates: ProposedUpdate[];
  events: ProposedEvent[];
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();

/** True only if the quote literally appears in the source text. */
export function isGrounded(quote: string, sourceNorm: string): boolean {
  const q = normalize(quote);
  return q.length >= 8 && sourceNorm.includes(q);
}

/** Drop anything whose quote or name isn't literally in the PDF text. */
export function filterGrounded(ex: Extraction, source: string): Extraction {
  const src = normalize(source);
  return {
    new_entities: ex.new_entities.filter(
      (e) => normalize(e.name).length > 0 && isGrounded(e.quote, src) && src.includes(normalize(e.name)),
    ).map((e) => ({ ...e, status: validLoreStatus(e.kind, e.status), category: validEntityCategory(e.kind, e.category) })),
    updates: ex.updates.filter(
      (u) => normalize(u.existing_name).length > 0 && isGrounded(u.quote, src) && src.includes(normalize(u.existing_name)),
    ),
    events: ex.events.filter((e) => isGrounded(e.quote, src)),
  };
}

export interface MergeTarget {
  kind?: EntityKind;
  status: string;
  locked_fields: string[];
}

/** Returns the patch to apply to an existing entity; never touches locked fields. */
export function buildUpdatePatch(target: MergeTarget, update: ProposedUpdate): Record<string, string> {
  const patch: Record<string, string> = {};
  const status = validLoreStatus(target.kind ?? "character", update.status);
  if (status && !target.locked_fields.includes("status") && status !== target.status) {
    patch["status"] = status;
  }
  return patch;
}

/** Edited fields become locked so later PDFs never overwrite them. */
export function mergeLocks(existing: string[], changed: string[]): string[] {
  return Array.from(new Set([...existing, ...changed]));
}
