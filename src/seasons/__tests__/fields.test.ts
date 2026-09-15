import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import { SEASONS, SEASON_LIST, seasonById, DEFAULT_SEASON_ID } from '@/seasons';
import {
  matchFields, pitFields, countersForPhase, togglesForPhase, foulCounters, emptyRecord,
} from '@/seasons/fields';

describe('season registry', () => {
  it('resolves a known season and falls back rather than throwing', () => {
    expect(seasonById('decode').id).toBe('decode');
    expect(seasonById('a-game-that-does-not-exist').id).toBe(DEFAULT_SEASON_ID);
    expect(seasonById(null).id).toBe(DEFAULT_SEASON_ID);
  });

  it('lists seasons newest first', () => {
    expect(SEASON_LIST[0].seasonYear).toBeGreaterThanOrEqual(SEASON_LIST[SEASON_LIST.length - 1].seasonYear);
  });
});

describe('matchFields', () => {
  it('always leads with team and match number', () => {
    expect(matchFields(biobuzz).slice(0, 2).map((f) => f.key)).toEqual(['team_number', 'match_number']);
  });

  it('covers every counter, toggle and enum of the season exactly once', () => {
    const keys = matchFields(biobuzz).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const c of biobuzz.counters) expect(keys).toContain(c.key);
    for (const t of biobuzz.toggles) expect(keys).toContain(t.key);
    for (const e of biobuzz.enums) expect(keys).toContain(e.key);
  });

  it('types a numeric-option enum as an int, not a string', () => {
    const defense = matchFields(biobuzz).find((f) => f.key === 'defense_rating');
    expect(defense?.type).toBe('int');

    const penalty = matchFields(biobuzz).find((f) => f.key === 'penalty_status');
    expect(penalty?.type).toBe('enum');
    expect(penalty?.options).toContain('yellow_card');
  });

  it('marks toggles as booleans', () => {
    expect(matchFields(biobuzz).find((f) => f.key === 'auto_leave')?.type).toBe('bool');
  });

  it('gives DECODE its own column list', () => {
    const keys = matchFields(decode).map((f) => f.key);
    expect(keys).toContain('auto_scored_close');
    expect(keys).toContain('endgame_return');
    expect(keys).not.toContain('teleop_hive_tips');
  });
});

describe('pitFields', () => {
  it('includes every capability the season declares', () => {
    const keys = pitFields(biobuzz).map((f) => f.key);
    for (const c of biobuzz.pit.capabilities) expect(keys).toContain(c.key);
    expect(keys).toContain('team_name');
  });

  it('does not carry the previous season\'s capabilities', () => {
    expect(pitFields(biobuzz).map((f) => f.key)).not.toContain('scores_motifs');
    expect(pitFields(decode).map((f) => f.key)).not.toContain('can_tip_hive');
  });
});

describe('phase grouping', () => {
  it('keeps fouls out of the phase sections and in their own group', () => {
    const autoKeys = countersForPhase(biobuzz, 'auto').map((c) => c.key);
    expect(autoKeys).toContain('auto_hive_tips');
    expect(autoKeys).not.toContain('auto_fouls_minor');

    expect(foulCounters(biobuzz).map((c) => c.key))
      .toEqual(['auto_fouls_minor', 'auto_fouls_major']);
  });

  it('files each toggle under its own phase', () => {
    expect(togglesForPhase(biobuzz, 'endgame').map((t) => t.key)).toEqual(['teleop_park']);
    expect(togglesForPhase(biobuzz, 'auto').map((t) => t.key)).toEqual(['auto_leave', 'auto_park']);
  });
});

describe('emptyRecord', () => {
  it('seeds a blank entry with type-correct defaults', () => {
    const blank = emptyRecord(matchFields(biobuzz));
    expect(blank.auto_hive_tips).toBe(0);
    expect(blank.auto_leave).toBe(false);
    expect(blank.penalty_status).toBe('none');
    expect(blank.notes).toBe('');
  });
});

describe('every registered season', () => {
  it.each(Object.values(SEASONS).map((s) => [s.id, s] as const))(
    '%s declares points for each scoring field',
    (_id, season) => {
      const scoring = [
        ...season.counters.filter((c) => (c.role ?? 'score') === 'score'),
        ...season.toggles.filter((t) => (t.role ?? 'score') === 'score'),
      ];
      for (const field of scoring) {
        expect(typeof field.pointsEach, `${field.key} needs pointsEach`).toBe('number');
      }
    },
  );

  it.each(Object.values(SEASONS).map((s) => [s.id, s] as const))(
    '%s prices fouls for both severities',
    (_id, season) => {
      const roles = season.counters.map((c) => c.role);
      expect(roles).toContain('foul_minor');
      expect(roles).toContain('foul_major');
    },
  );
});
