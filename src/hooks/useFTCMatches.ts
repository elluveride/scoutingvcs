import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEvent } from '@/contexts/EventContext';

interface MatchPosition {
  teamNumber: number;
  position: string; // "B1", "B2", "R1", "R2"
  surrogate: boolean;
}

export interface MatchData {
  matchNumber: number;
  description?: string;
  positions: MatchPosition[];
  /** Epoch ms from the official FTC schedule, when available */
  scheduledStartTime?: number | null;
  actualStartTime?: number | null;
  postResultTime?: number | null;
  scoreRedFinal?: number | null;
  scoreBlueFinal?: number | null;
  /** True once FIRST has posted the official result for this match */
  played?: boolean;
}


interface UseFTCMatchesResult {
  matches: MatchData[];
  loading: boolean;
  error: string | null;
  refetch: (matchType: 'Q' | 'P') => Promise<void>;
}

export function useFTCMatches(): UseFTCMatchesResult {
  const { currentEvent } = useEvent();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async (matchType: 'Q' | 'P' = 'Q') => {
    if (!currentEvent?.code) {
      setError('No event selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ftc-matches', {
        body: {
          eventCode: currentEvent.code,
          matchType,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch matches');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setMatches(data.matches || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load match schedule';
      setError(message);
      console.error('FTC Matches error:', message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch qual matches on mount
  useEffect(() => {
    if (currentEvent?.code) {
      fetchMatches('Q');
    }
  }, [currentEvent?.code]);

  return {
    matches,
    loading,
    error,
    refetch: fetchMatches,
  };
}

export function getPositionLabel(position: string): string {
  const alliance = position.startsWith('B') ? 'Blue' : 'Red';
  const num = position.slice(1);
  return `${alliance} ${num}`;
}

export function getPositionColor(position: string): string {
  return position.startsWith('B') ? 'bg-accent' : 'bg-secondary';
}
