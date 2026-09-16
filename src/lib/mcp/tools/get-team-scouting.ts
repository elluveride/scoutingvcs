import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import {
  assertEventCode, compactMatch, compactTeamStats, latestPerMatch, predictFor,
  compactPrediction, seasonForEvent, toolError, toolResult, type MatchRow,
} from "../scouting";

export default defineTool({
  name: "get_team_scouting",
  title: "Get team scouting data",
  description:
    "Return every match scouting entry and the pit scouting record for one FTC team at one event, " +
    "with per-match and average point totals priced using the event's own season rules.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP or 2025USAZCMP."),
    team_number: z.number().int().describe("FTC team number, e.g. 12841."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code, team_number }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let eventCode: string;
    try {
      eventCode = assertEventCode(event_code);
    } catch (e) {
      return toolError(e instanceof Error ? e.message : "Invalid event code");
    }

    // The season is a property of the event, so an agent's numbers match the
    // team's screens rather than whatever this process defaults to.
    const season = await seasonForEvent(supabase, eventCode);

    const [matchRes, pitRes] = await Promise.all([
      supabase
        .from("match_entries")
        .select("*")
        .eq("event_code", eventCode)
        .eq("team_number", team_number)
        .order("match_number"),
      supabase
        .from("pit_entries")
        .select("*")
        .eq("event_code", eventCode)
        .eq("team_number", team_number)
        .maybeSingle(),
    ]);

    if (matchRes.error) return toolError(matchRes.error.message);

    // Agree with the Dashboard: one entry per match, newest wins.
    const matches = latestPerMatch((matchRes.data ?? []) as MatchRow[]);

    const payload = {
      team_number,
      event_code: eventCode,
      season: season.id,
      season_name: season.name,
      averages: compactTeamStats(season, team_number, matches),
      prediction: compactPrediction(predictFor(team_number, matches, season.id)),
      matches: matches.map((m) => compactMatch(season, m)),
      pit: pitRes.data ?? null,
    };
    return toolResult(payload);
  },
});
