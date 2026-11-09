import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_entities",
  title: "List archive entries",
  description: "List SCU characters, organizations, clans, bloodlines or factions, optionally filtered by type or name.",
  inputSchema: {
    kind: z.enum(["character", "organization", "clan", "bloodline", "faction"]).optional().describe("Only this type of entry."),
    search: z.string().max(100).optional().describe("Part of a name to match."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, search }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("entities").select("id, kind, name, alias, role, status").order("name").limit(200);
    if (kind) q = q.eq("kind", kind);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((e) => ({ id: e.id, kind: e.kind, name: e.name, alias: e.alias, role: e.role, status: e.status }));
    return {
      content: [{ type: "text", text: rows.map((e) => `${e.id}: ${e.name} (${e.kind}, ${e.status})`).join("\n") || "No entries." }],
      structuredContent: { entities: rows },
    };
  },
});
