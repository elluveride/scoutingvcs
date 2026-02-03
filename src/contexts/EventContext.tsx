import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setEvents(data.map(e => ({
        id: e.id,
        code: e.code,
        name: e.name,
      })));
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
