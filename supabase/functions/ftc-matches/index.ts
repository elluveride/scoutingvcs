import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";

interface MatchTeam {
  teamNumber: number;
  station: string;
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller using getClaims (works with signing-keys)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      return new Response(
        JSON.stringify({ error: "FTC API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authString = btoa(`${FTC_USERNAME}:${FTC_TOKEN}`);
    
    let ftcSeason = season;
    if (!ftcSeason) {
      const indexResponse = await fetch(FTC_API_BASE, {
        headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
      });
      
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        ftcSeason = indexData.currentSeason;
      } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        ftcSeason = now.getMonth() >= 8 ? currentYear : currentYear - 1;
      }
    }
    
    const tournamentLevel = matchType === 'P' ? 'playoff' : 'qual';
    const scheduleUrl = `${FTC_API_BASE}/${ftcSeason}/schedule/${eventCode}/${tournamentLevel}/hybrid`;
    
    const response = await fetch(scheduleUrl, {
      headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
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
      return new Response(
        JSON.stringify({ error: `FTC API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: FTCScheduleResponse = await response.json();
    
    const matches = data.schedule.map((match) => {
      const positions = match.teams.map((team) => {
        const alliance = team.station.startsWith("Red") ? "R" : "B";
        const position = team.station.replace(/Red|Blue/, "");
        return {
          teamNumber: team.teamNumber,
          position: `${alliance}${position}`,
          surrogate: team.surrogate,
        };
      });

      return { matchNumber: match.matchNumber, positions };
    });

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
