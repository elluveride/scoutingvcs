/**
 * Active season switchboard.
 *
 * To shift the app to the next FTC season:
 *  1. Copy `biobuzz.ts` to e.g. `nextSeason.ts`
 *  2. Update its `id`, `name`, `seasonYear`, point values, and field list
 *  3. Set `CURRENT_SEASON` below to the new config
 *  4. Add a migration for any new match_entries columns
 */
import type { SeasonConfig } from './types';
import { decode } from './decode';
import { biobuzz } from './biobuzz';

export const SEASONS: Record<string, SeasonConfig> = {
  decode,
  biobuzz,
};

export const CURRENT_SEASON: SeasonConfig = biobuzz;

export type { SeasonConfig } from './types';
