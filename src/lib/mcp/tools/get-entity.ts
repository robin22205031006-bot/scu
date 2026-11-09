import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_entity",
  title: "Get dossier",
  description: "Get the full dossier of one archive entry, including its lore notes.",
  inputSchema: { id: z.string().uuid().describe("Entry id from list_entities.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: e, error } = await sb.from("entities").select("id, kind, name, alias, role, status, description").eq("id", id).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!e) throw new ToolError("No entry with that id.");
    const { data: notes } = await sb.from("lore_notes").select("text, source").eq("entity_id", id).order("created_at");
    const dossier = { ...e, notes: (notes ?? []).map((n) => ({ text: n.text, source: n.source })) };
    return {
      content: [{ type: "text", text: `${e.name} — ${e.status}\n${e.description}\n${dossier.notes.map((n) => `• ${n.text}`).join("\n")}` }],
      structuredContent: { entity: dossier },
    };
  },
});
