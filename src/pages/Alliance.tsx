import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Crown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AllianceType } from '@/types/scouting';

interface RankedTeam {
  teamNumber: number;
  score: number;
  primaryRole: AllianceType;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
}

const allianceFilters: AllianceType[] = ['PPG', 'PGP', 'GPP'];

export default function Alliance() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<AllianceType | null>(null);
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const loadRankings = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code);

    if (data && !error) {
      const teamMap = new Map<number, typeof data>();
      
      data.forEach(entry => {
        const existing = teamMap.get(entry.team_number) || [];
        existing.push(entry);
        teamMap.set(entry.team_number, existing);
      });

      const rankings: RankedTeam[] = [];
      
      teamMap.forEach((entries, teamNumber) => {
        const n = entries.length;
        
        // Calculate component scores
        const avgAutoMotifs = entries.reduce((sum, e) => sum + e.auto_motifs, 0) / n;
        const avgAutoArtifacts = entries.reduce((sum, e) => sum + e.auto_artifacts, 0) / n;
        const autoLeaveRate = entries.filter(e => e.auto_leave).length / n;
        
        const avgTeleopMotifs = entries.reduce((sum, e) => sum + e.teleop_motifs, 0) / n;
        const avgTeleopArtifacts = entries.reduce((sum, e) => sum + e.teleop_artifacts, 0) / n;
        
        const fullParkRate = entries.filter(e => e.park_status === 'full').length / n;
        const partialParkRate = entries.filter(e => e.park_status === 'partial').length / n;
        
        // Weighted scores
        const autoScore = (avgAutoMotifs * 10 + avgAutoArtifacts * 3 + autoLeaveRate * 5);
        const teleopScore = (avgTeleopMotifs * 5 + avgTeleopArtifacts * 2);
        const endgameScore = (fullParkRate * 30 + partialParkRate * 15);
        
        // Total weighted score
        const score = autoScore * 0.3 + teleopScore * 0.4 + endgameScore * 0.2;
        
        // Determine primary role based on most common alliance type
        const allianceCounts = entries.reduce((acc, e) => {
          acc[e.alliance_type] = (acc[e.alliance_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const primaryRole = (Object.entries(allianceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PPG') as AllianceType;
        
        rankings.push({
          teamNumber,
          score: Math.round(score * 10) / 10,
          primaryRole,
          autoScore: Math.round(autoScore * 10) / 10,
          teleopScore: Math.round(teleopScore * 10) / 10,
          endgameScore: Math.round(endgameScore * 10) / 10,
        });
      });
      
      rankings.sort((a, b) => b.score - a.score);
      setRankedTeams(rankings);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadRankings();
  }, [currentEvent.code]);

  const filteredTeams = selectedFilter
    ? rankedTeams.filter(t => t.primaryRole === selectedFilter)
    : rankedTeams;

  // Check for role overlaps
  const roleDistribution = rankedTeams.reduce((acc, t) => {
    acc[t.primaryRole] = (acc[t.primaryRole] || 0) + 1;
    return acc;
  }, {} as Record<AllianceType, number>);

  return (
    <AppLayout>
      <PageHeader
        title="Alliance Selection"
        description="Rankings and compatibility analysis"
      />

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={selectedFilter === null ? 'default' : 'outline'}
          onClick={() => setSelectedFilter(null)}
        >
          All Teams
        </Button>
        {allianceFilters.map((filter) => (
          <Button
            key={filter}
            variant={selectedFilter === filter ? 'default' : 'outline'}
            onClick={() => setSelectedFilter(filter)}
          >
            {filter}
            <span className="ml-2 text-xs opacity-70">
              ({roleDistribution[filter] || 0})
            </span>
          </Button>
        ))}
      </div>

      {/* Role Distribution Alert */}
      {Object.values(roleDistribution).some(count => count > rankedTeams.length * 0.5) && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning">Role Imbalance Detected</p>
            <p className="text-sm text-muted-foreground">
              Some alliance roles have significantly more teams than others.
              Consider this when forming alliances.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          No match data yet. Start scouting to see rankings.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team, index) => (
            <div
              key={team.teamNumber}
              className={cn(
                "data-card flex items-center gap-4",
                index === 0 && "border-primary/50 bg-primary/5"
              )}
            >
              {/* Rank */}
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                {index === 0 ? (
                  <Crown className="w-6 h-6 text-primary" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Team Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono">{team.teamNumber}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-semibold",
                    team.primaryRole === 'PPG' && "bg-alliance-red/20 text-red-400",
                    team.primaryRole === 'PGP' && "bg-secondary/20 text-secondary",
                    team.primaryRole === 'GPP' && "bg-primary/20 text-primary",
                  )}>
                    {team.primaryRole}
                  </span>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="hidden md:flex gap-6 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Auto</p>
                  <p className="font-mono font-semibold">{team.autoScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TeleOp</p>
                  <p className="font-mono font-semibold">{team.teleopScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Endgame</p>
                  <p className="font-mono font-semibold">{team.endgameScore}</p>
                </div>
              </div>

              {/* Total Score */}
              <div className="text-right">
                <p className="stat-value text-primary">{team.score}</p>
                <p className="stat-label">Score</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
