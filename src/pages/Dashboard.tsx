import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, TrendingUp, Bot, Gamepad2, Flag } from 'lucide-react';
import type { TeamStats } from '@/types/scouting';

export default function Dashboard() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const calculateStats = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('event_code', currentEvent.code);

    if (data && !error) {
      // Group by team
      const teamMap = new Map<number, typeof data>();
      
      data.forEach(entry => {
        const existing = teamMap.get(entry.team_number) || [];
        existing.push(entry);
        teamMap.set(entry.team_number, existing);
      });

      // Calculate stats for each team
      const stats: TeamStats[] = [];
      
      teamMap.forEach((entries, teamNumber) => {
        const matchesPlayed = entries.length;
        
        const avgAutoMotifs = entries.reduce((sum, e) => sum + e.auto_motifs, 0) / matchesPlayed;
        const avgAutoArtifacts = entries.reduce((sum, e) => sum + e.auto_artifacts, 0) / matchesPlayed;
        const autoLeavePercent = (entries.filter(e => e.auto_leave).length / matchesPlayed) * 100;
        
        const avgTeleopMotifs = entries.reduce((sum, e) => sum + e.teleop_motifs, 0) / matchesPlayed;
        const avgTeleopArtifacts = entries.reduce((sum, e) => sum + e.teleop_artifacts, 0) / matchesPlayed;
        
        const fullParkPercent = (entries.filter(e => e.park_status === 'full').length / matchesPlayed) * 100;
        const partialParkPercent = (entries.filter(e => e.park_status === 'partial').length / matchesPlayed) * 100;
        
        // Simple variance calculation
        const autoMotifsVariance = entries.reduce((sum, e) => sum + Math.pow(e.auto_motifs - avgAutoMotifs, 2), 0) / matchesPlayed;
        const varianceScore = Math.sqrt(autoMotifsVariance);
        
        // Failure rate = no scoring at all
        const failureRate = (entries.filter(e => 
          e.auto_motifs === 0 && e.auto_artifacts === 0 && e.teleop_motifs === 0 && e.teleop_artifacts === 0
        ).length / matchesPlayed) * 100;
        
        // Selection score calculation
        const autoScore = (avgAutoMotifs * 10 + avgAutoArtifacts * 3 + autoLeavePercent * 0.05) * 0.3;
        const teleopScore = (avgTeleopMotifs * 5 + avgTeleopArtifacts * 2) * 0.4;
        const endgameScore = (fullParkPercent * 0.3 + partialParkPercent * 0.15) * 0.2;
        const reliabilityScore = (100 - failureRate - varianceScore * 10) * 0.1;
        
        const selectionScore = Math.max(0, Math.min(100, autoScore + teleopScore + endgameScore + reliabilityScore));
        
        stats.push({
          teamNumber,
          matchesPlayed,
          avgAutoMotifs: Math.round(avgAutoMotifs * 10) / 10,
          avgAutoArtifacts: Math.round(avgAutoArtifacts * 10) / 10,
          autoLeavePercent: Math.round(autoLeavePercent),
          avgTeleopMotifs: Math.round(avgTeleopMotifs * 10) / 10,
          avgTeleopArtifacts: Math.round(avgTeleopArtifacts * 10) / 10,
          fullParkPercent: Math.round(fullParkPercent),
          partialParkPercent: Math.round(partialParkPercent),
          varianceScore: Math.round(varianceScore * 10) / 10,
          failureRate: Math.round(failureRate),
          selectionScore: Math.round(selectionScore),
        });
      });
      
      // Sort by selection score
      stats.sort((a, b) => b.selectionScore - a.selectionScore);
      setTeamStats(stats);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    calculateStats();
  }, [currentEvent.code]);

  const filteredStats = teamStats.filter(team => 
    team.teamNumber.toString().includes(searchTerm)
  );

  return (
    <AppLayout>
      <PageHeader
        title="Team Dashboard"
        description="Aggregated team performance metrics"
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by team number..."
          className="pl-12 h-12"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredStats.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          {teamStats.length === 0
            ? 'No match data yet. Start scouting to see stats.'
            : 'No teams match your search.'}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredStats.map((team) => (
            <div key={team.teamNumber} className="data-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold font-mono">{team.teamNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {team.matchesPlayed} matches played
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="stat-value text-primary">{team.selectionScore}</span>
                  </div>
                  <p className="stat-label">Selection Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Autonomous */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Autonomous</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs">Motifs</span>
                      <span className="text-sm font-mono font-semibold">{team.avgAutoMotifs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs">Artifacts</span>
                      <span className="text-sm font-mono font-semibold">{team.avgAutoArtifacts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs">Leave</span>
                      <span className="text-sm font-mono font-semibold">{team.autoLeavePercent}%</span>
                    </div>
                  </div>
                </div>

                {/* TeleOp */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Gamepad2 className="w-4 h-4 text-secondary" />
                    <span className="text-xs font-medium text-muted-foreground">TeleOp</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs">Motifs</span>
                      <span className="text-sm font-mono font-semibold">{team.avgTeleopMotifs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs">Artifacts</span>
                      <span className="text-sm font-mono font-semibold">{team.avgTeleopArtifacts}</span>
                    </div>
                  </div>
                </div>

                {/* Endgame */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="w-4 h-4 text-accent" />
                    <span className="text-xs font-medium text-muted-foreground">Endgame</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs">Full Park</span>
                      <span className="text-sm font-mono font-semibold">{team.fullParkPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs">Partial</span>
                      <span className="text-sm font-mono font-semibold">{team.partialParkPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Reliability */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-warning" />
                    <span className="text-xs font-medium text-muted-foreground">Reliability</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs">Variance</span>
                      <span className="text-sm font-mono font-semibold">{team.varianceScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs">Fail Rate</span>
                      <span className="text-sm font-mono font-semibold">{team.failureRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
