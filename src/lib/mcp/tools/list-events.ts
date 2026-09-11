import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "List scouting events",
  description: "List the FTC events visible to the signed-in scout, newest first.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .select("code, name, start_date, end_date, location")
      .order("start_date", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
