import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Plus, Loader2, AlertCircle, CheckCircle2, RefreshCw, Star, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cipherLogo from '@/assets/cipher-icon.png';

interface CachedEvent {
  code: string;
  name: string;
  date_start: string;
  date_end: string;
  team_numbers: number[];
  city: string | null;
  state_prov: string | null;
}

export default function EventSelect() {
  const { user, loading, profile } = useAuth();
  const { events, setCurrentEvent, createEvent, loadEvents, eventExpired, clearExpired } = useEvent();
  const navigate = useNavigate();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [eventName, setEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [cachedEvents, setCachedEvents] = useState<CachedEvent[]>([]);

  // Load cached events for team priority sorting
  useEffect(() => {
    loadCachedEvents();
  }, []);

  const loadCachedEvents = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('ftc_events_cache')
      .select('code, name, date_start, date_end, team_numbers, city, state_prov')
      .lte('date_start', today)
      .gte('date_end', today);

    if (data) {
      setCachedEvents(data.map(e => ({
        ...e,
        team_numbers: Array.isArray(e.team_numbers) ? e.team_numbers as number[] : [],
      })));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const userTeam = profile?.teamNumber;
  const isAdmin = profile?.role === 'admin';

  // Check if an event has the user's team registered
  const isUserTeamEvent = (eventCode: string): boolean => {
    if (!userTeam) return false;
    const cached = cachedEvents.find(c => c.code === eventCode);
    return cached ? cached.team_numbers.includes(userTeam) : false;
  };

  // Sort events: user's team events first
  const sortedEvents = [...events].sort((a, b) => {
    const aIsTeam = isUserTeamEvent(a.code);
    const bIsTeam = isUserTeamEvent(b.code);
    if (aIsTeam && !bIsTeam) return -1;
    if (!aIsTeam && bIsTeam) return 1;
    return 0;
  });

  const handleSelectEvent = async (event: typeof events[0]) => {
    setCurrentEvent(event);
    
    await supabase
      .from('profiles')
      .update({ event_code: event.code })
      .eq('id', user.id);
    
    navigate('/scout');
  };

  const handleSyncEvents = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ftc-events-sync');
      if (error) {
        console.error('Sync error:', error);
      } else {
        console.log('Sync result:', data);
        await loadEvents();
        await loadCachedEvents();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    }
    setSyncing(false);
  };

  const validateEventCode = async (code: string) => {
    if (!code || code.length < 3) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ftc-matches', {
        body: { eventCode: code, matchType: 'Q' },
      });
      if (fnError || data?.error) {
        setValidationResult('invalid');
      } else {
        setValidationResult('valid');
      }
    } catch {
      setValidationResult('invalid');
    }
    setValidating(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    const { error: createError } = await createEvent(eventCode.toUpperCase(), eventName);
    
    if (createError) {
      if (createError.message.includes('duplicate')) {
        setError('Event code already exists');
      } else {
        setError(createError.message);
      }
    } else {
      setShowCreateDialog(false);
      setEventCode('');
      setEventName('');
      setValidationResult(null);
      await loadEvents();
    }

    setCreating(false);
  };

  // Get location info for an event from cache
  const getEventLocation = (code: string): string | null => {
    const cached = cachedEvents.find(c => c.code === code);
    if (!cached) return null;
    const parts = [cached.city, cached.state_prov].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img
            src={cipherLogo}
            alt="Cipher logo"
            className="w-16 h-16 rounded-2xl mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold mb-2">Select Event</h1>
          <p className="text-muted-foreground">
            Choose an event to start scouting
          </p>
        </div>

        {eventExpired && (
          <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-secondary">Event Ended</p>
              <p className="text-sm text-muted-foreground">
                Your previous event has concluded and its data has been archived. Please select a new event.
              </p>
            </div>
            <button onClick={clearExpired} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {profile?.status === 'pending' && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">Account Pending Approval</p>
              <p className="text-sm text-muted-foreground">
                An admin needs to approve your account before you can scout matches.
              </p>
            </div>
          </div>
        )}

        {/* Sync button for admins */}
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncEvents}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from FTC API'}
            </Button>
          </div>
        )}

        {events.length === 0 ? (
          <div className="data-card text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Events Yet</h2>
            <p className="text-muted-foreground mb-6">
              {isAdmin
                ? 'Sync from the FTC API or create an event manually'
                : 'Ask an admin to sync events from the FTC API'}
            </p>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleSyncEvents} disabled={syncing} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from FTC API'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Manually
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const isTeamEvent = isUserTeamEvent(event.code);
              const location = getEventLocation(event.code);

              return (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full data-card hover:border-primary/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors relative">
                      <Calendar className="w-6 h-6 text-secondary" />
                      {isTeamEvent && (
                        <Star className="w-4 h-4 text-accent absolute -top-1 -right-1 fill-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg truncate">{event.name}</h3>
                        {isTeamEvent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium shrink-0">
                            Your Event
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {event.code}
                      </p>
                      {location && (
                        <p className="text-xs text-muted-foreground">
                          {location}
                        </p>
                      )}
                    </div>
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      →
                    </div>
                  </div>
                </button>
              );
            })}

            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(true)}
                className="w-full h-14 gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Event
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Set up a new event for scouting.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4 pt-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="eventCode">Event Code</Label>
              <div className="flex gap-2">
                <Input
                  id="eventCode"
                  value={eventCode}
                  onChange={(e) => { setEventCode(e.target.value.toUpperCase()); setValidationResult(null); }}
                  placeholder="e.g., CASC2025"
                  className="h-12 font-mono uppercase flex-1"
                  maxLength={20}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => validateEventCode(eventCode.toUpperCase())}
                  disabled={validating || eventCode.length < 3}
                >
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
              {validationResult === 'valid' && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Event code found in FTC API
                </p>
              )}
              {validationResult === 'invalid' && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Event code not found in FTC API — you can still create it
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., California State Championship"
                className="h-12"
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={creating}>
              {creating && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              Create Event
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
