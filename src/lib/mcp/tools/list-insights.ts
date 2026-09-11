import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import { assertEventCode, toolError, toolResult } from "../scouting";

export default defineTool({
  name: "list_insights",
  title: "List insights on the Pit Display",
  description:
    "Read the insights already posted to the team's Pit Display for an event, newest first. Check this before recording a new insight so you do not repeat one that is already up.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP."),
    team_number: z.number().int().min(1).max(99999).optional()
      .describe("Only insights about this team."),
    limit: z.number().int().min(1).max(200).optional().describe("How many to return. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code, team_number, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    let query = supabase
      .from("agent_results")
      .select("id, team_number, match_label, kind, title, summary, payload, confidence, client_name, created_at, expires_at")
      .eq("event_code", eventCode)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (team_number !== undefined) query = query.eq("team_number", team_number);

    const { data, error } = await query;
    if (error) return toolError(error.message);

    const now = Date.now();
    const insights = (data ?? []).filter(
      (r) => !r.expires_at || new Date(r.expires_at).getTime() > now,
    );

    return toolResult({ event_code: eventCode, count: insights.length, insights });
  },
});
