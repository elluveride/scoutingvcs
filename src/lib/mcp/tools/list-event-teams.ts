import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import {
  assertEventCode, compactTeamStats, groupByTeam, latestPerMatch, seasonForEvent,
  toolError, toolResult, type MatchRow,
} from "../scouting";

export default defineTool({
  name: "list_event_teams",
  title: "List scouted teams at an event",
  description:
    "List every team that has scouting data at an event, with how many matches were scouted and " +
    "their average points, priced using the event's own season rules.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP or 2025USAZCMP."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    const season = await seasonForEvent(supabase, eventCode);

    // `select("*")` rather than a fixed column list: which columns carry the
    // score depends on the season, and the shaping happens in compactTeamStats.
    const { data, error } = await supabase
      .from("match_entries")
      .select("*")
      .eq("event_code", eventCode);
    if (error) return toolError(error.message);

    const byTeam = groupByTeam(latestPerMatch((data ?? []) as MatchRow[]));
    const teams = [...byTeam.entries()]
      .map(([team, rows]) => compactTeamStats(season, team, rows))
      .sort((a, b) => b.avg_total_points - a.avg_total_points);

    return toolResult({ event_code: eventCode, season: season.id, teams });
  },
});
