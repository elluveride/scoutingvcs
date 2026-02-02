import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
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
import { Loader2, Save, RotateCcw, Bot, Gamepad2, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AllianceType, ParkStatus } from '@/types/scouting';

const parkOptions: { value: ParkStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'partial', label: 'Partial' },
  { value: 'full', label: 'Full' },
];

const allianceOptions: { value: AllianceType; label: string }[] = [
  { value: 'PPG', label: 'PPG' },
  { value: 'PGP', label: 'PGP' },
  { value: 'GPP', label: 'GPP' },
];

export default function MatchScout() {
  const { user, profile, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();

  const [teamNumber, setTeamNumber] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  
  // Autonomous
  const [autoMotifs, setAutoMotifs] = useState(0);
  const [autoArtifacts, setAutoArtifacts] = useState(0);
  const [autoLeave, setAutoLeave] = useState(false);
  
  // TeleOp
  const [teleopMotifs, setTeleopMotifs] = useState(0);
  const [teleopArtifacts, setTeleopArtifacts] = useState(0);
  
  // Endgame
  const [parkStatus, setParkStatus] = useState<ParkStatus>('none');
  const [allianceType, setAllianceType] = useState<AllianceType>('PPG');
  
  const [saving, setSaving] = useState(false);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const resetForm = () => {
    setTeamNumber('');
    setMatchNumber('');
    setAutoMotifs(0);
    setAutoArtifacts(0);
    setAutoLeave(false);
    setTeleopMotifs(0);
    setTeleopArtifacts(0);
    setParkStatus('none');
    setAllianceType('PPG');
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

    const { error } = await supabase.from('match_entries').insert({
      event_code: currentEvent.code,
      team_number: parseInt(teamNumber),
      match_number: parseInt(matchNumber),
      scouter_id: user.id,
      auto_motifs: autoMotifs,
      auto_artifacts: autoArtifacts,
      auto_leave: autoLeave,
      teleop_motifs: teleopMotifs,
      teleop_artifacts: teleopArtifacts,
      park_status: parkStatus,
      alliance_type: allianceType,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save match data. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Saved!',
        description: `Match ${matchNumber} data for Team ${teamNumber} saved successfully.`,
      });
      resetForm();
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Match Scouting"
        description="Record match performance data"
      />

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <IntegerStepper
              value={autoMotifs}
              onChange={setAutoMotifs}
              max={3}
              label="Motifs Scored"
            />
            <IntegerStepper
              value={autoArtifacts}
              onChange={setAutoArtifacts}
              label="Artifacts Scored"
            />
            <ToggleButton
              value={autoLeave}
              onChange={setAutoLeave}
              label="Autonomous Leave"
            />
          </div>
        </div>

        {/* TeleOp */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-secondary" />
            TeleOp
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IntegerStepper
              value={teleopMotifs}
              onChange={setTeleopMotifs}
              label="Motifs Scored"
            />
            <IntegerStepper
              value={teleopArtifacts}
              onChange={setTeleopArtifacts}
              label="Artifacts Scored"
            />
          </div>
        </div>

        {/* Endgame */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-accent" />
            Endgame
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Park Status */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Park Status
              </label>
              <div className="flex gap-2">
                {parkOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setParkStatus(option.value)}
                    className={cn(
                      "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
                      "flex items-center justify-center gap-2",
                      "active:scale-95 touch-manipulation",
                      parkStatus === option.value
                        ? "bg-secondary text-secondary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Alliance Type */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Alliance Type
              </label>
              <div className="flex gap-2">
                {allianceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAllianceType(option.value)}
                    className={cn(
                      "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
                      "flex items-center justify-center gap-2",
                      "active:scale-95 touch-manipulation",
                      allianceType === option.value
                        ? "bg-secondary text-secondary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
