import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, 
  RefreshCw, 
  Trophy, 
  TrendingUp, 
  Medal,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LiveStats() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { rankings, loading, error, refetch } = useFTCRankings();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (rank === 2) return 'bg-gray-300/20 text-gray-300 border-gray-400/50';
    if (rank === 3) return 'bg-amber-600/20 text-amber-500 border-amber-600/50';
    if (rank <= 8) return 'bg-primary/20 text-primary border-primary/50';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4" />;
    if (rank <= 3) return <Medal className="w-4 h-4" />;
    return null;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Live Stats"
        description={`Official FTC rankings for ${currentEvent.name}`}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          {rankings.length > 0 && (
            <span>{rankings.length} teams ranked</span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading && rankings.length === 0 ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : error && rankings.length === 0 ? (
        <div className="data-card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Rankings</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      ) : rankings.length === 0 ? (
        <div className="data-card text-center py-12 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Rankings Available</h3>
          <p>Rankings will appear once qualification matches have been played.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((team) => (
            <div 
              key={team.teamNumber} 
              className="pit-section pl-4"
            >
              <div className="flex items-center gap-4 p-4">
                {/* Rank Badge */}
                <div className={cn(
                  "flex items-center justify-center gap-1 min-w-[3rem] h-10 rounded-lg border font-display font-bold text-lg",
                  getRankBadgeStyle(team.rank)
                )}>
                  {getRankIcon(team.rank)}
                  <span>{team.rank}</span>
                </div>

                {/* Team Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold">{team.teamNumber}</span>
                    <span className="text-sm text-muted-foreground truncate">{team.teamName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="font-mono">
                      <span className="text-accent">{team.wins}W</span>
                      {' - '}
                      <span className="text-secondary">{team.losses}L</span>
                      {team.ties > 0 && (
                        <>
                          {' - '}
                          <span className="text-primary">{team.ties}T</span>
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span>{team.matchesPlayed} played</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-right">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">RP</div>
                    <div className="font-display text-lg font-bold text-primary">
                      {team.rankingPoints.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">TBP</div>
                    <div className="font-display text-lg font-bold">
                      {team.tieBreaker1.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">TB2</div>
                    <div className="font-mono text-sm">
                      {team.tieBreaker2}
                    </div>
                  </div>
                </div>

                {/* Mobile Stats */}
                <div className="sm:hidden text-right">
                  <div className="flex items-center gap-1 text-primary">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-display font-bold">{team.rankingPoints.toFixed(1)} RP</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {team.tieBreaker1.toFixed(1)} TBP
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
