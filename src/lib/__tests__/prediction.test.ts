import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import { BIOBUZZ_POINTS } from '@/lib/prediction';
import { predictTeam, type MatchEntryLite } from '@/lib/prediction';

const match = (over: Partial<MatchEntryLite> = {}): MatchEntryLite => ({
  auto_leave: true,
  auto_park: false,
  auto_hive_tips: 1,
  auto_fouls_minor: 0,
  auto_fouls_major: 0,
  teleop_hive_tips: 2,
  teleop_cell_remaining: 4,
  teleop_flower_scored: 0,
  teleop_bottom_nectar: 1,
  teleop_garden: 3,
  teleop_park: true,
  defense_rating: 1,
  penalty_status: 'none',
  ...over,
});

describe('predictTeam — BIOBUZZ', () => {
  it('returns an empty prediction for a team with no scouted matches', () => {
    const pred = predictTeam(biobuzz, 12841, []);
    expect(pred.matchCount).toBe(0);
    expect(pred.predictedTotal).toBe(0);
    expect(pred.breakdown.auto).toEqual([]);
  });

  it('prices a single match exactly like the live scout total', () => {
    const pred = predictTeam(biobuzz, 12841, [match()]);

    // 3 leave + 1 tip × 20
    expect(pred.predictedAuto).toBe(23);
    // 2 tips × 20 + 4 cell × 2 + 1 nectar × 5 + 3 garden × 1
    expect(pred.predictedTeleop).toBe(56);
    expect(pred.predictedEndgame).toBe(BIOBUZZ_POINTS.TELEOP_PARK);
    expect(pred.predictedTotal).toBe(84);
  });

  it('breaks each phase down biggest contributor first', () => {
    const lines = predictTeam(biobuzz, 1, [match()]).breakdown.teleop;
    expect(lines[0].key).toBe('teleop_hive_tips');
    expect(lines.map((l) => l.points)).toEqual([...lines.map((l) => l.points)].sort((a, b) => b - a));
  });

  it('weights recent matches more heavily than early ones', () => {
    const improving = predictTeam(biobuzz, 1, [
      match({ teleop_hive_tips: 0 }),
      match({ teleop_hive_tips: 4 }),
    ]);
    const declining = predictTeam(biobuzz, 2, [
      match({ teleop_hive_tips: 4 }),
      match({ teleop_hive_tips: 0 }),
    ]);

    // Same matches, opposite order — the team trending up must predict higher.
    expect(improving.predictedTeleop).toBeGreaterThan(declining.predictedTeleop);
  });

  it('counts fouls as points handed to the opponent, not lost by the robot', () => {
    const clean = predictTeam(biobuzz, 1, [match()]);
    const fouled = predictTeam(biobuzz, 2, [match({ auto_fouls_minor: 2 })]);

    expect(fouled.predictedTotal).toBe(clean.predictedTotal);
    expect(fouled.foulsGivenToOpponent).toBe(2 * BIOBUZZ_POINTS.MINOR_FOUL);
  });

  it('maps endgame park onto the legacy fullReturnRate field the Pit Display reads', () => {
    const pred = predictTeam(biobuzz, 1, [match({ teleop_park: true }), match({ teleop_park: false })]);
    expect(pred.fullReturnRate).toBe(50);
    expect(pred.leaveRate).toBe(100);
  });
});

describe('predictTeam — DECODE', () => {
  it('keeps the legacy return-status rates populated', () => {
    const rows: MatchEntryLite[] = [
      { defense_rating: 0, auto_fouls_minor: 0, penalty_status: 'none', endgame_return: 'lift', auto_scored_close: 2 },
      { defense_rating: 0, auto_fouls_minor: 0, penalty_status: 'none', endgame_return: 'partial', auto_scored_close: 2 },
    ];
    const pred = predictTeam(decode, 1, rows);

    expect(pred.liftRate).toBe(50);
    expect(pred.partialReturnRate).toBe(50);
    expect(pred.predictedEndgame).toBeGreaterThan(0);
  });

  it('does not leak BIOBUZZ fields into a DECODE prediction', () => {
    const pred = predictTeam(decode, 1, [
      { defense_rating: 0, auto_fouls_minor: 0, penalty_status: 'none', teleop_hive_tips: 99 },
    ]);
    expect(pred.predictedTeleop).toBe(0);
  });
});
