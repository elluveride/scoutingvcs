import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated } from "../supabase";
import { toolError, toolResult } from "../scouting";

export default defineTool({
  name: "list_events",
  title: "List scouting events",
  description:
    "List the FTC events visible to the signed-in scout, newest first, with dates and location where known.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    // `events` only stores code/name/archived/created_at. Dates, location and the
    // registered team list live in `ftc_events_cache`, keyed by the same code.
    const { data: events, error } = await supabase
      .from("events")
      .select("code, name, created_at")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return toolError(error.message);

    const codes = (events ?? []).map((e) => e.code);
    const { data: cache } = codes.length
      ? await supabase
          .from("ftc_events_cache")
          .select("code, date_start, date_end, city, state_prov, country, team_numbers")
          .in("code", codes)
      : { data: [] as never[] };

    const today = new Date().toISOString().slice(0, 10);
    const eventList = (events ?? []).map((e) => {
      const c = (cache ?? []).find((x) => x.code === e.code);
      const teams = Array.isArray(c?.team_numbers) ? c.team_numbers : [];
      return {
        event_code: e.code,
        name: e.name,
        date_start: c?.date_start ?? null,
        date_end: c?.date_end ?? null,
        location: c ? [c.city, c.state_prov, c.country].filter(Boolean).join(", ") || null : null,
        registered_teams: teams.length || null,
        is_live: !!(c?.date_start && c?.date_end && c.date_start <= today && today <= c.date_end),
      };
    });

    return toolResult({ events: eventList });
  },
});
