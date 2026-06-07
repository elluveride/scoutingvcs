/**
 * Active season switchboard.
 *
 * To shift the app to the next FTC season:
 *  1. Copy `decode.ts` to e.g. `nextSeason.ts`
 *  2. Update its `id`, `name`, `seasonYear`, point values, and field list
 *  3. Set `CURRENT_SEASON` below to the new config
 *  4. Add a Supabase migration for any new/renamed match_entries columns
 *
 * Until step 4 is run, leave CURRENT_SEASON pointed at `decode` — the DB
 * schema must change in lockstep with the config.
 */
import type { SeasonConfig } from './types';
import { decode } from './decode';

export const SEASONS: Record<string, SeasonConfig> = {
  decode,
};

export const CURRENT_SEASON: SeasonConfig = decode;

export type { SeasonConfig } from './types';
