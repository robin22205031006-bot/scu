import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_timeline",
  title: "List timeline",
  description: "List SCU timeline events in chronological order.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const { data, error } = await supabaseForUser(ctx).from("timeline_events").select("id, title, era, description").order("sort_order").limit(500);
    if (error) throw new ToolError(error.message);
    const events = (data ?? []).map((e) => ({ id: e.id, title: e.title, era: e.era, description: e.description }));
    return {
      content: [{ type: "text", text: events.map((e) => `${e.era ? e.era + " — " : ""}${e.title}`).join("\n") || "No events." }],
      structuredContent: { events },
    };
  },
});
