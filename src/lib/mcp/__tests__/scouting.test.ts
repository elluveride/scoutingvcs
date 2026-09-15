import { describe, it, expect } from 'vitest';
import {
  assertEventCode, latestPerMatch, groupByTeam, summarizeAlliance, compactPrediction, predictFor,
  type MatchRow,
} from '@/lib/mcp/scouting';

const row = (over: Partial<MatchRow> & { team_number: number; match_number: number }): MatchRow => ({
  id: `${over.team_number}-${over.match_number}-${over.created_at ?? '0'}`,
  event_code: 'USAZCMP',
  scouter_id: 'scout-1',
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  auto_leave: false,
  auto_park: false,
  auto_hive_tips: 0,
  teleop_hive_tips: 0,
  teleop_cell_remaining: 0,
  teleop_flower_scored: 0,
  teleop_bottom_nectar: 0,
  teleop_garden: 0,
  teleop_park: false,
  defense_rating: 0,
  auto_fouls_minor: 0,
  auto_fouls_major: 0,
  penalty_status: 'none',
  ...over,
});

describe('assertEventCode', () => {
  it('accepts normal FTC codes and trims', () => {
    expect(assertEventCode(' USAZCMP ')).toBe('USAZCMP');
    expect(assertEventCode('2025USAZCMP')).toBe('2025USAZCMP');
  });

  it('rejects anything that is not a plain code', () => {
    expect(() => assertEventCode('')).toThrow();
    expect(() => assertEventCode('a b')).toThrow();
    expect(() => assertEventCode("x'; drop table match_entries;--")).toThrow();
    expect(() => assertEventCode('x'.repeat(33))).toThrow();
  });
});

describe('latestPerMatch', () => {
  it('keeps only the newest entry per team and match', () => {
    const rows = [
      row({ team_number: 12841, match_number: 1, created_at: '2026-01-01T10:00:00.000Z', teleop_hive_tips: 1 }),
      row({ team_number: 12841, match_number: 1, created_at: '2026-01-01T12:00:00.000Z', teleop_hive_tips: 9 }),
      row({ team_number: 12841, match_number: 2, created_at: '2026-01-01T11:00:00.000Z' }),
    ];
    const out = latestPerMatch(rows);
    expect(out).toHaveLength(2);
    expect(out[0].teleop_hive_tips).toBe(9);
  });

  it('sorts by team then match so output is stable', () => {
    const out = latestPerMatch([
      row({ team_number: 2844, match_number: 5 }),
      row({ team_number: 12841, match_number: 2 }),
      row({ team_number: 2844, match_number: 1 }),
    ]);
    expect(out.map((r) => [r.team_number, r.match_number])).toEqual([
      [2844, 1],
      [2844, 5],
      [12841, 2],
    ]);
  });
});

describe('groupByTeam', () => {
  it('buckets rows by team number', () => {
    const g = groupByTeam([
      row({ team_number: 1, match_number: 1 }),
      row({ team_number: 1, match_number: 2 }),
      row({ team_number: 2, match_number: 1 }),
    ]);
    expect(g.get(1)).toHaveLength(2);
    expect(g.get(2)).toHaveLength(1);
  });
});

describe('summarizeAlliance', () => {
  const scored = (team: number, n: number) =>
    Array.from({ length: n }, (_, i) =>
      row({ team_number: team, match_number: i + 1, teleop_hive_tips: 5, auto_leave: true }),
    );

  it('adds up both teams and reports how many have data', () => {
    const byTeam = groupByTeam([...scored(111, 4), ...scored(222, 4)]);
    const a = summarizeAlliance([111, 222], byTeam);
    expect(a.teams_with_data).toBe(2);
    expect(a.predicted_total).toBeGreaterThan(0);
    expect(a.breakdown).toHaveLength(2);
  });

  it('counts an unscouted team as zero and lowers confidence', () => {
    const byTeam = groupByTeam(scored(111, 4));
    const both = summarizeAlliance([111, 999], byTeam);
    const alone = summarizeAlliance([111], byTeam);
    expect(both.teams_with_data).toBe(1);
    expect(both.predicted_total).toBe(alone.predicted_total);
    expect(both.confidence_pct).toBeLessThan(alone.confidence_pct);
  });

  it('reports zero confidence when nothing is scouted', () => {
    const a = summarizeAlliance([111, 222], new Map());
    expect(a.confidence_pct).toBe(0);
    expect(a.predicted_total).toBe(0);
    expect(a.teams_with_data).toBe(0);
  });
});

describe('compactPrediction', () => {
  it('exposes snake_case fields for agents', () => {
    const p = compactPrediction(predictFor(12841, [row({ team_number: 12841, match_number: 1 })]));
    expect(p).toHaveProperty('team_number', 12841);
    expect(p).toHaveProperty('predicted_total');
    expect(p).toHaveProperty('consistency_pct');
    expect(Object.keys(p).every((k) => k === k.toLowerCase())).toBe(true);
  });
});
