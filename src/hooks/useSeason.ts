/**
 * The season the *current event* is being scouted under.
 *
 * Screens should read this rather than importing `CURRENT_SEASON` directly:
 * the constant is the app-wide default for a brand new event, while this is
 * what the lead actually picked on `/season-setup`.
 */
import { useMemo } from 'react';
import { useEvent } from '@/contexts/EventContext';
import { seasonById, DEFAULT_SEASON_ID } from '@/seasons';
import type { SeasonConfig } from '@/seasons/types';

export function useSeason(): SeasonConfig {
  const { currentEvent } = useEvent();
  const id = currentEvent?.seasonId ?? DEFAULT_SEASON_ID;
  return useMemo(() => seasonById(id), [id]);
}
