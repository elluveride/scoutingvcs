import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NEXUS_BASE = "https://ftc.nexus/api/v1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { eventKey } = await req.json();
    if (!eventKey || typeof eventKey !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(eventKey)) {
      return new Response(JSON.stringify({ error: 'Valid eventKey is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const NEXUS_KEY = Deno.env.get('NEXUS_API_KEY');
    if (!NEXUS_KEY) {
      return new Response(JSON.stringify({ error: 'Nexus API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nexusHeaders = { 'Nexus-Api-Key': NEXUS_KEY, 'Accept': 'application/json' };

    // FTC API event codes lack year prefix, but Nexus keys often use "2024xxx" / "2025xxx".
    // Try the user-provided key plus common season-prefixed variants.
    const stripped = eventKey.replace(/^20\d{2}/, '');
    const year = new Date().getUTCFullYear();
    const variants = Array.from(new Set([
      eventKey,
      `${year}${stripped}`,
      `${year - 1}${stripped}`,
      `${year + 1}${stripped}`,
      stripped,
    ]));

    let statusResp: Response | null = null;
    let resolvedKey = eventKey;
    for (const key of variants) {
      const r = await fetch(`${NEXUS_BASE}/event/${encodeURIComponent(key)}`, { headers: nexusHeaders });
      if (r.status === 401 || r.status === 403) {
        return new Response(JSON.stringify({ error: 'Nexus API key rejected' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (r.ok) { statusResp = r; resolvedKey = key; break; }
      if (r.status !== 404) { statusResp = r; resolvedKey = key; break; }
    }

    if (!statusResp || statusResp.status === 404) {
      return new Response(JSON.stringify({ error: 'Event not found on Nexus. The event may not be using Nexus for queuing.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!statusResp.ok) {
      return new Response(JSON.stringify({ error: `Nexus API error: ${statusResp.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pitsResp = await fetch(`${NEXUS_BASE}/event/${encodeURIComponent(resolvedKey)}/pits`, { headers: nexusHeaders });
    const status = await statusResp.json();
    const pitAddresses = pitsResp.ok ? await pitsResp.json() : {};

    return new Response(JSON.stringify({ status, pitAddresses, eventKey: resolvedKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
