import { describe, it, expect } from 'vitest';
import { evaluateMissingInputs, detectMatchConflicts } from '../missingData';

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
    auto_scored_close: 0, auto_scored_far: 0,
    teleop_scored_close: 0, teleop_scored_far: 0,
    on_launch_line: false, endgame_return: 'not_returned',
    auto_fouls_minor: 0,
  };

  it('flags conflicts when totals diverge by >=4 points', () => {
    const entries = [
      { ...base, id: 'a', scouter_id: 's1', auto_scored_close: 10 },
      { ...base, id: 'b', scouter_id: 's2', auto_scored_close: 0 },
    ];
    const conflicts = detectMatchConflicts(entries as any);
    expect(conflicts.size).toBe(2);
    expect(conflicts.has('a')).toBe(true);
    expect(conflicts.has('b')).toBe(true);
  });

  it('does not flag near-identical entries', () => {
    const entries = [
      { ...base, id: 'a', scouter_id: 's1', teleop_scored_close: 5 },
      { ...base, id: 'b', scouter_id: 's2', teleop_scored_close: 5 },
    ];
    expect(detectMatchConflicts(entries as any).size).toBe(0);
  });

  it('ignores single-scout matches', () => {
    const entries = [{ ...base, id: 'a', scouter_id: 's1', auto_scored_close: 99 }];
    expect(detectMatchConflicts(entries as any).size).toBe(0);
  });
});
