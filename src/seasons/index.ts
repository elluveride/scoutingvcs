/**
 * Active season switchboard.
 *
 * To add the next FTC season:
 *  1. Copy `biobuzz.ts` to e.g. `nextSeason.ts`
 *  2. Update its `id`, `name`, `seasonYear`, `pointsEach` values, and field list
 *  3. Register it in `SEASONS` below and set `DEFAULT_SEASON_ID`
 *  4. Add a migration for any new match_entries columns
 *
 * Which season an *event* is scouted under is stored on the event row and
 * switched from `/season-setup`; `DEFAULT_SEASON_ID` is only the starting
 * point for new events and the fallback for rows that predate the column.
 */
import type { SeasonConfig } from './types';
import { decode } from './decode';
import { biobuzz } from './biobuzz';

export const SEASONS: Record<string, SeasonConfig> = {
  decode,
  biobuzz,
};

export const DEFAULT_SEASON_ID = 'biobuzz';

/** Every registered season, newest game first. */
export const SEASON_LIST: SeasonConfig[] = Object.values(SEASONS).sort(
  (a, b) => b.seasonYear - a.seasonYear,
);

export const CURRENT_SEASON: SeasonConfig = SEASONS[DEFAULT_SEASON_ID];

/** Look a season up by id, falling back to the default rather than throwing. */
export function seasonById(id: string | null | undefined): SeasonConfig {
  return (id && SEASONS[id]) || SEASONS[DEFAULT_SEASON_ID];
}

/**
 * A season with the scoring fields an event switched off removed. A disabled
 * field is treated as if it were never part of the game: it vanishes from the
 * scout form, the spreadsheet columns, QR payloads, and the ranking. Fouls,
 * ratings, and unscored fields are always kept.
 */
export function applyDisabledFields(
  season: SeasonConfig,
  disabled: string[] | null | undefined,
): SeasonConfig {
  if (!disabled || disabled.length === 0) return season;
  const off = new Set(disabled);
  return {
    ...season,
    counters: season.counters.filter((c) => !(off.has(c.key) && (c.role ?? 'score') === 'score')),
    toggles: season.toggles.filter((t) => !(off.has(t.key) && (t.role ?? 'score') === 'score')),
  };
}

export type { SeasonConfig } from './types';
