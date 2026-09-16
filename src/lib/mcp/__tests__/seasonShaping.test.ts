import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import { BIOBUZZ_POINTS } from '@/lib/prediction';
import {
  seasonForEvent, compactTeamStats, compactMatch, type MatchRow,
} from '@/lib/mcp/scouting';

const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'r1',
  event_code: 'USAZCMP',
  team_number: 12841,
  match_number: 1,
  scouter_id: 's1',
  notes: '',
  created_at: '2026-09-14T10:00:00Z',
  defense_rating: 2,
  auto_fouls_minor: 0,
  penalty_status: 'none',
  auto_leave: true,
  auto_park: true,
  auto_hive_tips: 1,
  auto_fouls_major: 0,
  teleop_hive_tips: 2,
  teleop_cell_remaining: 3,
  teleop_flower_scored: 1,
  teleop_bottom_nectar: 2,
  teleop_garden: 4,
  teleop_park: true,
  ...over,
});

/** Stands in for the Supabase client's `from().select().eq().maybeSingle()`. */
const clientReturning = (data: Record<string, unknown> | null) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data }) }) }) }),
});

describe('seasonForEvent', () => {
  it('resolves the season recorded on the event row', async () => {
    const season = await seasonForEvent(clientReturning({ season_id: 'decode' }), 'USAZCMP');
    expect(season.id).toBe('decode');
  });

  it('falls back to the default when the event is unknown', async () => {
    const season = await seasonForEvent(clientReturning(null), 'NOPE');
    expect(season.id).toBe('biobuzz');
  });

  it('falls back when the column is absent, as it is before the migration runs', async () => {
    const season = await seasonForEvent(clientReturning({}), 'USAZCMP');
    expect(season.id).toBe('biobuzz');
  });

  it('falls back rather than throwing when the query fails', async () => {
    const broken = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => { throw new Error('offline'); } }) }),
      }),
    };
    await expect(seasonForEvent(broken, 'USAZCMP')).resolves.toMatchObject({ id: 'biobuzz' });
  });

  it('ignores a season id the app does not register', async () => {
    const season = await seasonForEvent(clientReturning({ season_id: 'notagame' }), 'USAZCMP');
    expect(season.id).toBe('biobuzz');
  });
});

describe('compactTeamStats', () => {
  it('reports points, not raw DECODE piece counts', () => {
    const stats = compactTeamStats(biobuzz, 12841, [row()]);

    // 3 leave + 5 auto park + 1 tip x 20
    expect(stats.avg_auto_points).toBe(28);
    // 2 tips x 20 + 3 cell x 2 + 1 flower x 2 + 2 nectar x 5 + 4 garden x 1
    expect(stats.avg_teleop_points).toBe(62);
    expect(stats.avg_endgame_points).toBe(BIOBUZZ_POINTS.TELEOP_PARK);
    expect(stats.avg_total_points).toBe(95);
    expect(stats.season).toBe('biobuzz');
  });

  it('names per-element averages by their real columns', () => {
    const stats = compactTeamStats(biobuzz, 12841, [row(), row({ teleop_garden: 0 })]);

    expect(stats.avg_by_element.teleop_garden).toBe(2);
    expect(stats.avg_by_element.teleop_hive_tips).toBe(2);
    // Fouls are reported separately, not as a scoring element.
    expect(stats.avg_by_element.auto_fouls_minor).toBeUndefined();
  });

  it('reports achievement rates as percentages', () => {
    const stats = compactTeamStats(biobuzz, 12841, [row({ teleop_park: true }), row({ teleop_park: false })]);
    expect(stats.rate_pct_by_achievement.teleop_park).toBe(50);
    expect(stats.rate_pct_by_achievement.auto_leave).toBe(100);
  });

  it('carries fouls as points handed to the opponent', () => {
    const stats = compactTeamStats(biobuzz, 12841, [row({ auto_fouls_minor: 2, auto_fouls_major: 1 })]);
    expect(stats.avg_fouls_points_given).toBe(2 * BIOBUZZ_POINTS.MINOR_FOUL + BIOBUZZ_POINTS.MAJOR_FOUL);
  });

  it('returns zeros rather than NaN for a team with no matches', () => {
    const stats = compactTeamStats(biobuzz, 12841, []);
    expect(stats.matches_scouted).toBe(0);
    expect(stats.avg_total_points).toBe(0);
    expect(Number.isNaN(stats.avg_auto_points)).toBe(false);
  });

  it('prices the same row differently under a different season', () => {
    const biobuzzTotal = compactTeamStats(biobuzz, 1, [row()]).avg_total_points;
    const decodeTotal = compactTeamStats(decode, 1, [row()]).avg_total_points;

    expect(biobuzzTotal).toBeGreaterThan(0);
    // None of BIOBUZZ's columns score under DECODE's rules.
    expect(decodeTotal).toBe(0);
  });
});

describe('compactMatch', () => {
  it('prices a single match so an agent can cite it', () => {
    const match = compactMatch(biobuzz, row({ match_number: 7, notes: 'intake jammed' }));

    expect(match.match_number).toBe(7);
    expect(match.total_points).toBe(95);
    expect(match.auto_points).toBe(28);
    expect(match.notes).toBe('intake jammed');
  });

  it('never emits a null note', () => {
    expect(compactMatch(biobuzz, row({ notes: null })).notes).toBe('');
  });
});
