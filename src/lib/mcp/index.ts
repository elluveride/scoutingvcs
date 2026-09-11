import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import listEventTeamsTool from "./tools/list-event-teams";
import getTeamScoutingTool from "./tools/get-team-scouting";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "decode-scout-hub",
  title: "DECODE Scout Hub",
  version: "0.1.0",
  instructions:
    "FTC scouting tools for Apex Scout. Use `list_events` to find an event code, `list_event_teams` to rank the scouted teams at that event, and `get_team_scouting` for one team's match and pit data. All data is scoped to the signed-in scout's team permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEventsTool, listEventTeamsTool, getTeamScoutingTool],
});
