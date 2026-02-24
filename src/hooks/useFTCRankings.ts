import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEvent } from '@/contexts/EventContext';
import { useToast } from '@/hooks/use-toast';

export interface TeamRanking {
  rank: number;
  teamNumber: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  qualAverage: number;
  matchesPlayed: number;
  matchesCounted: number;
  dq: number;
  rankingPoints: number;
  tieBreaker1: number;
  tieBreaker2: number;
}

export interface MatchScore {
  matchNumber: number;
  matchLevel: string;
  alliances: {
    alliance: string;
    totalPoints: number;
    autoPoints: number;
    dcPoints: number;
    endgamePoints: number;
    penaltyPoints: number;
  }[];
}

interface UseFTCRankingsResult {
  rankings: TeamRanking[];
  matchScores: MatchScore[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getRankForTeam: (teamNumber: number) => number | null;
  getRecordForTeam: (teamNumber: number) => { wins: number; losses: number; ties: number } | null;
  getTeamName: (teamNumber: number) => string | null;
}

export function useFTCRankings(includeScores = false): UseFTCRankingsResult {
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    if (!currentEvent?.code) {
      setError('No event selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ftc-rankings', {
        body: {
          eventCode: currentEvent.code,
          includeScores,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch rankings');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setRankings(data.rankings || []);
      setMatchScores(data.matchScores || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load rankings';
      setError(message);
      // Don't toast on initial load failures - just set error state
      console.error('FTC Rankings error:', message);
    } finally {
      setLoading(false);
    }
  }, [currentEvent?.code, includeScores]);

  // Helper to get rank for a specific team
  const getRankForTeam = useCallback((teamNumber: number): number | null => {
    const team = rankings.find(r => r.teamNumber === teamNumber);
    return team ? team.rank : null;
  }, [rankings]);

  // Helper to get W/L/T record for a team
  const getRecordForTeam = useCallback((teamNumber: number) => {
    const team = rankings.find(r => r.teamNumber === teamNumber);
    return team ? { wins: team.wins, losses: team.losses, ties: team.ties } : null;
  }, [rankings]);

  const getTeamName = useCallback((teamNumber: number): string | null => {
    const team = rankings.find(r => r.teamNumber === teamNumber);
    return team ? team.teamName : null;
  }, [rankings]);

  // Fetch on mount and when event changes
  useEffect(() => {
    if (currentEvent?.code) {
      fetchRankings();
    }
  }, [currentEvent?.code, fetchRankings]);

  return {
    rankings,
    matchScores,
    loading,
    error,
    refetch: fetchRankings,
    getRankForTeam,
    getRecordForTeam,
    getTeamName,
  };
}
