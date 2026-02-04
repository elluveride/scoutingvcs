import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";

interface TeamRanking {
  rank: number;
  teamNumber: number;
  displayTeamNumber: string;
  teamName: string;
  sortOrder1: number;
  sortOrder2: number;
  sortOrder3: number;
  sortOrder4: number;
  sortOrder5: number;
  sortOrder6: number;
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
  alliances: AllianceScore[];
}

interface AllianceScore {
  alliance: string;
  totalPoints: number;
  autoPoints: number;
  dcPoints: number;
  endgamePoints: number;
  penaltyPoints: number;
}

interface FTCScoresResponse {
  matchScores: MatchScore[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      console.error("FTC API credentials not configured");
      return new Response(
        JSON.stringify({ error: "FTC API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Basic Auth header
    const authString = btoa(`${FTC_USERNAME}:${FTC_TOKEN}`);
    
    // Get the current season from the FTC API if not specified
    let ftcSeason = season;
    if (!ftcSeason) {
      const apiIndexUrl = `${FTC_API_BASE}`;
      console.log(`Fetching FTC API index to get current season: ${apiIndexUrl}`);
      
      const indexResponse = await fetch(apiIndexUrl, {
        headers: {
          "Authorization": `Basic ${authString}`,
          "Accept": "application/json",
        },
      });
      
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        ftcSeason = indexData.currentSeason;
        console.log(`Using current season from FTC API: ${ftcSeason}`);
      } else {
        // Fallback to calculated season if API index fails
        const now = new Date();
        const currentYear = now.getFullYear();
        ftcSeason = now.getMonth() >= 8 ? currentYear : currentYear - 1;
        console.log(`Fallback to calculated season: ${ftcSeason}`);
      }
    }

    // Fetch rankings
    const rankingsUrl = `${FTC_API_BASE}/${ftcSeason}/rankings/${eventCode}`;
    console.log(`Fetching FTC rankings: ${rankingsUrl}`);
    
    const rankingsResponse = await fetch(rankingsUrl, {
      headers: {
        "Authorization": `Basic ${authString}`,
        "Accept": "application/json",
      },
    });

    // Check if we got HTML instead of JSON (error page)
    const contentType = rankingsResponse.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await rankingsResponse.text();
      console.error(`FTC API returned non-JSON response: ${text.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ 
          error: `FTC API returned invalid response (status ${rankingsResponse.status})`,
          hint: "Check if the event code is correct and rankings are published"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rankingsResponse.ok) {
      const errorData = await rankingsResponse.json();
      console.error(`FTC API error: ${rankingsResponse.status}`, errorData);
      return new Response(
        JSON.stringify({ 
          error: `FTC API error: ${rankingsResponse.status}`,
          details: errorData 
        }),
        { status: rankingsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rankingsData: FTCRankingsResponse = await rankingsResponse.json();
    console.log(`Fetched ${rankingsData.rankings?.length || 0} team rankings for ${eventCode}`);

    // Optionally fetch match scores for detailed breakdown
    let matchScores: MatchScore[] = [];
    if (includeScores) {
      const scoresUrl = `${FTC_API_BASE}/${ftcSeason}/scores/${eventCode}/qual`;
      console.log(`Fetching FTC scores: ${scoresUrl}`);
      
      const scoresResponse = await fetch(scoresUrl, {
        headers: {
          "Authorization": `Basic ${authString}`,
          "Accept": "application/json",
        },
      });

      if (scoresResponse.ok) {
        const scoresContentType = scoresResponse.headers.get("content-type") || "";
        if (scoresContentType.includes("application/json")) {
          const scoresData: FTCScoresResponse = await scoresResponse.json();
          matchScores = scoresData.matchScores || [];
          console.log(`Fetched ${matchScores.length} match scores`);
        }
      }
    }

    // Transform rankings into a more usable format
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
      // Sort orders vary by season but typically:
      // sortOrder1 = RP, sortOrder2 = TBP, sortOrder3 = Auto points, etc.
      rankingPoints: r.sortOrder1,
      tieBreaker1: r.sortOrder2,
      tieBreaker2: r.sortOrder3,
    }));

    return new Response(
      JSON.stringify({ 
        rankings,
        matchScores,
        season: ftcSeason,
        eventCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ftc-rankings function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
