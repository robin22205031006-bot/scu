import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildUpdatePatch, filterGrounded, normalize, validEntityCategory, validLoreStatus } from "./lore-merge";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loreExtractionPrompt, loreJsonSchema, parseLoreExtraction } from "./lore-extraction";
import { isSuperadminEmail } from "./roles";
import { planLoreSync, type SyncInput } from "./adminLoreSync";

const kinds = ["character", "organization", "clan", "bloodline", "faction"] as const;

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string, email?: string | null) {
  if (isSuperadminEmail(email)) return;
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only the admin can do this.");
}

function claimEmail(claims: unknown): string | null {
  const email = (claims as { email?: unknown } | null | undefined)?.email;
  return typeof email === "string" ? email : null;
}

export const analyzeLore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(20).max(400_000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, claimEmail(context.claims));
    const { data: existing, error } = await context.supabase.from("entities").select("name, kind");
    if (error) throw new Error("The archive could not be loaded. Please try again.");
    const names = (existing ?? []).map((e) => `${e.name} (${e.kind})`).join("; ") || "none";

    const { generateGemini } = await import("./gemini.server");
    const raw = await generateGemini(process.env['GOOGLE_API_KEY'], {
      contents: [{ role: "user", parts: [{ text: `Existing archive entries: ${names}\n\nSTORY TEXT:\n${data.text}` }] }],
      config: {
        systemInstruction: loreExtractionPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: loreJsonSchema,
      },
    });
    try {
      return parseLoreExtraction(raw, data.text);
    } catch {
      throw new Error("Gemini returned invalid lore data. Nothing was saved; analyze the PDF again.");
    }
  });

const applySchema = z.object({
  filename: z.string().max(300),
  source_text: z.string().min(20).max(400_000),
  new_entities: z.array(
    z.object({
      kind: z.enum(kinds),
      name: z.string(),
      alias: z.string().nullish().transform((v) => v ?? null),
      role: z.string().nullish().transform((v) => v ?? null),
      status: z.string().nullish().transform((v) => v ?? null),
      category: z.string().nullish().transform((v) => v ?? null),
      description: z.string().optional().default(""),
      quote: z.string().optional().default(""),
    }),
  ),
  updates: z.array(
    z.object({
      existing_name: z.string(),
      new_facts: z.string().optional().default(""),
      status: z.string().nullish().transform((v) => v ?? null),
      quote: z.string().optional().default(""),
    }),
  ),
  events: z.array(
    z.object({
      title: z.string(),
      era: z.string().nullish().transform((v) => v ?? null),
      description: z.string().optional().default(""),
      quote: z.string().optional().default(""),
    }),
  ),
});

export const applyLore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => applySchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId, claimEmail(context.claims));
    const src = data.filename;
    const grounded = filterGrounded(data, data.source_text);
    if (grounded.new_entities.length !== data.new_entities.length || grounded.updates.length !== data.updates.length || grounded.events.length !== data.events.length) {
      throw new Error("Some selected lore is no longer supported by the PDF. Analyze it again.");
    }
    const archive = await sb.from("entities").select("id, name, kind, status, locked_fields");
    if (archive.error) throw new Error("The archive could not be loaded. Nothing was saved.");
    const byName = new Map<string, NonNullable<typeof archive.data>>();
    for (const entry of archive.data ?? []) {
      const key = normalize(entry.name);
      byName.set(key, [...(byName.get(key) ?? []), entry]);
    }
    const find = (name: string) => {
      const matches = byName.get(normalize(name)) ?? [];
      if (matches.length > 1) throw new Error(`Multiple entries named ${name}. Resolve them before importing.`);
      return matches[0];
    };
    const checked = <T,>(result: { data: T; error: unknown }) => {
      if (result.error) {
        const detail =
          typeof result.error === "object" && result.error !== null && "message" in result.error
            ? String((result.error as { message: unknown }).message)
            : String(result.error);
        console.error("[applyLore] write failed:", result.error);
        throw new Error(`The import could not finish: ${detail}. Some entries may have saved; review the archive before retrying.`);
      }
      return result.data;
    };
    // Resolve ambiguous names before performing any writes.
    for (const e of grounded.new_entities) find(e.name);
    for (const u of grounded.updates) find(u.existing_name);
    let created = 0, updated = 0, events = 0;

    for (const e of grounded.new_entities) {
      const dup = find(e.name);
      if (dup) {
        checked(await sb.from("lore_notes").insert({ entity_id: dup.id, text: e.description, source: src }));
        updated++;
        continue;
      }
      const isChar = e.kind === "character";
      const entry = checked(await sb.from("entities").insert({
        kind: e.kind,
        name: e.name,
        alias: e.alias,
        role: e.role,
        status: validLoreStatus(e.kind, e.status) ?? (isChar ? "Alive" : "Active"),
        category: validEntityCategory(e.kind, e.category ?? null),
        description: e.description,
        image_url: null,
      }).select("id, name, kind, status, locked_fields").single());
      if (entry) byName.set(normalize(entry.name), [entry]);
      created++;
    }

    for (const u of grounded.updates) {
      const target = find(u.existing_name);
      if (!target) throw new Error(`The entry ${u.existing_name} no longer exists. Some entries may have saved; review the archive before retrying.`);
      if (u.new_facts.trim()) checked(await sb.from("lore_notes").insert({ entity_id: target.id, text: u.new_facts, source: src }));
      const patch = buildUpdatePatch(target, u);
      if (Object.keys(patch).length) checked(await sb.from("entities").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", target.id));
      updated++;
    }

    const last = checked(await sb.from("timeline_events").select("sort_order").order("sort_order", { ascending: false }).limit(1));
    let order = last?.[0]?.sort_order ?? 0;
    for (const ev of grounded.events) {
      checked(await sb.from("timeline_events").insert({
        title: ev.title, era: ev.era, description: ev.description, source: src, sort_order: ++order,
      }));
      events++;
    }

    checked(await sb.from("ingest_jobs").insert({ filename: src, summary: { created, updated, events } }));
    return { created, updated, events };
  });

const consolidatedEntity = z.object({
  kind: z.enum(kinds),
  name: z.string(),
  alias: z.string().nullish().transform((v) => v ?? null),
  role: z.string().nullish().transform((v) => v ?? null),
  status: z.string().nullish().transform((v) => v ?? null),
  category: z.string().nullish().transform((v) => v ?? null),
  description: z.string().optional().default(""),
  quote: z.string().optional().default(""),
  sources: z.array(z.string()).optional(),
  conflicts: z.array(z.string()).optional(),
});
const consolidatedUpdate = z.object({
  existing_name: z.string(),
  new_facts: z.string().optional().default(""),
  status: z.string().nullish().transform((v) => v ?? null),
  quote: z.string().optional().default(""),
  source: z.string().optional(),
});
const consolidatedEvent = z.object({
  title: z.string(),
  era: z.string().nullish().transform((v) => v ?? null),
  description: z.string().optional().default(""),
  quote: z.string().optional().default(""),
  sources: z.array(z.string()).optional(),
});

/**
 * Bulk-sync the consolidated lore-export JSON (entities/updates/events already
 * grounded per-file by lore-batch.mjs) through the non-destructive planLoreSync
 * planner: inserts new entities, appends lore_notes for known names, patches only
 * unlocked status fields, and appends timeline events.
 */
export const syncLoreExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entities: z.array(consolidatedEntity),
        updates: z.array(consolidatedUpdate).default([]),
        events: z.array(consolidatedEvent).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId, claimEmail(context.claims));

    const archive = await sb.from("entities").select("id, name, kind, status, category, locked_fields");
    if (archive.error) throw new Error("The archive could not be loaded. Nothing was saved.");
    const last = await sb.from("timeline_events").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    if (last.error) throw new Error("The timeline could not be loaded. Nothing was saved.");

    // Group items by PDF source so lore_notes keep their provenance.
    const groups = new Map<string, SyncInput>();
    const groupFor = (source: string) => {
      let g = groups.get(source);
      if (!g) {
        g = { source, new_entities: [], updates: [], events: [] };
        groups.set(source, g);
      }
      return g;
    };
    for (const e of data.entities) {
      groupFor((e.sources ?? []).join("; ") || "lore-export").new_entities.push({
        kind: e.kind, name: e.name, alias: e.alias, role: e.role, status: e.status, description: e.description, quote: e.quote,
        ...(e.category ? { category: e.category } : {}),
        ...(e.conflicts ? { conflicts: e.conflicts } : {}),
      });
    }
    for (const u of data.updates) {
      groupFor(u.source ?? "lore-export").updates.push({
        existing_name: u.existing_name, new_facts: u.new_facts, status: u.status, quote: u.quote,
      });
    }
    for (const ev of data.events) {
      groupFor((ev.sources ?? []).join("; ") || "lore-export").events.push({
        title: ev.title, era: ev.era, description: ev.description, quote: ev.quote,
      });
    }

    const plan = planLoreSync(
      (archive.data ?? []).map((e) => ({ ...e, locked_fields: e.locked_fields ?? [] })),
      [...groups.values()],
      last.data?.[0]?.sort_order ?? 0,
    );

    const checked = <T,>(result: { data: T; error: unknown }, label = "write") => {
      if (result.error) {
        const detail =
          typeof result.error === "object" && result.error !== null && "message" in result.error
            ? String((result.error as { message: unknown }).message)
            : String(result.error);
        console.error(`[syncLoreExport] ${label} failed:`, result.error);
        throw new Error(`The sync could not finish (${label}): ${detail}. Some entries may have saved; review the archive before retrying.`);
      }
      return result.data;
    };

    for (const ins of plan.entityInserts) {
      const inserted = checked(await sb.from("entities").insert({
        kind: ins.kind, name: ins.name, alias: ins.alias, role: ins.role,
        status: ins.status ?? (ins.kind === "character" ? "Alive" : "Active"),
        category: ins.category,
        description: ins.description, image_url: ins.image_url,
      }).select("id").single(), `entity insert '${ins.name}'`);
      if (!inserted) throw new Error(`The sync could not finish (entity insert '${ins.name}'). Some entries may have saved; review the archive before retrying.`);
      for (const note of ins.notes) {
        checked(await sb.from("lore_notes").insert({ entity_id: inserted.id, text: note, source: ins.source }), `conflict note for '${ins.name}'`);
      }
    }
    for (const note of plan.loreNoteInserts) checked(await sb.from("lore_notes").insert(note), `lore note for entity ${note.entity_id}`);
    for (const upd of plan.entityUpdates) {
      checked(await sb.from("entities").update({ ...upd.patch, updated_at: new Date().toISOString() }).eq("id", upd.id), `entity update ${upd.id}`);
    }
    for (const ev of plan.timelineInserts) {
      checked(await sb.from("timeline_events").insert({
        title: ev.title, era: ev.era, description: ev.description, source: ev.source, sort_order: ev.sort_order,
      }), `timeline event '${ev.title}'`);
    }

    const summary = {
      created: plan.entityInserts.length,
      notes: plan.loreNoteInserts.length,
      updated: plan.entityUpdates.length,
      events: plan.timelineInserts.length,
      warnings: plan.warnings,
    };
    checked(await sb.from("ingest_jobs").insert({ filename: "lore-export batch", summary }), "ingest_jobs insert");
    return summary;
  });
