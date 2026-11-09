import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_lore_note",
  title: "Add lore note",
  description: "Append a lore note to an archive entry's dossier (admin only).",
  inputSchema: {
    id: z.string().uuid().describe("Entry id from list_entities."),
    text: z.string().min(1).max(5000).describe("The lore to append."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, text }, ctx) => {
    const { error } = await supabaseForUser(ctx).from("lore_notes").insert({ entity_id: id, text, source: "Agent" });
    if (error) throw new ToolError("Could not add the note — only the admin can edit the archive.");
    return { content: [{ type: "text", text: "Lore note added." }] };
  },
});
