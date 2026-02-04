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

  return (
    <div className="space-y-4">
      {/* Match Type Toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Match Type</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-2"
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
              "h-12 rounded-xl font-semibold transition-all duration-150",
              "active:scale-95 touch-manipulation",
              matchType === 'Q'
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Qualification
          </button>
          <button
            type="button"
            onClick={() => onMatchTypeChange('P')}
            className={cn(
              "h-12 rounded-xl font-semibold transition-all duration-150",
              "active:scale-95 touch-manipulation",
              matchType === 'P'
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Playoff
          </button>
        </div>
      </div>

      {/* Match Number */}
      <div className="space-y-2">
        <Label htmlFor="matchNumber">Match Number</Label>
        <Input
          id="matchNumber"
          type="number"
          value={matchNumber}
          onChange={(e) => onMatchNumberChange(e.target.value)}
          placeholder="e.g., 1"
          className="h-14 text-xl font-mono text-center"
          required
        />
      </div>

      {/* Alliance Position Selector */}
      {matchNumber && (
        <div className="space-y-2">
          <Label>Alliance Position {loading && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</Label>
          {currentMatch ? (
            <div className="grid grid-cols-2 gap-2">
              {currentMatch.positions.map((pos) => (
                <button
                  key={pos.position}
                  type="button"
                  onClick={() => onPositionSelect(pos.position, pos.teamNumber)}
                  className={cn(
                    "h-16 rounded-xl font-semibold transition-all duration-150 flex flex-col items-center justify-center gap-1",
                    "active:scale-95 touch-manipulation",
                    selectedPosition === pos.position
                      ? `${getPositionColor(pos.position)} text-white shadow-lg`
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <span className="text-lg font-display">{pos.teamNumber}</span>
                  <span className="text-xs opacity-75">{getPositionLabel(pos.position)}</span>
                </button>
              ))}
            </div>
          ) : matches.length > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Match {matchNumber} not found in schedule
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {loading ? 'Loading schedule...' : 'No schedule available'}
            </p>
          )}
        </div>
      )}

      {/* Team Number (manual override or display) */}
      <div className="space-y-2">
        <Label htmlFor="teamNumber">
          Team Number
          {selectedPosition && (
            <span className="text-xs text-muted-foreground ml-2">
              (auto-filled from {getPositionLabel(selectedPosition)})
            </span>
          )}
        </Label>
        <Input
          id="teamNumber"
          type="number"
          value={teamNumber}
          onChange={(e) => onTeamNumberChange(e.target.value)}
          placeholder="e.g., 12345"
          className="h-14 text-xl font-mono text-center"
          required
        />
      </div>
    </div>
  );
}
