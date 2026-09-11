import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "get_team_scouting",
  title: "Get team scouting data",
  description:
    "Return every match scouting entry and the pit scouting record for one FTC team at one event, plus simple per-match averages.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP or 2025USAZCMP."),
    team_number: z.number().int().describe("FTC team number, e.g. 12841."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code, team_number }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [matchRes, pitRes] = await Promise.all([
      supabase
        .from("match_entries")
        .select("*")
        .eq("event_code", event_code)
        .eq("team_number", team_number)
        .order("match_number"),
      supabase
        .from("pit_entries")
        .select("*")
        .eq("event_code", event_code)
        .eq("team_number", team_number)
        .maybeSingle(),
    ]);

    if (matchRes.error) return { content: [{ type: "text", text: matchRes.error.message }], isError: true };

    const matches = matchRes.data ?? [];
    const n = matches.length;
    const mean = (pick: (m: Record<string, number>) => number) =>
      n === 0 ? 0 : Math.round((matches.reduce((s, m) => s + pick(m as never), 0) / n) * 100) / 100;

    const averages = {
      matches_scouted: n,
      auto_scored: mean((m) => (m.auto_scored_close ?? 0) + (m.auto_scored_far ?? 0)),
      teleop_scored: mean((m) => (m.teleop_scored_close ?? 0) + (m.teleop_scored_far ?? 0)),
      defense_rating: mean((m) => m.defense_rating ?? 0),
    };

    const payload = { team_number, event_code, averages, matches, pit: pitRes.data ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
