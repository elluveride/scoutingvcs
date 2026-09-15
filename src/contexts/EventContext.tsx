import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { DEFAULT_SEASON_ID } from '@/seasons';

const STORAGE_KEY = 'cipher_current_event';

interface Event {
  id: string;
  code: string;
  name: string;
  /** Season config id this event is scouted under (see src/seasons). */
  seasonId: string;
}

interface EventContextType {
  currentEvent: Event | null;
  events: Event[];
  setCurrentEvent: (event: Event | null) => void;
  loadEvents: () => Promise<void>;
  createEvent: (code: string, name: string, seasonId?: string) => Promise<{ error: Error | null }>;
  /** Repoint the current event at a different season. Admin-gated by RLS. */
  setEventSeason: (seasonId: string) => Promise<{ error: Error | null }>;
  eventExpired: boolean;
  clearExpired: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEvent, setCurrentEventState] = useState<Event | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as Partial<Event>;
      // Events persisted before season_id existed have no seasonId.
      return parsed.code ? { ...parsed, seasonId: parsed.seasonId ?? DEFAULT_SEASON_ID } as Event : null;
    } catch {
      return null;
    }
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [eventExpired, setEventExpired] = useState(false);

  // `loadEvents` is handed to a realtime subscription that is created once, so
  // it would otherwise read the `currentEvent` from that first render forever.
  const currentEventRef = useRef(currentEvent);

  const setCurrentEvent = useCallback((event: Event | null) => {
    currentEventRef.current = event;
    setCurrentEventState(event);
    setEventExpired(false);
    if (event) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearExpired = useCallback(() => {
    setEventExpired(false);
    currentEventRef.current = null;
    setCurrentEventState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (data && !error) {
      const loadedEvents = data.map(e => ({
        id: e.id,
        code: e.code,
        name: e.name,
        seasonId: e.season_id ?? DEFAULT_SEASON_ID,
      }));
      setEvents(loadedEvents);

      const active = currentEventRef.current;

      // Keep the local copy in step with the server — an admin can switch the
      // season from another device mid-event, and every scout must follow.
      if (active) {
        const fresh = loadedEvents.find(e => e.code === active.code);
        if (fresh && fresh.seasonId !== active.seasonId) {
          setCurrentEvent(fresh);
        }
      }

      // Check if persisted event still exists (it may have been archived/deleted)
      if (active) {
        const stillExists = loadedEvents.some(e => e.code === active.code);
        if (!stillExists) {
          // Check if it was archived (has data) vs deleted (no data)
          const { data: archivedEvent } = await supabase
            .from('events')
            .select('code, archived')
            .eq('code', active.code)
            .eq('archived', true)
            .maybeSingle();

          if (archivedEvent) {
            // Event was archived — show expiry message
            setEventExpired(true);
          }
          currentEventRef.current = null;
          setCurrentEventState(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  };

  const createEvent = async (code: string, name: string, seasonId: string = DEFAULT_SEASON_ID) => {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('events').insert({
      code,
      name,
      season_id: seasonId,
      created_by: userData.user?.id,
    });

    if (!error) {
      await loadEvents();
    }

    return { error: error as Error | null };
  };

  const setEventSeason = useCallback(async (seasonId: string) => {
    const active = currentEventRef.current;
    if (!active) return { error: new Error('No event selected.') };

    const { error } = await supabase
      .from('events')
      .update({ season_id: seasonId })
      .eq('code', active.code);

    if (!error) {
      setCurrentEvent({ ...active, seasonId });
      await loadEvents();
    }
    return { error: error as Error | null };
  }, [setCurrentEvent]);

  useEffect(() => {
    loadEvents();

    // Re-fetch events when auth state changes (fixes events not loading after login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadEvents();
    });

    // Subscribe to realtime updates for events
    const channel = supabase
      .channel('events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        () => {
          loadEvents();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <EventContext.Provider
      value={{
        currentEvent,
        events,
        setCurrentEvent,
        loadEvents,
        createEvent,
        setEventSeason,
        eventExpired,
        clearExpired,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};
