import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { IntegerStepper } from '@/components/ui/integer-stepper';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RotateCcw, Bot, Gamepad2, Flag, AlertTriangle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EndgameReturnStatus, PenaltyStatus } from '@/types/scouting';

const endgameOptions: { value: EndgameReturnStatus; label: string }[] = [
  { value: 'not_returned', label: 'Not Returned' },
  { value: 'partial', label: 'Partial' },
  { value: 'full', label: 'Full Return' },
  { value: 'lift', label: 'Lift' },
];

const penaltyOptions: { value: PenaltyStatus; label: string; color?: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'dead', label: 'Dead' },
  { value: 'yellow_card', label: 'Yellow Card', color: 'bg-yellow-500' },
  { value: 'red_card', label: 'Red Card', color: 'bg-red-500' },
];

const defenseLabels = ['None', 'Partial', 'Full Bad', 'Full Good'];

export default function MatchScout() {
  const { user, profile, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const isAdmin = profile?.role === 'admin';
  const editId = searchParams.get('edit');

  const [teamNumber, setTeamNumber] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [editingEntry, setEditingEntry] = useState<{ id: string; scouterId: string } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  // Autonomous
  const [autoScoredClose, setAutoScoredClose] = useState(0);
  const [autoScoredFar, setAutoScoredFar] = useState(0);
  const [onLaunchLine, setOnLaunchLine] = useState(false);
  
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
    setTeamNumber('');
    setMatchNumber('');
    setAutoScoredClose(0);
    setAutoScoredFar(0);
    setOnLaunchLine(false);
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
      auto_fouls_minor: fouls, // Store general fouls in minor field
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
      // Admin editing someone else's entry - update by ID
      const { error: updateError } = await supabase
        .from('match_entries')
        .update(entryData)
        .eq('id', editingEntry.id);
      error = updateError;
    } else {
      // Normal upsert for new entries or own entries
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
      <PageHeader
        title={editingEntry ? "Edit Match Entry" : "Match Scouting"}
        description={editingEntry ? "Editing existing entry (Admin)" : "Record match performance data"}
      />

      {editingEntry && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
          <Pencil className="w-4 h-4 text-yellow-500" />
          <span className="text-sm">Editing existing entry. Changes will update the original record.</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-auto"
            onClick={resetForm}
          >
            Cancel Edit
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Match Info */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-secondary" />
            Match Info
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamNumber">Team Number</Label>
              <Input
                id="teamNumber"
                type="number"
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                placeholder="e.g., 12345"
                className="h-14 text-xl font-mono text-center"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchNumber">Match Number</Label>
              <Input
                id="matchNumber"
                type="number"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                placeholder="e.g., 1"
                className="h-14 text-xl font-mono text-center"
                required
              />
            </div>
          </div>
        </div>

        {/* Autonomous */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Autonomous
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <IntegerStepper
              value={autoScoredClose}
              onChange={setAutoScoredClose}
              label="Scored Close"
            />
            <IntegerStepper
              value={autoScoredFar}
              onChange={setAutoScoredFar}
              label="Scored Far"
            />
            <div className="col-span-2 md:col-span-1">
              <ToggleButton
                value={onLaunchLine}
                onChange={setOnLaunchLine}
                label="Launch Line"
                onLabel="ON"
                offLabel="OFF"
              />
            </div>
          </div>
        </div>

        {/* TeleOp */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-secondary" />
            TeleOp
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <IntegerStepper
              value={teleopScoredClose}
              onChange={setTeleopScoredClose}
              label="Scored Close"
            />
            <IntegerStepper
              value={teleopScoredFar}
              onChange={setTeleopScoredFar}
              label="Scored Far"
            />
          </div>
          
          {/* Defense Rating */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Defense Rating
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setDefenseRating(rating)}
                  className={cn(
                    "h-14 rounded-xl font-semibold transition-all duration-150",
                    "flex flex-col items-center justify-center gap-1",
                    "active:scale-95 touch-manipulation",
                    defenseRating === rating
                      ? "bg-secondary text-secondary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <span className="text-lg font-mono">{rating}</span>
                  <span className="text-[10px] opacity-75">{defenseLabels[rating]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Endgame */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-accent" />
            Endgame
          </h2>
          
          {/* Return Status */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-sm font-medium text-muted-foreground">
              Return Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {endgameOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEndgameReturn(option.value)}
                  className={cn(
                    "h-14 rounded-xl font-semibold transition-all duration-150",
                    "flex items-center justify-center text-center px-2",
                    "active:scale-95 touch-manipulation text-sm",
                    endgameReturn === option.value
                      ? "bg-secondary text-secondary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Penalty Status */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Penalty / Robot Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {penaltyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPenaltyStatus(option.value)}
                  className={cn(
                    "h-14 rounded-xl font-semibold transition-all duration-150",
                    "flex items-center justify-center text-center px-2",
                    "active:scale-95 touch-manipulation text-sm",
                    penaltyStatus === option.value
                      ? option.color 
                        ? `${option.color} text-white shadow-lg`
                        : "bg-secondary text-secondary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fouls Section - General Counter */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Fouls
          </h2>
          <IntegerStepper
            value={fouls}
            onChange={setFouls}
            label="Total Fouls"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            className="flex-1 h-14 text-lg gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </Button>
          <Button
            type="submit"
            className="flex-1 h-14 text-lg gap-2"
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
