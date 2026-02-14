import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'cipher_current_event';

interface Event {
  id: string;
  code: string;
  name: string;
}

interface EventContextType {
  currentEvent: Event | null;
  events: Event[];
  setCurrentEvent: (event: Event | null) => void;
  loadEvents: () => Promise<void>;
  createEvent: (code: string, name: string) => Promise<{ error: Error | null }>;
  eventExpired: boolean;
  clearExpired: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEvent, setCurrentEventState] = useState<Event | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [eventExpired, setEventExpired] = useState(false);

  const setCurrentEvent = useCallback((event: Event | null) => {
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
    setCurrentEventState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      const loadedEvents = data.map(e => ({
        id: e.id,
        code: e.code,
        name: e.name,
      }));
      setEvents(loadedEvents);

      // Check if persisted event still exists (it may have been archived/deleted)
      if (currentEvent) {
        const stillExists = loadedEvents.some(e => e.code === currentEvent.code);
        if (!stillExists) {
          // Check if it was archived (has data) vs deleted (no data)
          const { data: archivedEvent } = await supabase
            .from('events')
            .select('code, archived')
            .eq('code', currentEvent.code)
            .eq('archived', true)
            .maybeSingle();

          if (archivedEvent) {
            // Event was archived — show expiry message
            setEventExpired(true);
          }
          setCurrentEventState(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  };

  const createEvent = async (code: string, name: string) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('events').insert({
      code,
      name,
      created_by: userData.user?.id,
    });

    if (!error) {
      await loadEvents();
    }

    return { error: error as Error | null };
  };

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
