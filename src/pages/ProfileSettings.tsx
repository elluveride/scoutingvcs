import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User, Lock, Unlock, KeyRound, Clock } from 'lucide-react';
import { PitSection } from '@/components/match-scout/PitSection';
import { ServerModeSettings } from '@/components/settings/ServerModeSettings';

function getTimeRemaining(changedAt: string | null): { canChange: boolean; hoursLeft: number; minutesLeft: number } {
  if (!changedAt) return { canChange: true, hoursLeft: 0, minutesLeft: 0 };
  const changed = new Date(changedAt).getTime();
  const now = Date.now();
  const elapsed = now - changed;
  const cooldown = 48 * 60 * 60 * 1000; // 48 hours in ms
  if (elapsed >= cooldown) return { canChange: true, hoursLeft: 0, minutesLeft: 0 };
  const remaining = cooldown - elapsed;
  const hoursLeft = Math.floor(remaining / (60 * 60 * 1000));
  const minutesLeft = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return { canChange: false, hoursLeft, minutesLeft };
}

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [teamUnlocked, setTeamUnlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setTeamNumber(profile.teamNumber?.toString() || '');
      setTeamUnlocked(false);
    }
  }, [profile]);

  const cooldown = useMemo(
    () => getTimeRemaining(profile?.teamNumberChangedAt ?? null),
    [profile?.teamNumberChangedAt]
  );

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const teamNumberChanged = profile?.teamNumber?.toString() !== teamNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Name required', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }

    const parsedTeam = parseInt(teamNumber);
    if (!teamNumber || isNaN(parsedTeam) || parsedTeam < 1 || parsedTeam > 99999) {
      toast({ title: 'Invalid team number', description: 'Enter a number between 1 and 99999.', variant: 'destructive' });
      return;
    }

    // If team number is being changed, enforce cooldown
    if (teamNumberChanged) {
      if (!cooldown.canChange) {
        toast({
          title: 'Cooldown active',
          description: `You must wait ${cooldown.hoursLeft}h ${cooldown.minutesLeft}m before changing your team number again.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);

    const updateData: Record<string, unknown> = { name: trimmedName, team_number: parsedTeam };

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Profile Updated', description: 'Your settings have been saved.' });
      setTeamUnlocked(false);
      await refreshProfile();
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords don\'t match', description: 'Please make sure both passwords match.', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setChangingPassword(false);

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to change password.', variant: 'destructive' });
    } else {
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleUnlockTeam = () => {
    if (!cooldown.canChange) {
      toast({
        title: 'Cooldown active',
        description: `You must wait ${cooldown.hoursLeft}h ${cooldown.minutesLeft}m before changing your team number again.`,
        variant: 'destructive',
      });
      return;
    }
    setTeamUnlocked(true);
  };

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl tracking-wide text-glow">Profile Settings</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Update your name, team number, and password
        </p>
      </div>

      <div className="space-y-6 max-w-md">
        {/* Server Mode */}
        <ServerModeSettings />
        {/* Profile Info Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <PitSection title="Your Info" icon={User}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-mono text-muted-foreground">
                  Display Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="h-12 font-mono bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamNumber" className="text-sm font-mono text-muted-foreground">
                  FTC Team Number
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="teamNumber"
                    type="number"
                    min={1}
                    max={99999}
                    value={teamNumber}
                    onChange={(e) => setTeamNumber(e.target.value)}
                    placeholder="e.g. 12345"
                    disabled={!teamUnlocked}
                    className="h-12 font-mono bg-background border-border flex-1"
                  />
                  <Button
                    type="button"
                    variant={teamUnlocked ? 'secondary' : 'outline'}
                    className="h-12 px-3"
                    onClick={() => {
                      if (teamUnlocked) {
                        setTeamUnlocked(false);
                        setTeamNumber(profile?.teamNumber?.toString() || '');
                      } else {
                        handleUnlockTeam();
                      }
                    }}
                  >
                    {teamUnlocked ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                {!cooldown.canChange && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Cooldown: {cooldown.hoursLeft}h {cooldown.minutesLeft}m remaining
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  You'll only see scouting data from members of your team.
                  {!teamUnlocked && ' Tap the unlock button to change.'}
                  {teamUnlocked && ' 48-hour cooldown after changing.'}
                </p>
              </div>
            </div>
          </PitSection>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Profile
            </Button>
          </div>
        </form>

        {/* Password Change Form */}
        <form onSubmit={handlePasswordChange} className="space-y-4 pb-8">
          <PitSection title="Change Password" icon={KeyRound}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-mono text-muted-foreground">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  minLength={6}
                  className="h-12 font-mono bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-mono text-muted-foreground">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  minLength={6}
                  className="h-12 font-mono bg-background border-border"
                />
              </div>
            </div>
          </PitSection>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow"
              disabled={changingPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
              Change Password
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
