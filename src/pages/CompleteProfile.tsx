import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import cipherLogo from '@/assets/cipher-icon.png';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  teamNumber: z.string().min(1, 'Team number is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 99999,
    'Enter a valid FTC team number (1-99999)'
  ),
});

export default function CompleteProfile() {
  const { user, profile, needsProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [teamNumber, setTeamNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If profile already exists, redirect away
  if (profile) {
    return <Navigate to="/event-select" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const validation = profileSchema.safeParse({ name, teamNumber });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      setSubmitting(false);
      return;
    }

    if (!user) {
      setError('Not authenticated');
      setSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc('create_profile_for_signup', {
      _user_id: user.id,
      _name: name.trim(),
      _team_number: Number(teamNumber),
    });

    if (rpcError) {
      if (rpcError.message.includes('already exists')) {
        await refreshProfile();
      } else {
        setError(rpcError.message);
      }
    } else {
      toast({
        title: `Welcome to Cipher, ${name.trim()}! 🎉`,
        description: 'Your account is pending admin approval. You\'ll be notified once approved.',
      });
      await refreshProfile();
      // Navigation happens automatically via the profile redirect check above
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={cipherLogo} alt="Cipher" className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className="font-bold text-xl">Cipher</h1>
            <p className="text-xs text-muted-foreground">12841×2844</p>
          </div>
        </div>

        <div className="data-card">
          <h2 className="text-2xl font-bold mb-2">Complete Your Profile</h2>
          <p className="text-muted-foreground mb-6">
            We need a few more details before you can start scouting.
          </p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-12 bg-input"
                required
                autoFocus={!name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamNumber">FTC Team Number</Label>
              <Input
                id="teamNumber"
                type="number"
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                placeholder="12345"
                className="h-12 bg-input"
                required
                autoFocus={!!name}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold"
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              Continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
