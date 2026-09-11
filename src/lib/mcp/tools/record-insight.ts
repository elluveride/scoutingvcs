import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import { assertEventCode, toolError, toolResult } from "../scouting";

/**
 * The write half of the integration: whatever an agent records here lands in
 * `agent_results`, which the Pit Display subscribes to over Supabase Realtime.
 * A recorded insight shows up on the team's screen within a second or two, with
 * no refresh — that is the "real MCP results auto-sync" path.
 */
export default defineTool({
  name: "record_insight",
  title: "Post an insight to the Pit Display",
  description:
    "Publish a finding to the team's live Pit Display, where everyone on the team sees it within seconds. Use it for scouting conclusions worth acting on: a matchup warning, a pick-list observation, a robot that broke. Keep the title short and make the summary actionable. Do not use it for chat or acknowledgements.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP."),
    title: z.string().trim().min(1).max(120).describe("Short headline, e.g. 'Team 254 auto is unreliable'."),
    summary: z.string().trim().min(1).max(2000)
      .describe("Plain text: what you found, why it matters, and what to do about it."),
    team_number: z.number().int().min(1).max(99999).optional()
      .describe("Team the insight is about, if it is about one team."),
    match_label: z.string().trim().max(32).optional().describe("Match it refers to, e.g. Q-12."),
    kind: z.enum(["insight", "prediction", "alert", "note"]).optional()
      .describe("How it is shown. 'alert' is highlighted. Default 'insight'."),
    confidence: z.number().int().min(0).max(100).optional()
      .describe("How sure you are, 0-100. Shown next to the insight."),
    payload: z.record(z.unknown()).optional()
      .describe("Optional structured numbers to display alongside the summary."),
    ttl_minutes: z.number().int().min(1).max(10080).optional()
      .describe("Hide the insight automatically after this many minutes. Default: keep until dismissed."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(input.event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    // `getUserId()` is the verified `sub` from the bearer token, so it needs no
    // round-trip and cannot be spoofed by the client.
    const userId = ctx.getUserId();
    if (!userId) return toolError("Could not identify the signed-in scout.");

    const payload = input.payload ?? {};
    if (JSON.stringify(payload).length > 8000) {
      return toolError("payload is too large (8 KB maximum).");
    }

    const { data, error } = await supabase
      .from("agent_results")
      .insert({
        event_code: eventCode,
        team_number: input.team_number ?? null,
        match_label: input.match_label ?? null,
        kind: input.kind ?? "insight",
        title: input.title,
        summary: input.summary,
        payload,
        confidence: input.confidence ?? null,
        created_by: userId,
        // `ctx.client.info` is what the client says about itself: display only.
        client_name: ctx.client?.info?.name ?? null,
        client_id: ctx.getClientId() ?? null,
        expires_at: input.ttl_minutes
          ? new Date(Date.now() + input.ttl_minutes * 60_000).toISOString()
          : null,
      })
      .select("id, created_at")
      .single();

    if (error) return toolError(error.message);

    return toolResult({
      ok: true,
      id: data.id,
      created_at: data.created_at,
      note: "Visible now on the team's Pit Display under Agent Insights.",
    });
  },
});
