import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_event_teams",
  title: "List scouted teams at an event",
  description:
    "List every team that has scouting data at an event, with how many matches were scouted and their average scored game pieces.",
  inputSchema: {
    event_code: z.string().trim().describe("Event code, e.g. USAZCMP or 2025USAZCMP."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("match_entries")
      .select(
        "team_number, auto_scored_close, auto_scored_far, teleop_scored_close, teleop_scored_far, defense_rating",
      )
      .eq("event_code", event_code);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const byTeam = new Map<number, { n: number; auto: number; teleop: number; defense: number }>();
    for (const row of data ?? []) {
      const r = row as Record<string, number>;
      const agg = byTeam.get(r.team_number) ?? { n: 0, auto: 0, teleop: 0, defense: 0 };
      agg.n += 1;
      agg.auto += (r.auto_scored_close ?? 0) + (r.auto_scored_far ?? 0);
      agg.teleop += (r.teleop_scored_close ?? 0) + (r.teleop_scored_far ?? 0);
      agg.defense += r.defense_rating ?? 0;
      byTeam.set(r.team_number, agg);
    }

    const round = (v: number) => Math.round(v * 100) / 100;
    const teams = [...byTeam.entries()]
      .map(([team_number, a]) => ({
        team_number,
        matches_scouted: a.n,
        avg_auto: round(a.auto / a.n),
        avg_teleop: round(a.teleop / a.n),
        avg_defense: round(a.defense / a.n),
      }))
      .sort((a, b) => b.avg_auto + b.avg_teleop - (a.avg_auto + a.avg_teleop));

    return {
      content: [{ type: "text", text: JSON.stringify(teams) }],
      structuredContent: { event_code, teams },
    };
  },
});
