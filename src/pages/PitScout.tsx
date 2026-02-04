import React, { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFTCRankings } from '@/hooks/useFTCRankings';
import { Loader2, Save, Search, Wrench, Bot, Flag, User, Camera, X, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriveType, ConsistencyLevel, AutoLeaveStatus } from '@/types/scouting';

const driveOptions: { value: DriveType; label: string }[] = [
  { value: 'tank', label: 'Tank' },
  { value: 'mecanum', label: 'Mecanum' },
  { value: 'swerve', label: 'Swerve' },
  { value: 'other', label: 'Other' },
];

const consistencyOptions: { value: ConsistencyLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const autoLeaveOptions: { value: AutoLeaveStatus; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'no', label: 'No' },
];

interface SelectorProps<T> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

function DriveSelector({ options, value, onChange, label }: SelectorProps<DriveType>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
              "flex items-center justify-center gap-2",
              "active:scale-95 touch-manipulation",
              value === option.value
                ? "bg-secondary text-secondary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsistencySelector({ options, value, onChange, label }: SelectorProps<ConsistencyLevel>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
              "flex items-center justify-center gap-2",
              "active:scale-95 touch-manipulation",
              value === option.value
                ? "bg-secondary text-secondary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AutoLeaveSelector({ options, value, onChange, label }: SelectorProps<AutoLeaveStatus>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
              "flex items-center justify-center gap-2",
              "active:scale-95 touch-manipulation",
              value === option.value
                ? "bg-secondary text-secondary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PitScout() {
  const { user, isApproved } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();
  const { rankings } = useFTCRankings();

  const [teamNumber, setTeamNumber] = useState('');
  const [teamName, setTeamName] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [lastEditInfo, setLastEditInfo] = useState<string | null>(null);
  
  // Robot Info
  const [driveType, setDriveType] = useState<DriveType>('tank');
  
  // Capabilities
  const [scoresMotifs, setScoresMotifs] = useState(false);
  const [scoresArtifacts, setScoresArtifacts] = useState(false);
  const [hasAutonomous, setHasAutonomous] = useState(false);
  const [autoConsistency, setAutoConsistency] = useState<ConsistencyLevel>('low');
  const [reliableAutoLeave, setReliableAutoLeave] = useState<AutoLeaveStatus>('no');
  
  // Endgame
  const [partialParkCapable, setPartialParkCapable] = useState(false);
  const [fullParkCapable, setFullParkCapable] = useState(false);
  const [endgameConsistency, setEndgameConsistency] = useState<ConsistencyLevel>('low');
  
  // Photo
  const [robotPhotoUrl, setRobotPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!currentEvent) {
    return <Navigate to="/event-select" replace />;
  }

  const resetForm = () => {
    setTeamName('');
    setExistingId(null);
    setLastEditInfo(null);
    setDriveType('tank');
    setScoresMotifs(false);
    setScoresArtifacts(false);
    setHasAutonomous(false);
    setAutoConsistency('low');
    setReliableAutoLeave('no');
    setPartialParkCapable(false);
    setFullParkCapable(false);
    setEndgameConsistency('low');
    setRobotPhotoUrl(null);
  };

  const loadTeamData = async () => {
    if (!teamNumber) return;

    setLoading(true);

    // Reset form first to clear any previous data
    resetForm();

    // Try to get team name from FTC API rankings first
    const teamNum = parseInt(teamNumber);
    const apiTeam = rankings.find(r => r.teamNumber === teamNum);
    if (apiTeam) {
      setTeamName(apiTeam.teamName);
    }

    // NOTE: We cannot do `profiles:last_edited_by(name)` here because there's no FK
    // relationship in the DB schema cache; that causes a PGRST200 error.
    const { data, error } = await supabase
      .from('pit_entries')
      .select('*')
      .eq('event_code', currentEvent.code)
      .eq('team_number', teamNum)
      .maybeSingle();

    if (error) {
      setLoading(false);
      return;
    }

    if (data) {
      setExistingId(data.id);
      setTeamName(data.team_name);
      setDriveType(data.drive_type as DriveType);
      setScoresMotifs(data.scores_motifs);
      setScoresArtifacts(data.scores_artifacts);
      setHasAutonomous(data.has_autonomous);
      setAutoConsistency(data.auto_consistency as ConsistencyLevel);
      setReliableAutoLeave(data.reliable_auto_leave as AutoLeaveStatus);
      setPartialParkCapable(data.partial_park_capable);
      setFullParkCapable(data.full_park_capable);
      setEndgameConsistency(data.endgame_consistency as ConsistencyLevel);
      setRobotPhotoUrl((data as any).robot_photo_url || null);

      if (data.last_edited_by) {
        const { data: editor } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.last_edited_by)
          .maybeSingle();

        const editorName = editor?.name || 'Unknown';
        const editDate = new Date(data.last_edited_at).toLocaleString();
        setLastEditInfo(`Last edited by ${editorName} on ${editDate}`);
      }
    }

    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamNumber) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingPhoto(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentEvent.code}/${teamNumber}.${fileExt}`;

    // Delete old photo if exists
    if (robotPhotoUrl) {
      const oldPath = robotPhotoUrl.split('/robot-photos/')[1];
      if (oldPath) {
        await supabase.storage.from('robot-photos').remove([oldPath]);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('robot-photos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Upload Failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      setUploadingPhoto(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('robot-photos')
      .getPublicUrl(fileName);

    setRobotPhotoUrl(urlData.publicUrl);
    setUploadingPhoto(false);

    toast({
      title: 'Photo Uploaded',
      description: 'Robot photo uploaded successfully. Save to persist.',
    });
  };

  const removePhoto = async () => {
    if (!robotPhotoUrl) return;

    const path = robotPhotoUrl.split('/robot-photos/')[1];
    if (path) {
      await supabase.storage.from('robot-photos').remove([path]);
    }
    setRobotPhotoUrl(null);
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

    if (!teamNumber || !teamName) {
      toast({
        title: 'Missing Information',
        description: 'Please enter team number and name.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const pitData = {
      event_code: currentEvent.code,
      team_number: parseInt(teamNumber),
      team_name: teamName,
      drive_type: driveType,
      scores_motifs: scoresMotifs,
      scores_artifacts: scoresArtifacts,
      has_autonomous: hasAutonomous,
      auto_consistency: autoConsistency,
      reliable_auto_leave: reliableAutoLeave,
      partial_park_capable: partialParkCapable,
      full_park_capable: fullParkCapable,
      endgame_consistency: endgameConsistency,
      robot_photo_url: robotPhotoUrl,
      last_edited_by: user.id,
      last_edited_at: new Date().toISOString(),
    };

    // Use UPSERT to avoid duplicate key errors (unique on event_code + team_number)
    const result = await supabase
      .from('pit_entries')
      .upsert(pitData, { onConflict: 'event_code,team_number' })
      .select('id')
      .single();

    const error = result.error;

    setSaving(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save pit data. Please try again.',
        variant: 'destructive',
      });
    } else {
      if (result.data?.id) setExistingId(result.data.id);
      toast({
        title: 'Saved!',
        description: `Pit data for Team ${teamNumber} saved successfully.`,
      });
      await loadTeamData();
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Pit Scouting"
        description="Record team capabilities and robot info"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Team Search */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-secondary" />
            Find Team
          </h2>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="teamNumber">Team Number</Label>
              <Input
                id="teamNumber"
                type="number"
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                placeholder="e.g., 12345"
                className="h-14 text-xl font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={loadTeamData}
                disabled={!teamNumber || loading}
                className="h-14 px-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Load'}
              </Button>
            </div>
          </div>
          {lastEditInfo && (
            <p className="text-sm text-muted-foreground mt-3 bg-muted/50 px-3 py-2 rounded">
              {lastEditInfo}
            </p>
          )}
        </div>

        {/* Team Info */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Team Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Robotics Eagles"
                className="h-14"
                required
              />
            </div>
            <DriveSelector
              options={driveOptions}
              value={driveType}
              onChange={setDriveType}
              label="Drive Type"
            />
          </div>
        </div>

        {/* Capabilities */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-secondary" />
            Capabilities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToggleButton
              value={scoresMotifs}
              onChange={setScoresMotifs}
              label="Scores Motifs"
            />
            <ToggleButton
              value={scoresArtifacts}
              onChange={setScoresArtifacts}
              label="Scores Artifacts"
            />
            <ToggleButton
              value={hasAutonomous}
              onChange={setHasAutonomous}
              label="Has Autonomous"
            />
            <ConsistencySelector
              options={consistencyOptions}
              value={autoConsistency}
              onChange={setAutoConsistency}
              label="Autonomous Consistency"
            />
            <AutoLeaveSelector
              options={autoLeaveOptions}
              value={reliableAutoLeave}
              onChange={setReliableAutoLeave}
              label="Reliable Auto Leave"
            />
          </div>
        </div>

        {/* Endgame */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            Endgame
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ToggleButton
              value={partialParkCapable}
              onChange={setPartialParkCapable}
              label="Partial Park Capable"
            />
            <ToggleButton
              value={fullParkCapable}
              onChange={setFullParkCapable}
              label="Full Park Capable"
            />
            <ConsistencySelector
              options={consistencyOptions}
              value={endgameConsistency}
              onChange={setEndgameConsistency}
              label="Endgame Consistency"
            />
          </div>
        </div>

        {/* Robot Photo */}
        <div className="data-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Robot Photo
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          {robotPhotoUrl ? (
            <div className="relative">
              <img
                src={robotPhotoUrl}
                alt="Robot"
                className="w-full max-w-md rounded-lg border border-border object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={removePhoto}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-32 w-full max-w-md flex flex-col gap-2 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto || !teamNumber}
            >
              {uploadingPhoto ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <>
                  <Image className="w-8 h-8 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {teamNumber ? 'Click to upload robot photo' : 'Enter team number first'}
                  </span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Actions */}
        <Button
          type="submit"
          className="w-full h-14 text-lg gap-2"
          disabled={saving || !isApproved || !teamNumber}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {existingId ? 'Update Pit Data' : 'Save Pit Data'}
        </Button>
      </form>
    </AppLayout>
  );
}
