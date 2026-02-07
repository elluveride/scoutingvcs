import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { IntegerStepper } from '@/components/ui/integer-stepper';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFTCMatches } from '@/hooks/useFTCMatches';
import { MatchInfoSection } from '@/components/match-scout/MatchInfoSection';
import { PitSection } from '@/components/match-scout/PitSection';
import { OptionSelector } from '@/components/match-scout/OptionSelector';
import { Loader2, Save, RotateCcw, Bot, Gamepad2, Flag, AlertTriangle, Pencil, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EndgameReturnStatus, PenaltyStatus } from '@/types/scouting';

const endgameOptions: { value: EndgameReturnStatus; label: string }[] = [
  { value: 'not_returned', label: 'None' },
  { value: 'partial', label: 'Partial' },
  { value: 'full', label: 'Full' },
  { value: 'lift', label: 'Lift' },
];

const penaltyOptions: { value: PenaltyStatus; label: string; color?: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'dead', label: 'Dead' },
  { value: 'yellow_card', label: 'Yellow', color: '#eab308' },
  { value: 'red_card', label: 'Red', color: '#ef4444' },
];

const defenseOptions = [
  { value: 0, label: '0', sublabel: 'None' },
  { value: 1, label: '1', sublabel: 'Partial' },
  { value: 2, label: '2', sublabel: 'Bad' },
  { value: 3, label: '3', sublabel: 'Good' },
];

export default function MatchScout() {
  const { user, profile, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useFTCMatches();
  
  const isAdmin = profile?.role === 'admin';
  const editId = searchParams.get('edit');

  // Match selection
  const [matchType, setMatchType] = useState<'Q' | 'P'>('Q');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [editingEntry, setEditingEntry] = useState<{ id: string; scouterId: string } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  // Autonomous
  const [autoScoredClose, setAutoScoredClose] = useState(0);
  const [autoScoredFar, setAutoScoredFar] = useState(0);
  const [onLaunchLine, setOnLaunchLine] = useState(true);
  
  // TeleOp
  const [teleopScoredClose, setTeleopScoredClose] = useState(0);
  const [teleopScoredFar, setTeleopScoredFar] = useState(0);
  const [defenseRating, setDefenseRating] = useState(0);
  
  // Endgame
  const [endgameReturn, setEndgameReturn] = useState<EndgameReturnStatus>('not_returned');
  const [penaltyStatus, setPenaltyStatus] = useState<PenaltyStatus>('none');
  
  // General counters
  const [fouls, setFouls] = useState(0);
  
  const [saving, setSaving] = useState(false);

  // Handle match type change - refetch schedule
  const handleMatchTypeChange = (type: 'Q' | 'P') => {
    setMatchType(type);
    setSelectedPosition('');
    refetchMatches(type);
  };

  // Handle position selection - auto-fill team number
  const handlePositionSelect = (position: string, team: number) => {
    setSelectedPosition(position);
    setTeamNumber(team.toString());
  };

  // Load entry for editing (admin only)
  useEffect(() => {
    if (editId && isAdmin && currentEvent) {
      loadEntryForEdit(editId);
    }
  }, [editId, isAdmin, currentEvent]);

  const loadEntryForEdit = async (id: string) => {
    setLoadingEdit(true);
    const { data, error } = await supabase
      .from('match_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (data && !error) {
      setTeamNumber(data.team_number.toString());
      setMatchNumber(data.match_number.toString());
      setAutoScoredClose(data.auto_scored_close);
      setAutoScoredFar(data.auto_scored_far);
      setOnLaunchLine(data.on_launch_line);
      setTeleopScoredClose(data.teleop_scored_close);
      setTeleopScoredFar(data.teleop_scored_far);
      setDefenseRating(data.defense_rating);
      setEndgameReturn(data.endgame_return as EndgameReturnStatus);
      setPenaltyStatus(data.penalty_status as PenaltyStatus);
      setFouls(data.auto_fouls_minor + data.auto_fouls_major);
      setEditingEntry({ id: data.id, scouterId: data.scouter_id });
    } else {
      toast({
        title: 'Error',
        description: 'Could not load entry for editing.',
        variant: 'destructive',
      });
      setSearchParams({});
    }
    setLoadingEdit(false);
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const resetForm = () => {
    setMatchType('Q');
    setSelectedPosition('');
    setTeamNumber('');
    setMatchNumber('');
    setAutoScoredClose(0);
    setAutoScoredFar(0);
    setOnLaunchLine(true);
    setTeleopScoredClose(0);
    setTeleopScoredFar(0);
    setDefenseRating(0);
    setEndgameReturn('not_returned');
    setPenaltyStatus('none');
    setFouls(0);
    setEditingEntry(null);
    setSearchParams({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isApproved) {
      toast({
        title: 'Account Pending',
        description: 'Your account must be approved to submit scouting data.',
        variant: 'destructive',
      });
      return;
    }

    if (!teamNumber || !matchNumber) {
      toast({
        title: 'Missing Information',
        description: 'Please enter team and match numbers.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const entryData = {
      event_code: currentEvent.code,
      team_number: parseInt(teamNumber),
      match_number: parseInt(matchNumber),
      auto_scored_close: autoScoredClose,
      auto_scored_far: autoScoredFar,
      auto_fouls_minor: fouls,
      auto_fouls_major: 0,
      on_launch_line: onLaunchLine,
      teleop_scored_close: teleopScoredClose,
      teleop_scored_far: teleopScoredFar,
      defense_rating: defenseRating,
      endgame_return: endgameReturn,
      penalty_status: penaltyStatus,
    };

    let error;

    if (editingEntry && isAdmin) {
      const { error: updateError } = await supabase
        .from('match_entries')
        .update(entryData)
        .eq('id', editingEntry.id);
      error = updateError;
    } else {
      const { error: upsertError } = await supabase.from('match_entries').upsert(
        {
          ...entryData,
          scouter_id: user.id,
        },
        { onConflict: 'event_code,team_number,match_number,scouter_id' }
      );
      error = upsertError;
    }

    setSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save match data.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: editingEntry ? 'Updated!' : 'Saved!',
        description: `Match ${matchNumber} data for Team ${teamNumber} ${editingEntry ? 'updated' : 'saved'}.`,
      });
      resetForm();
    }
  };

  if (loadingEdit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-2xl tracking-wide text-glow">
          {editingEntry ? "Edit Entry" : "Match Scout"}
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {currentEvent.name}
        </p>
      </div>

      {editingEntry && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <Pencil className="w-4 h-4 text-warning" />
          <span className="text-sm font-mono">Editing existing entry</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-auto h-8"
            onClick={resetForm}
          >
            Cancel
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Match Info */}
        <PitSection title="Match Info" icon={Crosshair}>
          <MatchInfoSection
            matchType={matchType}
            matchNumber={matchNumber}
            selectedPosition={selectedPosition}
            teamNumber={teamNumber}
            matches={matches}
            loading={matchesLoading}
            onMatchTypeChange={handleMatchTypeChange}
            onMatchNumberChange={setMatchNumber}
            onPositionSelect={handlePositionSelect}
            onTeamNumberChange={setTeamNumber}
            onRefresh={() => refetchMatches(matchType)}
          />
        </PitSection>

        {/* Autonomous */}
        <PitSection title="Autonomous" icon={Bot} variant="blue">
          <div className="grid grid-cols-2 gap-4">
            <IntegerStepper
              value={autoScoredClose}
              onChange={setAutoScoredClose}
              label="Close"
            />
            <IntegerStepper
              value={autoScoredFar}
              onChange={setAutoScoredFar}
              label="Far"
            />
          </div>
          <div className="mt-4">
            <ToggleButton
              value={onLaunchLine}
              onChange={setOnLaunchLine}
              label="Launch Line"
              onLabel="ON"
              offLabel="OFF"
              invertColors
            />
          </div>
        </PitSection>

        {/* TeleOp */}
        <PitSection title="TeleOp" icon={Gamepad2} variant="red">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <IntegerStepper
              value={teleopScoredClose}
              onChange={setTeleopScoredClose}
              label="Close"
            />
            <IntegerStepper
              value={teleopScoredFar}
              onChange={setTeleopScoredFar}
              label="Far"
            />
          </div>
          
          <OptionSelector
            label="Defense Rating"
            options={defenseOptions}
            value={defenseRating}
            onChange={setDefenseRating}
            columns={4}
          />
        </PitSection>

        {/* Endgame */}
        <PitSection title="Endgame" icon={Flag}>
          <div className="space-y-4">
            <OptionSelector
              label="Return Status"
              options={endgameOptions}
              value={endgameReturn}
              onChange={setEndgameReturn}
              columns={4}
            />
            
            <OptionSelector
              label="Penalty / Robot Status"
              options={penaltyOptions}
              value={penaltyStatus}
              onChange={setPenaltyStatus}
              columns={4}
            />
          </div>
        </PitSection>

        {/* Fouls */}
        <PitSection title="Fouls" icon={AlertTriangle} variant="warning">
          <IntegerStepper
            value={fouls}
            onChange={setFouls}
            label="Total Fouls"
          />
        </PitSection>

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            className="flex-1 h-14 text-base gap-2 font-mono"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </Button>
          <Button
            type="submit"
            className="flex-1 h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow"
            disabled={saving || !isApproved}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Match
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
