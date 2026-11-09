// Bulk-push the consolidated lore export into Supabase using the service-role key.
// Mirrors src/lib/adminLoreSync.ts (planLoreSync) + src/lib/lore-merge.ts semantics:
//   - entities matched by normalized exact name; ambiguous names abort the plan
//   - existing names get lore_notes (never overwrite description)
//   - only `status` is patched, and never when locked_fields contains "status"
//   - timeline events are appended after the current max sort_order
// Usage: node lore-push.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(DIR, "public", "lore-export");
const DRY_RUN = process.argv.includes("--dry-run");

// --- minimal .env loader ---
for (const line of fs.readFileSync(path.join(DIR, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
// New sb_secret_ keys are opaque, not bearer JWTs — strip Authorization like client.server.ts does.
const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
const adminFetch = (input, init) => {
  const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
  headers.set("apikey", key);
  return fetch(input, { ...init, headers });
};
const sb = createClient(url, key, {
  global: { fetch: adminFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- lore-merge.ts ports ---
const normalize = (s) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const ENTITY_KINDS = ["character", "organization", "clan", "bloodline", "faction"];
function validLoreStatus(kind, status) {
  const allowed = kind === "character" ? ["Alive", "Dead", "Retired", "Missing", "Legend"] : ["Active", "Inactive"];
  return status && allowed.includes(status) ? status : null;
}
const CHARACTER_CATEGORIES = ["Protagonist", "Antagonist", "Anti-Hero", "Anti-Villain", "Support"];
const GROUP_CATEGORIES = ["Faction", "Black Ops Team", "Clan", "Organization", "Cult", "Bloodline"];
function validEntityCategory(kind, category) {
  const allowed = kind === "character" ? CHARACTER_CATEGORIES : GROUP_CATEGORIES;
  return category && allowed.includes(category) ? category : null;
}
function buildUpdatePatch(target, update) {
  const patch = {};
  const status = validLoreStatus(target.kind ?? "character", update.status);
  if (status && !(target.locked_fields ?? []).includes("status") && status !== target.status) patch.status = status;
  return patch;
}

// --- adminLoreSync.ts port: planLoreSync ---
function planLoreSync(archive, inputs, lastSortOrder = 0) {
  const plan = { entityInserts: [], loreNoteInserts: [], entityUpdates: [], timelineInserts: [] };
  const byName = new Map();
  for (const entry of archive) {
    const k = normalize(entry.name);
    byName.set(k, [...(byName.get(k) ?? []), entry]);
  }
  const find = (name) => {
    const matches = byName.get(normalize(name)) ?? [];
    if (matches.length > 1) throw new Error(`Multiple entries named ${name}. Resolve them before importing.`);
    return matches[0];
  };
  for (const input of inputs) {
    for (const e of input.new_entities) find(e.name);
    for (const u of input.updates) find(u.existing_name);
  }
  let order = lastSortOrder;
  // Three passes: entities first, then updates, then events (mirrors adminLoreSync.ts).
  for (const input of inputs) {
    const src = input.source;
    for (const e of input.new_entities) {
      const dup = find(e.name);
      const conflictNotes = (e.conflicts ?? []).map((c) => `[conflict] ${c}`);
      if (dup) {
        if (dup.id.startsWith("pending:")) {
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
        kind: e.kind, name: e.name, alias: e.alias, role: e.role,
        status: validLoreStatus(e.kind, e.status) ?? (isChar ? "Alive" : "Active"),
        category: validEntityCategory(e.kind, e.category),
        description: e.description, image_url: null,
        source: src, notes: conflictNotes,
      });
      byName.set(normalize(e.name), [
        { id: `pending:${normalize(e.name)}`, name: e.name, kind: e.kind, status: plan.entityInserts.at(-1).status, category: plan.entityInserts.at(-1).category, locked_fields: [] },
      ]);
    }
  }
  for (const input of inputs) {
    const src = input.source;
    for (const u of input.updates) {
      const target = find(u.existing_name);
      if (!target) throw new Error(`The entry ${u.existing_name} no longer exists.`);
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
      if (pendingInsert) {
        if (patch.status) pendingInsert.status = patch.status;
        continue;
      }
      plan.entityUpdates.push({ id: target.id, patch });
    }
  }
  for (const input of inputs) {
    const src = input.source;
    for (const ev of input.events) {
      plan.timelineInserts.push({ title: ev.title, era: ev.era, description: ev.description, source: src, sort_order: ++order });
    }
  }
  return plan;
}

async function main() {
  const [entities, updates, events] = ["entities.json", "updates.json", "timeline_events.json"].map((f) =>
    JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, f), "utf8")),
  );
  for (const e of entities) if (!ENTITY_KINDS.includes(e.kind)) throw new Error(`Bad kind on entity ${e.name}: ${e.kind}`);

  const { data: archive, error: aErr } = await sb.from("entities").select("id, name, kind, status, category, locked_fields");
  if (aErr) throw new Error(`Failed to load entities: ${aErr.message}`);
  const { data: lastRow, error: tErr } = await sb.from("timeline_events").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (tErr) throw new Error(`Failed to load timeline: ${tErr.message}`);

  // Group by PDF source for lore_notes provenance (same as syncLoreExport).
  const groups = new Map();
  const groupFor = (source) => {
    if (!groups.has(source)) groups.set(source, { source, new_entities: [], updates: [], events: [] });
    return groups.get(source);
  };
  for (const e of entities) {
    groupFor((e.sources ?? []).join("; ") || "lore-export").new_entities.push({
      kind: e.kind, name: e.name, alias: e.alias, role: e.role, status: e.status, description: e.description, quote: e.quote ?? "",
      ...(e.category ? { category: e.category } : {}),
      conflicts: e.conflicts,
    });
  }
  for (const u of updates) {
    groupFor(u.source ?? "lore-export").updates.push({
      existing_name: u.existing_name, new_facts: u.new_facts, status: u.status, quote: u.quote ?? "",
    });
  }
  for (const ev of events) {
    groupFor((ev.sources ?? []).join("; ") || "lore-export").events.push({
      title: ev.title, era: ev.era, description: ev.description, quote: ev.quote ?? "",
    });
  }

  const plan = planLoreSync(
    (archive ?? []).map((e) => ({ ...e, locked_fields: e.locked_fields ?? [] })),
    [...groups.values()],
    lastRow?.[0]?.sort_order ?? 0,
  );

  console.log(`Plan: ${plan.entityInserts.length} inserts, ${plan.loreNoteInserts.length} lore notes, ${plan.entityUpdates.length} updates, ${plan.timelineInserts.length} timeline events`);
  if (DRY_RUN) {
    console.log("Dry run — no writes. Sample inserts:", plan.entityInserts.slice(0, 5).map((i) => i.name));
    return;
  }

  const errors = [];
  const run = async (label, rows, fn) => {
    for (let i = 0; i < rows.length; i++) {
      const { error } = await fn(rows[i]);
      if (error) errors.push(`${label}[${i}] ${error.message}`);
      if ((i + 1) % 25 === 0) console.log(`  ${label}: ${i + 1}/${rows.length}`);
    }
  };

  await run("entities", plan.entityInserts, async (r) => {
    const { data: inserted, error } = await sb.from("entities").insert({
      kind: r.kind, name: r.name, alias: r.alias, role: r.role, status: r.status,
      category: r.category, description: r.description, image_url: r.image_url,
    }).select("id").single();
    if (error) return { error };
    for (const note of r.notes) {
      const { error: nErr } = await sb.from("lore_notes").insert({ entity_id: inserted.id, text: note, source: r.source });
      if (nErr) return { error: nErr };
    }
    return { error: null };
  });
  await run("lore_notes", plan.loreNoteInserts, (r) => sb.from("lore_notes").insert(r));
  await run("entity_updates", plan.entityUpdates, (r) =>
    sb.from("entities").update({ ...r.patch, updated_at: new Date().toISOString() }).eq("id", r.id),
  );
  await run("timeline_events", plan.timelineInserts, (r) =>
    sb.from("timeline_events").insert({ title: r.title, era: r.era, description: r.description, source: r.source, sort_order: r.sort_order }),
  );

  const summary = {
    created: plan.entityInserts.length, notes: plan.loreNoteInserts.length,
    updated: plan.entityUpdates.length, events: plan.timelineInserts.length,
    errors: errors.length,
  };
  const { error: jobErr } = await sb.from("ingest_jobs").insert({ filename: "lore-export batch (script)", summary });
  if (jobErr) console.warn("ingest_jobs insert failed:", jobErr.message);

  console.log(`Done. ${JSON.stringify(summary)}`);
  if (errors.length) {
    console.log("First errors:");
    errors.slice(0, 20).forEach((e) => console.log("  " + e));
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
