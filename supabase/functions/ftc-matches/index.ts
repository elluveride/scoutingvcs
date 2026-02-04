import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";

interface MatchTeam {
  teamNumber: number;
  station: string; // "Red1", "Red2", "Blue1", "Blue2"
  surrogate: boolean;
}

interface FTCMatch {
  matchNumber: number;
  teams: MatchTeam[];
}

interface FTCScheduleResponse {
  schedule: FTCMatch[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { eventCode, season, matchType } = await req.json();

    if (!eventCode) {
      return new Response(
        JSON.stringify({ error: "eventCode is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FTC_USERNAME = Deno.env.get("FTC_API_USERNAME");
    const FTC_TOKEN = Deno.env.get("FTC_API_TOKEN");

    if (!FTC_USERNAME || !FTC_TOKEN) {
      console.error("FTC API credentials not configured");
      return new Response(
        JSON.stringify({ error: "FTC API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Basic Auth header
    const authString = btoa(`${FTC_USERNAME}:${FTC_TOKEN}`);
    
    // FTC season is the year the season STARTS (e.g., 2024-2025 season = 2024)
    // If we're past September, use current year, otherwise use previous year
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultSeason = now.getMonth() >= 8 ? currentYear : currentYear - 1;
    const ftcSeason = season || defaultSeason;
    
    // Determine tournament level: qual or playoff (FTC API expects string values)
    const tournamentLevel = matchType === 'P' ? 'playoff' : 'qual';
    
    // Fetch schedule from FTC Events API
    const scheduleUrl = `${FTC_API_BASE}/${ftcSeason}/schedule/${eventCode}?tournamentLevel=${tournamentLevel}`;
    console.log(`Fetching FTC schedule: ${scheduleUrl}`);
    
    const response = await fetch(scheduleUrl, {
      headers: {
        "Authorization": `Basic ${authString}`,
        "Accept": "application/json",
      },
    });

    // Check if we got HTML instead of JSON (error page)
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`FTC API returned non-JSON response: ${text.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ 
          error: `FTC API returned invalid response (status ${response.status})`,
          hint: "Check if the event code is correct and the schedule is published"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`FTC API error: ${response.status}`, errorData);
      return new Response(
        JSON.stringify({ 
          error: `FTC API error: ${response.status}`,
          details: errorData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: FTCScheduleResponse = await response.json();
    
    // Transform the schedule into a more usable format
    // Each match will have positions like "B1", "B2", "R1", "R2"
    const matches = data.schedule.map((match) => {
      const positions = match.teams.map((team) => {
        // Convert "Red1" -> "R1", "Blue2" -> "B2", etc.
        const alliance = team.station.startsWith("Red") ? "R" : "B";
        const position = team.station.replace(/Red|Blue/, "");
        return {
          teamNumber: team.teamNumber,
          position: `${alliance}${position}`,
          surrogate: team.surrogate,
        };
      });

      return {
        matchNumber: match.matchNumber,
        positions,
      };
    });

    console.log(`Fetched ${matches.length} matches for ${eventCode}`);

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ftc-matches function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
