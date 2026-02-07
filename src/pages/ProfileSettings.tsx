import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User } from 'lucide-react';
import { PitSection } from '@/components/match-scout/PitSection';

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setTeamNumber(profile.teamNumber?.toString() || '');
    }
  }, [profile]);

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

    const parsedTeam = parseInt(teamNumber);
    if (!teamNumber || isNaN(parsedTeam) || parsedTeam < 1 || parsedTeam > 99999) {
      toast({ title: 'Invalid team number', description: 'Enter a number between 1 and 99999.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmedName, team_number: parsedTeam })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Profile Updated', description: 'Your settings have been saved.' });
      await refreshProfile();
    }
  };

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl tracking-wide text-glow">Profile Settings</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Update your name and team number
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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
              <Input
                id="teamNumber"
                type="number"
                min={1}
                max={99999}
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                placeholder="e.g. 12345"
                className="h-12 font-mono bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">
                You'll only see scouting data from members of your team.
              </p>
            </div>
          </div>
        </PitSection>

        <div className="pt-2 pb-8">
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
    </AppLayout>
  );
}
