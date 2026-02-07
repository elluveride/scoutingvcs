import React, { useState } from 'react';
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
import { Zap, Calendar, Plus, Loader2, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_PASSWORD = 'decode2025'; // In production, this should be stored securely

export default function EventSelect() {
  const { user, loading, profile } = useAuth();
  const { events, setCurrentEvent, createEvent, loadEvents } = useEvent();
  const navigate = useNavigate();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [eventCode, setEventCode] = useState('');
  const [eventName, setEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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

  const handleSelectEvent = async (event: typeof events[0]) => {
    setCurrentEvent(event);
    
    // Update user's current event in profile
    await supabase
      .from('profiles')
      .update({ event_code: event.code })
      .eq('id', user.id);
    
    navigate('/scout');
  };

  const isAdmin = profile?.role === 'admin';

  const handleCreateClick = () => {
    if (!isAdmin) return;
    if (events.length === 0) {
      setShowPasswordDialog(true);
    } else {
      setShowCreateDialog(true);
    }
  };

  const handlePasswordSubmit = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setShowPasswordDialog(false);
      setAdminPassword('');
      setPasswordError('');
      setShowCreateDialog(true);
    } else {
      setPasswordError('Incorrect admin password');
    }
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
      await loadEvents();
    }

    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Select Event</h1>
          <p className="text-muted-foreground">
            Choose an event to start scouting
          </p>
        </div>

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

        {events.length === 0 ? (
          <div className="data-card text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Events Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create the first event to get started
            </p>
            <Button onClick={handleCreateClick} className="gap-2" disabled={!isAdmin}>
              <Lock className="w-4 h-4" />
              Create Event (Admin)
            </Button>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground mt-2">Only admins can create events</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => handleSelectEvent(event)}
                className="w-full data-card hover:border-primary/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                    <Calendar className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{event.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {event.code}
                    </p>
                  </div>
                  <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    →
                  </div>
                </div>
              </button>
            ))}

            {isAdmin && (
              <Button
                variant="outline"
                onClick={handleCreateClick}
                className="w-full h-14 gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Event
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Admin Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access Required</DialogTitle>
            <DialogDescription>
              Enter the admin password to create the first event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {passwordError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">{passwordError}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                className="h-12"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            <Button onClick={handlePasswordSubmit} className="w-full h-12">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Input
                id="eventCode"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="e.g., CASC2025"
                className="h-12 font-mono uppercase"
                maxLength={20}
                required
              />
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
