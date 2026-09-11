import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import {
  assertEventCode, compactPrediction, groupByTeam, latestPerMatch, predictFor,
  toolError, toolResult, type MatchRow,
} from "../scouting";

export default defineTool({
  name: "rank_teams",
  title: "Rank scouted teams",
  description:
    "Rank every scouted team at an event by predicted total score, using the same prediction model the Pit Display uses. Good for building a pick list.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP."),
    limit: z.number().int().min(1).max(200).optional()
      .describe("How many teams to return. Default 50."),
    min_matches: z.number().int().min(0).max(50).optional()
      .describe("Only include teams with at least this many scouted matches. Default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code, limit, min_matches }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    const [matchRes, pitRes] = await Promise.all([
      supabase.from("match_entries").select("*").eq("event_code", eventCode),
      supabase.from("pit_entries").select("team_number, team_name").eq("event_code", eventCode),
    ]);
    if (matchRes.error) return toolError(matchRes.error.message);

    const names = new Map((pitRes.data ?? []).map((p) => [p.team_number, p.team_name]));
    const byTeam = groupByTeam(latestPerMatch((matchRes.data ?? []) as MatchRow[]));
    const floor = min_matches ?? 0;

    const ranking = [...byTeam.entries()]
      .map(([team, rows]) => ({ ...compactPrediction(predictFor(team, rows)), team_name: names.get(team) ?? null }))
      .filter((t) => t.matches_scouted >= floor)
      .sort((a, b) => b.predicted_total - a.predicted_total)
      .slice(0, limit ?? 50)
      .map((t, i) => ({ rank: i + 1, ...t }));

    return toolResult({ event_code: eventCode, teams_ranked: ranking.length, ranking });
  },
});
