import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import listEventTeamsTool from "./tools/list-event-teams";
import getTeamScoutingTool from "./tools/get-team-scouting";
import rankTeamsTool from "./tools/rank-teams";
import predictMatchTool from "./tools/predict-match";
import listInsightsTool from "./tools/list-insights";
import recordInsightTool from "./tools/record-insight";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "decode-scout-hub",
  title: "DECODE Scout Hub",
  version: "0.2.0",
  instructions: [
    "FTC scouting tools for Apex Scout. All data is scoped by the signed-in scout's team permissions;",
    "you only ever see what that scout can see in the app.",
    "",
    "Typical flow: `list_events` to find an event code, then `list_event_teams` or `rank_teams` to see who is",
    "worth picking, `get_team_scouting` for one team's raw match and pit data, and `predict_match` to compare",
    "two alliances before a match.",
    "",
    "`record_insight` posts a finding to the team's live Pit Display, where the drive team sees it within seconds.",
    "Use it when you have a conclusion worth acting on, not for chatter. Call `list_insights` first so you do not",
    "repeat something already on screen.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listEventsTool,
    listEventTeamsTool,
    getTeamScoutingTool,
    rankTeamsTool,
    predictMatchTool,
    listInsightsTool,
    recordInsightTool,
  ],
});
