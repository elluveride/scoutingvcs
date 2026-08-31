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

    // Event codes are sometimes stored with a season prefix (e.g. "2025USAZCMP").
    // The FTC API expects the bare code plus a season path segment, so try both.
    const rawCode = String(eventCode).trim();
    const prefixMatch = rawCode.match(/^(\d{4})(.+)$/);
    const strippedCode = prefixMatch ? prefixMatch[2] : rawCode;
    const prefixSeason = prefixMatch ? Number(prefixMatch[1]) : null;
    let resolvedCode = rawCode;

    const candidates: { season: number | string; code: string }[] = [];
    const push = (s: number | string, c: string) => {
      if (!candidates.some((x) => x.season === s && x.code === c)) candidates.push({ season: s, code: c });
    };
    if (prefixSeason) {
      push(prefixSeason, strippedCode);
      push(ftcSeason, strippedCode);
      push(prefixSeason - 1, strippedCode);
    }
    push(ftcSeason, rawCode);
    push(Number(ftcSeason) - 1, rawCode);

    let rankingsResponse: Response | null = null;
    let lastStatus = 404;
    for (const c of candidates) {
      const resp = await fetch(`${FTC_API_BASE}/${c.season}/rankings/${c.code}`, {
        headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
      });
      const ct = resp.headers.get("content-type") || "";
      if (resp.ok && ct.includes("application/json")) {
        rankingsResponse = resp;
        ftcSeason = c.season;
        resolvedCode = c.code;
        break;
      }
      lastStatus = resp.status;
    }

    if (!rankingsResponse) {
      return new Response(
        JSON.stringify({
          error: `FTC API error: ${lastStatus}`,
          hint: `No rankings found for event "${rawCode}". Check the event code and that qualification rankings are published.`,
          rankings: [],
          matchScores: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rankingsData: FTCRankingsResponse = await rankingsResponse.json();

    let matchScores: MatchScore[] = [];
    if (includeScores) {
      const scoresUrl = `${FTC_API_BASE}/${ftcSeason}/scores/${resolvedCode}/qual`;
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
