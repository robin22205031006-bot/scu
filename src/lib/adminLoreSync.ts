import {
  buildUpdatePatch,
  mergeLocks,
  normalize,
  validEntityCategory,
  validLoreStatus,
  type EntityKind,
  type ProposedEntity,
  type ProposedEvent,
  type ProposedUpdate,
} from "./lore-merge";
import { isSuperadminEmail } from "./roles";

/**
 * Non-destructive lore synchronization planner.
 *
 * Turns extracted lore (see lore-export/*.json produced by scripts/lore-batch.mjs)
 * into a write plan that NEVER overwrites admin-edited fields:
 *  - entities are matched by normalized exact name (duplicates abort the plan),
 *  - existing entries only receive `status` patches for fields not in `locked_fields`,
 *  - new facts for existing entries are appended as `lore_notes`, never merged into
 *    `description`,
 *  - new entities are plain inserts with no image_url/category/stats.
 *
 * Execution must go through an authenticated server function guarded by
 * `assertAdmin` (src/lib/ingest.functions.ts) or `assertRoleManager`
 * (src/lib/roles.functions.ts); both already treat zananrobin@gmail.com as Superadmin.
 */

export interface ArchiveEntity {
  id: string;
  name: string;
  kind?: EntityKind;
  status: string;
  category?: string | null;
  locked_fields: string[];
}

export interface SyncPlan {
  entityInserts: Array<{
    kind: EntityKind;
    name: string;
    alias: string | null;
    role: string | null;
    status: string | null;
    category: string | null;
    description: string;
    image_url: null;
    source: string;
    /** Conflict flags to store as lore_notes once the entity id exists. */
    notes: string[];
  }>;
  loreNoteInserts: Array<{ entity_id: string; text: string; source: string }>;
  entityUpdates: Array<{ id: string; patch: Record<string, string>; locked_fields?: string[] }>;
  timelineInserts: Array<{ title: string; era: string | null; description: string; source: string; sort_order: number }>;
  /** Non-blocking notices: alias redirects, stub creations, merges. */
  warnings: string[];
}

/** Historical/variant names → canonical entity name (normalized keys). */
const ALIAS_MAP: Record<string, string> = {
  "khalid ibn kharif": "khalid",
  "khalid ibn sharif": "khalid",
  "khalid el mansur": "khalid",
  "alt ethan": "ethan",
  "ethan thorne": "ethan",
  "elizah": "ethan",
  "robin": "ethan",
  "zaynab al-ahd": "issabela",
  "zaynab": "issabela",
  "nasab ibn khalil": "ramiz",
  "alter david": "alt david",
  "ayman": "ayaan",
  "echan": "ethan",
};

export interface SyncInput {
  source: string;
  new_entities: ProposedEntity[];
  updates: ProposedUpdate[];
  events: ProposedEvent[];
}

/** Superadmin (or any admin role) may run a sync; callers should still enforce server-side. */
export function canSyncLore(email: string | null | undefined, roles: string[]): boolean {
  return isSuperadminEmail(email) || roles.includes("admin");
}

export function planLoreSync(archive: ArchiveEntity[], inputs: SyncInput[], lastSortOrder = 0): SyncPlan {
  const plan: SyncPlan = { entityInserts: [], loreNoteInserts: [], entityUpdates: [], timelineInserts: [], warnings: [] };
  const byName = new Map<string, ArchiveEntity[]>();
  for (const entry of archive) {
    const key = normalize(entry.name);
    byName.set(key, [...(byName.get(key) ?? []), entry]);
  }
  const find = (name: string) => {
    const matches = byName.get(normalize(name)) ?? [];
    if (matches.length > 1) throw new Error(`Multiple entries named ${name}. Resolve them before importing.`);
    return matches[0];
  };
  /** Resolve a referenced name: direct → alias map → canonical lookup. */
  const resolveRef = (name: string): { entity?: ArchiveEntity; via?: string } => {
    const direct = find(name);
    if (direct) return { entity: direct };
    const canon = ALIAS_MAP[normalize(name)];
    if (canon) {
      const target = find(canon);
      if (target) {
        plan.warnings.push(`[Auto-Merged]: Redirected reference from '${name}' to canonical entity '${target.name}'`);
        return { entity: target, via: name };
      }
    }
    return {};
  };

  // Resolve ambiguous names before planning any writes.
  for (const input of inputs) {
    for (const e of input.new_entities) find(e.name);
    for (const u of input.updates) find(u.existing_name);
  }

  let order = lastSortOrder;
  // Three passes across all inputs: entities are always planned before updates
  // and events, so a base entity defined in one source can satisfy references
  // from another source regardless of group ordering.
  for (const input of inputs) {
    const src = input.source;

    for (const e of input.new_entities) {
      const conflictNotes = (e.conflicts ?? []).map((c) => `[conflict] ${c}`);
      let dup = find(e.name);
      if (!dup) {
        const canon = ALIAS_MAP[normalize(e.name)];
        const aliased = canon ? find(canon) : undefined;
        if (aliased && !aliased.id.startsWith("pending:")) {
          plan.warnings.push(`[Auto-Merged]: Redirected new entity '${e.name}' to canonical entity '${aliased.name}'`);
          plan.loreNoteInserts.push({ entity_id: aliased.id, text: e.description, source: src });
          for (const c of conflictNotes) plan.loreNoteInserts.push({ entity_id: aliased.id, text: c, source: src });
          continue;
        }
      }
      if (dup) {
        if (dup.id.startsWith("pending:")) {
          // Same name inserted earlier in this plan: fold facts into that insert.
          const pendingInsert = plan.entityInserts.find((i) => normalize(i.name) === normalize(e.name));
          if (pendingInsert) {
            if (e.description && !pendingInsert.description.includes(e.description)) {
              pendingInsert.description = `${pendingInsert.description} ${e.description}`.trim();
            }
            if (e.kind !== pendingInsert.kind) {
              pendingInsert.notes.push(`[conflict] kind: kept '${pendingInsert.kind}' but also extracted as '${e.kind}'`);
            }
            const eCat = validEntityCategory(e.kind, e.category);
            if (eCat && pendingInsert.category && eCat !== pendingInsert.category) {
              pendingInsert.notes.push(`[conflict] category: kept '${pendingInsert.category}' but also extracted as '${eCat}'`);
            }
            pendingInsert.notes.push(...conflictNotes);
          }
          continue;
        }
        // Name already archived: keep the entry, append the new facts as a note.
        plan.loreNoteInserts.push({ entity_id: dup.id, text: e.description, source: src });
        if (dup.kind && e.kind !== dup.kind) {
          plan.loreNoteInserts.push({ entity_id: dup.id, text: `[conflict] kind: archived '${dup.kind}' vs extracted '${e.kind}'`, source: src });
        }
        const eCat = validEntityCategory(e.kind, e.category);
        if (eCat && dup.category && eCat !== dup.category) {
          plan.loreNoteInserts.push({ entity_id: dup.id, text: `[conflict] category: archived '${dup.category}' vs extracted '${eCat}'`, source: src });
        }
        for (const c of conflictNotes) plan.loreNoteInserts.push({ entity_id: dup.id, text: c, source: src });
        continue;
      }
      const isChar = e.kind === "character";
      plan.entityInserts.push({
        kind: e.kind,
        name: e.name,
        alias: e.alias,
        role: e.role,
        status: validLoreStatus(e.kind, e.status) ?? (isChar ? "Alive" : "Active"),
        category: validEntityCategory(e.kind, e.category),
        description: e.description,
        image_url: null,
        source: src,
        notes: conflictNotes,
      });
      byName.set(normalize(e.name), [
        { id: `pending:${normalize(e.name)}`, name: e.name, kind: e.kind, status: plan.entityInserts.at(-1)!.status ?? "", category: plan.entityInserts.at(-1)!.category, locked_fields: [] },
      ]);
    }
  }

  for (const input of inputs) {
    const src = input.source;
    for (const u of input.updates) {
      let target = find(u.existing_name);
      if (!target) {
        const resolved = resolveRef(u.existing_name);
        if (resolved.entity) {
          target = resolved.entity;
          u.existing_name = target.name;
        } else {
          // Unknown reference: create a light stub instead of aborting the sync.
          const stubName = u.existing_name;
          plan.entityInserts.push({
            kind: "character", name: stubName, alias: null, role: "Unclassified", status: "Alive",
            category: "Support", description: "", image_url: null, source: src,
            notes: [`[Auto-Stub]: created placeholder for unresolved sync reference '${stubName}'`],
          });
          byName.set(normalize(stubName), [
            { id: `pending:${normalize(stubName)}`, name: stubName, kind: "character", status: "Alive", category: "Support", locked_fields: [] },
          ]);
          plan.warnings.push(`[Auto-Stub]: Created placeholder entity '${stubName}' — no alias mapping or archive match found`);
          target = find(stubName);
        }
      }
      if (!target) throw new Error(`The entry ${u.existing_name} could not be resolved.`);
      const pendingInsert = plan.entityInserts.find((i) => normalize(i.name) === normalize(target.name));
      if (u.new_facts.trim() && !target.id.startsWith("pending:")) {
        plan.loreNoteInserts.push({ entity_id: target.id, text: u.new_facts, source: src });
      } else if (u.new_facts.trim() && pendingInsert) {
        pendingInsert.description = `${pendingInsert.description} ${u.new_facts}`.trim();
      }
      const patch = buildUpdatePatch(target, u);
      const extractedStatus = validLoreStatus(target.kind ?? "character", u.status);
      if (extractedStatus && extractedStatus !== target.status) {
        const note = `[conflict] status: archived '${target.status}' vs extracted '${extractedStatus}'`;
        if (pendingInsert) pendingInsert.notes.push(note);
        else plan.loreNoteInserts.push({ entity_id: target.id, text: note, source: src });
      }
      if (Object.keys(patch).length === 0) continue;
      // If this entity was inserted earlier in the same plan, fold the patch into the insert.
      if (pendingInsert) {
        if (patch["status"]) pendingInsert.status = patch["status"];
        continue;
      }
      plan.entityUpdates.push({ id: target.id, patch });
    }
  }

  for (const input of inputs) {
    const src = input.source;
    for (const ev of input.events) {
      plan.timelineInserts.push({
        title: ev.title,
        era: ev.era,
        description: ev.description,
        source: src,
        sort_order: ++order,
      });
    }
  }
  return plan;
}

/** Re-exported so callers can extend locked_fields after admin edits. */
export { mergeLocks };
