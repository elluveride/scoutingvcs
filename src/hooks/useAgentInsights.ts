import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AgentInsight = Tables<'agent_results'>;

interface Options {
  /** Max rows to keep (newest first). */
  limit?: number;
  /** Fallback poll interval in ms (realtime is primary). 0 disables. */
  pollMs?: number;
}

/**
 * Live feed of `agent_results` for an event. Rows are inserted by MCP agents
 * through the `record_insight` tool; this hook keeps the Pit Display in sync
 * via Supabase Realtime, with a slow poll as a safety net for dropped sockets.
 */
export function useAgentInsights(eventCode: string | null | undefined, opts: Options = {}) {
  const limit = opts.limit ?? 50;
  const pollMs = opts.pollMs ?? 60_000;
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!eventCode) {
      setInsights([]);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('agent_results')
      .select('*')
      .eq('event_code', eventCode)
      .order('created_at', { ascending: false })
      .limit(limit);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    const now = Date.now();
    const rows = (data || []).filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
    seen.current = new Set(rows.map((r) => r.id));
    setInsights(rows);
    setLastSync(now);
  }, [eventCode, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription (RLS applies: only rows this user may see arrive).
  useEffect(() => {
    if (!eventCode) return;
    const channel = supabase
      .channel(`agent_results:${eventCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_results', filter: `event_code=eq.${eventCode}` },
        (payload) => {
          const row = payload.new as AgentInsight;
          if (!row?.id || seen.current.has(row.id)) return;
          if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return;
          seen.current.add(row.id);
          setInsights((prev) => [row, ...prev].slice(0, limit));
          setLastSync(Date.now());
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'agent_results' },
        (payload) => {
          const id = (payload.old as { id?: string })?.id;
          if (!id) return;
          seen.current.delete(id);
          setInsights((prev) => prev.filter((r) => r.id !== id));
        },
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });
    return () => {
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [eventCode, limit]);

  // Poll fallback + expiry sweep.
  useEffect(() => {
    if (!eventCode || pollMs <= 0) return;
    const id = setInterval(() => {
      refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [eventCode, pollMs, refresh]);

  const dismiss = useCallback(async (id: string) => {
    setInsights((prev) => prev.filter((r) => r.id !== id));
    seen.current.delete(id);
    const { error: err } = await supabase.from('agent_results').delete().eq('id', id);
    if (err) {
      // Not allowed (not author/admin) — put it back.
      refresh();
      return false;
    }
    return true;
  }, [refresh]);

  return { insights, loading, error, live, lastSync, refresh, dismiss };
}
