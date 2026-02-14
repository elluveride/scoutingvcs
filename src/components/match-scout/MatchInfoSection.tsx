import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPositionLabel, getPositionColor } from '@/hooks/useFTCMatches';

interface MatchPosition {
  teamNumber: number;
  position: string;
  surrogate: boolean;
}

interface MatchData {
  matchNumber: number;
  positions: MatchPosition[];
}

interface MatchInfoSectionProps {
  matchType: 'Q' | 'P';
  matchNumber: string;
  selectedPosition: string;
  teamNumber: string;
  matches: MatchData[];
  loading: boolean;
  onMatchTypeChange: (type: 'Q' | 'P') => void;
  onMatchNumberChange: (value: string) => void;
  onPositionSelect: (position: string, teamNumber: number) => void;
  onTeamNumberChange: (value: string) => void;
  onRefresh: () => void;
}

export function MatchInfoSection({
  matchType,
  matchNumber,
  selectedPosition,
  teamNumber,
  matches,
  loading,
  onMatchTypeChange,
  onMatchNumberChange,
  onPositionSelect,
  onTeamNumberChange,
  onRefresh,
}: MatchInfoSectionProps) {
  // Find current match data
  const currentMatch = matches.find(
    (m) => m.matchNumber === parseInt(matchNumber)
  );

  const getPositionButtonClass = (pos: MatchPosition) => {
    const isRed = pos.position.startsWith('R');
    const isSelected = selectedPosition === pos.position;
    
    if (isSelected) {
      return isRed ? 'pit-button-red' : 'pit-button-blue';
    }
    return 'pit-button-muted';
  };

  return (
    <div className="space-y-4">
      {/* Match Type Toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="pit-counter-label">Match Type</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMatchTypeChange('Q')}
            className={cn(
              "pit-button",
              matchType === 'Q' ? "pit-button-active" : "pit-button-muted"
            )}
          >
            Qualification
          </button>
          <button
            type="button"
            onClick={() => onMatchTypeChange('P')}
            className={cn(
              "pit-button",
              matchType === 'P' ? "pit-button-active" : "pit-button-muted"
            )}
          >
            Playoff
          </button>
        </div>
      </div>

      {/* Match Number */}
      <div className="space-y-2">
        <span className="pit-counter-label block text-center">Match Number</span>
        <Input
          id="matchNumber"
          type="number"
          value={matchNumber}
          onChange={(e) => onMatchNumberChange(e.target.value)}
          placeholder="1"
          className="h-16 text-3xl font-display text-center bg-muted/50 border-border/50"
          required
        />
      </div>

      {/* Alliance Position Selector */}
      {matchNumber && (
        <div className="space-y-2">
          <span className="pit-counter-label block text-center">
            Alliance Position 
            {loading && <Loader2 className="inline w-3 h-3 animate-spin ml-2" />}
          </span>
          {currentMatch ? (
            <div className="grid grid-cols-2 gap-2">
              {[...currentMatch.positions]
                .sort((a, b) => {
                  // Sort: Red 1, Red 2, Blue 1, Blue 2
                  const allianceOrder = { R: 0, B: 1 };
                  const aAlliance = allianceOrder[a.position.charAt(0) as 'R' | 'B'] ?? 2;
                  const bAlliance = allianceOrder[b.position.charAt(0) as 'R' | 'B'] ?? 2;
                  if (aAlliance !== bAlliance) return aAlliance - bAlliance;
                  return a.position.localeCompare(b.position);
                })
                .map((pos) => (
                <button
                  key={pos.position}
                  type="button"
                  onClick={() => onPositionSelect(pos.position, pos.teamNumber)}
                  className={cn(
                    "pit-button h-20 flex flex-col items-center justify-center gap-1",
                    getPositionButtonClass(pos)
                  )}
                >
                  <span className="text-2xl font-display">{pos.teamNumber}</span>
                  <span className="text-xs opacity-80 font-mono">{getPositionLabel(pos.position)}</span>
                </button>
              ))}
            </div>
          ) : matches.length > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 font-mono">
              Match {matchNumber} not found
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 font-mono">
              {loading ? 'Loading...' : 'No schedule available'}
            </p>
          )}
        </div>
      )}

      {/* Team Number (manual override or display) */}
      <div className="space-y-2">
        <span className="pit-counter-label block text-center">
          Team Number
          {selectedPosition && (
            <span className="text-primary ml-2">
              ({getPositionLabel(selectedPosition)})
            </span>
          )}
        </span>
        <Input
          id="teamNumber"
          type="number"
          value={teamNumber}
          onChange={(e) => onTeamNumberChange(e.target.value)}
          placeholder="12345"
          className="h-16 text-3xl font-display text-center bg-muted/50 border-border/50"
          required
        />
      </div>
    </div>
  );
}
