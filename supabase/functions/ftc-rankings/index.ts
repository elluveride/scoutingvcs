import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";

interface TeamRanking {
  rank: number;
  teamNumber: number;
  teamName: string;
  sortOrder1: number;
  sortOrder2: number;
  sortOrder3: number;
  wins: number;
  losses: number;
  ties: number;
  qualAverage: number;
  dq: number;
  matchesPlayed: number;
  matchesCounted: number;
}

interface FTCRankingsResponse {
  rankings: TeamRanking[];
}

interface MatchScore {
  matchNumber: number;
  matchLevel: string;
  alliances: { alliance: string; totalPoints: number; autoPoints: number; dcPoints: number; endgamePoints: number; penaltyPoints: number; }[];
}

interface FTCScoresResponse {
  matchScores: MatchScore[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { eventCode, season, includeScores } = await req.json();

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

    const rankingsUrl = `${FTC_API_BASE}/${ftcSeason}/rankings/${eventCode}`;
    const rankingsResponse = await fetch(rankingsUrl, {
      headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
    });

    const contentType = rankingsResponse.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ 
          error: `FTC API returned invalid response (status ${rankingsResponse.status})`,
          hint: "Check if the event code is correct and rankings are published"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rankingsResponse.ok) {
      return new Response(
        JSON.stringify({ error: `FTC API error: ${rankingsResponse.status}` }),
        { status: rankingsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rankingsData: FTCRankingsResponse = await rankingsResponse.json();

    let matchScores: MatchScore[] = [];
    if (includeScores) {
      const scoresUrl = `${FTC_API_BASE}/${ftcSeason}/scores/${eventCode}/qual`;
      const scoresResponse = await fetch(scoresUrl, {
        headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
      });

      if (scoresResponse.ok) {
        const scoresContentType = scoresResponse.headers.get("content-type") || "";
        if (scoresContentType.includes("application/json")) {
          const scoresData: FTCScoresResponse = await scoresResponse.json();
          matchScores = scoresData.matchScores || [];
        }
      }
    }

    const rankings = (rankingsData.rankings || []).map((r) => ({
      rank: r.rank,
      teamNumber: r.teamNumber,
      teamName: r.teamName || `Team ${r.teamNumber}`,
      wins: r.wins,
      losses: r.losses,
      ties: r.ties,
      qualAverage: r.qualAverage,
      matchesPlayed: r.matchesPlayed,
      matchesCounted: r.matchesCounted,
      dq: r.dq,
      rankingPoints: r.sortOrder1,
      tieBreaker1: r.sortOrder2,
      tieBreaker2: r.sortOrder3,
    }));

    return new Response(
      JSON.stringify({ rankings, matchScores, season: ftcSeason, eventCode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
