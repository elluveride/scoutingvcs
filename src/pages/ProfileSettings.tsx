import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { Loader2, Save, User, KeyRound, Sun, Moon, Send, CheckCircle2, Clock } from 'lucide-react';
import { PitSection } from '@/components/match-scout/PitSection';
import { ServerModeSettings } from '@/components/settings/ServerModeSettings';

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Team change request state
  const [requestedTeam, setRequestedTeam] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ requested_team_number: number; reason: string; created_at: string } | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) loadPendingRequest();
  }, [user]);

  const loadPendingRequest = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('team_change_requests')
      .select('requested_team_number, reason, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingRequest(data);
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Name required', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ name: trimmedName }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Profile Updated', description: 'Your name has been saved.' });
      await refreshProfile();
    }
  };

  const handleTeamChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(requestedTeam);
    if (!requestedTeam || isNaN(parsed) || parsed < 1 || parsed > 99999) {
      toast({ title: 'Invalid team number', description: 'Enter a number between 1 and 99999.', variant: 'destructive' });
      return;
    }
    if (parsed === profile?.teamNumber) {
      toast({ title: 'Same team', description: 'That is already your current team number.', variant: 'destructive' });
      return;
    }
    if (!changeReason.trim()) {
      toast({ title: 'Reason required', description: 'Please provide a reason for the change.', variant: 'destructive' });
      return;
    }
    setSubmittingRequest(true);
    const { error } = await (supabase as any).from('team_change_requests').insert({
      user_id: user.id,
      current_team_number: profile?.teamNumber || 0,
      requested_team_number: parsed,
      reason: changeReason.trim(),
    });
    setSubmittingRequest(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Request Submitted', description: 'An admin will review your team change request.' });
      setRequestedTeam('');
      setChangeReason('');
      loadPendingRequest();
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
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

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl tracking-wide text-glow">Profile Settings</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Update your name, team number, and password
        </p>
      </div>

      <div className="space-y-6 max-w-md">
        {/* Theme Toggle */}
        <PitSection title="Appearance" icon={theme === 'dark' ? Moon : Sun}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'Dark mode — great for dim pit areas' : 'Light mode — better for bright venues'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="gap-2"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>
        </PitSection>

        {/* Server Mode */}
        <ServerModeSettings />

        {/* Profile Info Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <PitSection title="Your Info" icon={User}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-mono text-muted-foreground">Display Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={100} className="h-12 font-mono bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-mono text-muted-foreground">FTC Team Number</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
                  <span className="text-lg font-mono font-bold text-foreground">#{profile?.teamNumber || '—'}</span>
                  <span className="text-xs text-muted-foreground ml-auto">Use the form below to request a change</span>
                </div>
              </div>
            </div>
          </PitSection>
          <div className="pt-2">
            <Button type="submit" className="w-full h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow" disabled={saving}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Profile
            </Button>
          </div>
        </form>

        {/* Team Change Request */}
        <PitSection title="Request Team Change" icon={Send}>
          {pendingRequest ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                <Clock className="w-4 h-4 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">Pending Request</p>
                  <p className="text-xs text-muted-foreground">
                    Change to team <strong>#{pendingRequest.requested_team_number}</strong> — submitted {new Date(pendingRequest.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Reason: {pendingRequest.reason}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">An admin will review your request. You can submit a new one after this is resolved.</p>
            </div>
          ) : (
            <form onSubmit={handleTeamChangeRequest} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="requestedTeam" className="text-sm font-mono text-muted-foreground">New Team Number</Label>
                <Input id="requestedTeam" type="number" min={1} max={99999} value={requestedTeam} onChange={(e) => setRequestedTeam(e.target.value)} placeholder="e.g. 12345" className="h-12 font-mono bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="changeReason" className="text-sm font-mono text-muted-foreground">Reason for Change</Label>
                <Textarea id="changeReason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Why do you need to change teams?" className="font-mono bg-background border-border min-h-[80px]" maxLength={500} />
              </div>
              <Button type="submit" variant="outline" className="w-full h-12 gap-2" disabled={submittingRequest}>
                {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Request
              </Button>
            </form>
          )}
        </PitSection>

        {/* Password Change Form */}
        <form onSubmit={handlePasswordChange} className="space-y-4 pb-8">
          <PitSection title="Change Password" icon={KeyRound}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-mono text-muted-foreground">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" minLength={6} className="h-12 font-mono bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-mono text-muted-foreground">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" minLength={6} className="h-12 font-mono bg-background border-border" />
              </div>
            </div>
          </PitSection>
          <div className="pt-2">
            <Button type="submit" className="w-full h-14 text-base gap-2 font-display bg-primary text-primary-foreground hover:bg-primary/90 bg-glow" disabled={changingPassword || !newPassword || !confirmPassword}>
              {changingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
              Change Password
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
