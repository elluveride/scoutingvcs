import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import {
  assertEventCode, groupByTeam, latestPerMatch, summarizeAlliance, toolError, toolResult,
  type MatchRow,
} from "../scouting";

export default defineTool({
  name: "predict_match",
  title: "Predict a match",
  description:
    "Predict the score of a match between two alliances using the team's own scouting data. Returns per-alliance totals, a confidence percentage, and a per-team breakdown. Teams with no scouting data contribute zero and lower the confidence.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP."),
    red_teams: z.array(z.number().int().min(1).max(99999)).min(1).max(3)
      .describe("Red alliance team numbers."),
    blue_teams: z.array(z.number().int().min(1).max(99999)).min(1).max(3)
      .describe("Blue alliance team numbers."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code, red_teams, blue_teams }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    const teams = [...new Set([...red_teams, ...blue_teams])];
    const { data, error } = await supabase
      .from("match_entries")
      .select("*")
      .eq("event_code", eventCode)
      .in("team_number", teams);
    if (error) return toolError(error.message);

    const byTeam = groupByTeam(latestPerMatch((data ?? []) as MatchRow[]));
    const red = summarizeAlliance(red_teams, byTeam);
    const blue = summarizeAlliance(blue_teams, byTeam);

    return toolResult({
      event_code: eventCode,
      red,
      blue,
      favored:
        red.predicted_total === blue.predicted_total
          ? "even"
          : red.predicted_total > blue.predicted_total
            ? "red"
            : "blue",
      margin: Math.round(Math.abs(red.predicted_total - blue.predicted_total) * 10) / 10,
      caveat:
        red.teams_with_data + blue.teams_with_data < teams.length
          ? "Some teams have no scouting data and were counted as zero."
          : undefined,
    });
  },
});
