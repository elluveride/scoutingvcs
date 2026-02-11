import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate the caller - only admins can trigger sync
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const FTC_USERNAME = Deno.env.get("FTC_API_USERNAME");
    const FTC_TOKEN = Deno.env.get("FTC_API_TOKEN");

    if (!FTC_USERNAME || !FTC_TOKEN) {
      console.error("FTC API credentials not configured");
      return new Response(
        JSON.stringify({ error: "FTC API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authString = btoa(`${FTC_USERNAME}:${FTC_TOKEN}`);

    // 1. Get current season
    console.log("Fetching current season from FTC API...");
    const indexRes = await fetch(FTC_API_BASE, {
      headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
    });

    let currentSeason: number;
    if (indexRes.ok) {
      const indexData = await indexRes.json();
      currentSeason = indexData.currentSeason;
      console.log(`Current season: ${currentSeason}`);
    } else {
      const now = new Date();
      currentSeason = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      console.log(`Fallback season: ${currentSeason}`);
    }

    // 2. Fetch ALL events for the season
    console.log(`Fetching all events for season ${currentSeason}...`);
    const eventsRes = await fetch(`${FTC_API_BASE}/${currentSeason}/events`, {
      headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" },
    });

    if (!eventsRes.ok) {
      const errText = await eventsRes.text();
      console.error(`Failed to fetch events: ${eventsRes.status} - ${errText}`);
      return new Response(
        JSON.stringify({ error: `FTC API error: ${eventsRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventsData = await eventsRes.json();
    const allEvents = eventsData.events || [];
    console.log(`Found ${allEvents.length} events for season ${currentSeason}`);

    // 3. Get unique team numbers from profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('team_number')
      .not('team_number', 'is', null);

    const uniqueTeams = [...new Set(
      (profiles || []).map((p: { team_number: number | null }) => p.team_number).filter(Boolean)
    )] as number[];
    console.log(`Found ${uniqueTeams.length} unique teams in profiles: ${uniqueTeams.join(', ')}`);

    // 4. For each unique team, fetch their events to build team_numbers mapping
    const teamEventMap = new Map<string, number[]>();

    for (const teamNum of uniqueTeams) {
      try {
        const teamEventsRes = await fetch(
          `${FTC_API_BASE}/${currentSeason}/events?teamNumber=${teamNum}`,
          { headers: { "Authorization": `Basic ${authString}`, "Accept": "application/json" } }
        );

        if (teamEventsRes.ok) {
          const contentType = teamEventsRes.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const teamEventsData = await teamEventsRes.json();
            for (const event of teamEventsData.events || []) {
              const existing = teamEventMap.get(event.code) || [];
              if (!existing.includes(teamNum)) {
                existing.push(teamNum);
              }
              teamEventMap.set(event.code, existing);
            }
            console.log(`Team ${teamNum}: ${(teamEventsData.events || []).length} events`);
          }
        }
      } catch (err) {
        console.error(`Error fetching events for team ${teamNum}:`, err);
      }
    }

    // 5. Upsert all events into cache
    const today = new Date().toISOString().split('T')[0];
    const eventsToCache = allEvents.map((e: {
      code: string;
      name: string;
      dateStart: string;
      dateEnd: string;
      city?: string;
      stateProv?: string;
      country?: string;
    }) => ({
      code: e.code,
      name: e.name,
      date_start: e.dateStart?.split('T')[0] || e.dateStart,
      date_end: e.dateEnd?.split('T')[0] || e.dateEnd,
      season: currentSeason,
      team_numbers: JSON.stringify(teamEventMap.get(e.code) || []),
      city: e.city || null,
      state_prov: e.stateProv || null,
      country: e.country || null,
      last_synced: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 100
    let upsertedCount = 0;
    for (let i = 0; i < eventsToCache.length; i += 100) {
      const chunk = eventsToCache.slice(i, i + 100);
      const { error: upsertError } = await supabase
        .from('ftc_events_cache')
        .upsert(chunk, { onConflict: 'code' });

      if (upsertError) {
        console.error(`Upsert error (batch ${i / 100}):`, upsertError);
      } else {
        upsertedCount += chunk.length;
      }
    }
    console.log(`Upserted ${upsertedCount} events into cache`);

    // 6. Auto-create active events in the events table (date_start <= today <= date_end)
    const activeEvents = eventsToCache.filter(
      (e: { date_start: string; date_end: string }) => e.date_start <= today && e.date_end >= today
    );
    console.log(`${activeEvents.length} events are active today`);

    let createdCount = 0;
    for (const event of activeEvents) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('events')
        .select('code')
        .eq('code', event.code)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('events')
          .insert({ code: event.code, name: event.name });

        if (insertError) {
          console.error(`Error creating event ${event.code}:`, insertError.message);
        } else {
          createdCount++;
          console.log(`Auto-created event: ${event.code} - ${event.name}`);
        }
      }
    }

    const result = {
      season: currentSeason,
      totalCached: upsertedCount,
      activeToday: activeEvents.length,
      autoCreated: createdCount,
      teamsChecked: uniqueTeams,
    };

    console.log("Sync complete:", JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ftc-events-sync:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
