import { describe, it, expect } from 'vitest';
import { evaluateMissingInputs, detectMatchConflicts, type ConflictRow } from '../missingData';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';

describe('evaluateMissingInputs', () => {
  it('flags teams with zero matches as no_match_data', () => {
    const res = evaluateMissingInputs({
      teamNumbers: [123],
      matchCountByTeam: { 123: 0 },
      pitScoutedTeams: new Set([123]),
    });
    expect(res[0].reasons).toContain('no_match_data');
  });

  it('flags teams with <3 matches as low_sample (not no_match_data)', () => {
    const res = evaluateMissingInputs({
      teamNumbers: [123],
      matchCountByTeam: { 123: 2 },
      pitScoutedTeams: new Set([123]),
    });
    expect(res[0].reasons).toContain('low_sample');
    expect(res[0].reasons).not.toContain('no_match_data');
  });

  it('flags teams missing a pit entry', () => {
    const res = evaluateMissingInputs({
      teamNumbers: [99],
      matchCountByTeam: { 99: 5 },
      pitScoutedTeams: new Set(),
    });
    expect(res[0].reasons).toContain('no_pit_data');
  });

  it('returns no entry for fully scouted teams', () => {
    const res = evaluateMissingInputs({
      teamNumbers: [42],
      matchCountByTeam: { 42: 4 },
      pitScoutedTeams: new Set([42]),
    });
    expect(res).toHaveLength(0);
  });
});

describe('detectMatchConflicts', () => {
  const base = {
    event_code: 'E', team_number: 1, match_number: 1,
    auto_leave: false, auto_park: false, auto_hive_tips: 0,
    teleop_hive_tips: 0, teleop_cell_remaining: 0, teleop_flower_scored: 0,
    teleop_bottom_nectar: 0, teleop_garden: 0, teleop_park: false,
    auto_fouls_minor: 0, auto_fouls_major: 0,
    defense_rating: 0, penalty_status: 'none',
  };

  it('flags conflicts when totals diverge by >= the threshold', () => {
    const entries: ConflictRow[] = [
      { ...base, id: 'a', scouter_id: 's1', teleop_hive_tips: 1 },
      { ...base, id: 'b', scouter_id: 's2', teleop_hive_tips: 0 },
    ];
    const conflicts = detectMatchConflicts(biobuzz, entries);
    expect(conflicts.size).toBe(2);
    expect(conflicts.has('a')).toBe(true);
    expect(conflicts.has('b')).toBe(true);
  });

  it('does not flag near-identical entries', () => {
    const entries: ConflictRow[] = [
      { ...base, id: 'a', scouter_id: 's1', teleop_garden: 5 },
      { ...base, id: 'b', scouter_id: 's2', teleop_garden: 5 },
    ];
    expect(detectMatchConflicts(biobuzz, entries).size).toBe(0);
  });

  it('ignores single-scout matches', () => {
    const entries: ConflictRow[] = [{ ...base, id: 'a', scouter_id: 's1', teleop_hive_tips: 9 }];
    expect(detectMatchConflicts(biobuzz, entries).size).toBe(0);
  });

  it('prices the disagreement with the season it is given', () => {
    // One garden element apart is 1 pt under BIOBUZZ — below the threshold.
    const entries: ConflictRow[] = [
      { ...base, id: 'a', scouter_id: 's1', teleop_garden: 1 },
      { ...base, id: 'b', scouter_id: 's2', teleop_garden: 0 },
    ];
    expect(detectMatchConflicts(biobuzz, entries).size).toBe(0);
  });

  it('scores DECODE rows with DECODE values', () => {
    const decodeBase = {
      event_code: 'E', team_number: 1, match_number: 1,
      auto_scored_close: 0, teleop_scored_close: 0, endgame_return: 'not_returned',
      auto_fouls_minor: 0, auto_fouls_major: 0, defense_rating: 0, penalty_status: 'none',
    };
    const entries: ConflictRow[] = [
      { ...decodeBase, id: 'a', scouter_id: 's1', auto_scored_close: 4 },
      { ...decodeBase, id: 'b', scouter_id: 's2', auto_scored_close: 0 },
    ];
    // 4 × 3 pts = a 12 pt spread.
    expect(detectMatchConflicts(decode, entries).size).toBe(2);
  });
});
