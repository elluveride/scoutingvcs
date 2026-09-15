import { describe, it, expect } from 'vitest';
import { biobuzz } from '@/seasons/biobuzz';
import { decode } from '@/seasons/decode';
import { BIOBUZZ_POINTS } from '@/lib/prediction';
import {
  scoreEntry, aggregateTeam, seasonMetrics, metricIndex, defaultWeights, selectionScore,
} from '@/lib/seasonScoring';

/** A tidy BIOBUZZ match whose value is easy to check by hand. */
const entry = (over: Record<string, unknown> = {}) => ({
  auto_leave: true,
  auto_park: true,
  auto_hive_tips: 1,
  auto_fouls_minor: 0,
  auto_fouls_major: 0,
  teleop_hive_tips: 2,
  teleop_cell_remaining: 3,
  teleop_flower_scored: 1,
  teleop_bottom_nectar: 2,
  teleop_garden: 4,
  teleop_park: true,
  defense_rating: 2,
  penalty_status: 'none',
  ...over,
});

describe('scoreEntry — BIOBUZZ', () => {
  it('prices each phase from the season config', () => {
    const score = scoreEntry(biobuzz, entry());

    // 3 leave + 5 auto park + 1 tip × 20
    expect(score.auto).toBe(28);
    // 2 tips × 20 + 3 cell × 2 + 1 flower × 2 + 2 nectar × 5 + 4 garden × 1
    expect(score.teleop).toBe(62);
    expect(score.endgame).toBe(BIOBUZZ_POINTS.TELEOP_PARK);
    expect(score.total).toBe(28 + 62 + 5);
  });

  it('keeps fouls out of the robot score and counts them for the opponent', () => {
    const clean = scoreEntry(biobuzz, entry());
    const fouled = scoreEntry(biobuzz, entry({ auto_fouls_minor: 2, auto_fouls_major: 1 }));

    expect(fouled.total).toBe(clean.total);
    expect(fouled.foulsGiven).toBe(2 * BIOBUZZ_POINTS.MINOR_FOUL + BIOBUZZ_POINTS.MAJOR_FOUL);
  });

  it('never scores the defense rating, which is a judgement not a point value', () => {
    expect(scoreEntry(biobuzz, entry({ defense_rating: 3 })).total)
      .toBe(scoreEntry(biobuzz, entry({ defense_rating: 0 })).total);
  });

  it('treats missing columns as zero rather than NaN', () => {
    const score = scoreEntry(biobuzz, { team_number: 1, match_number: 1 });
    expect(score.total).toBe(0);
    expect(Number.isNaN(score.teleop)).toBe(false);
  });
});

describe('scoreEntry — DECODE', () => {
  it('prices the endgame return enum off the season ENDGAME table', () => {
    const base = { auto_scored_close: 2, teleop_scored_close: 4 };
    const full = scoreEntry(decode, { ...base, endgame_return: 'full' });
    const none = scoreEntry(decode, { ...base, endgame_return: 'not_returned' });

    expect(full.endgame).toBe(decode.points.ENDGAME.full);
    expect(none.endgame).toBe(0);
    expect(full.auto).toBe(2 * decode.points.CLASSIFIED_AUTO);
  });
});

describe('aggregateTeam', () => {
  it('returns a zeroed row when a team has no entries', () => {
    const stats = aggregateTeam(biobuzz, 12841, []);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.avgTotal).toBe(0);
    expect(stats.consistency).toBe(0);
  });

  it('averages counters and rates toggles across matches', () => {
    const stats = aggregateTeam(biobuzz, 12841, [
      entry({ auto_hive_tips: 0, teleop_park: false }),
      entry({ auto_hive_tips: 2, teleop_park: true }),
    ]);

    expect(stats.matchesPlayed).toBe(2);
    expect(stats.avg.auto_hive_tips).toBe(1);
    expect(stats.rate.teleop_park).toBe(50);
    expect(stats.rate.auto_leave).toBe(100);
  });

  it('scores a perfectly repeatable team at 100% consistency', () => {
    const stats = aggregateTeam(biobuzz, 1, [entry(), entry(), entry()]);
    expect(stats.varianceScore).toBe(0);
    expect(stats.consistency).toBe(100);
  });

  it('drops consistency for a team whose output swings', () => {
    const steady = aggregateTeam(biobuzz, 1, [entry(), entry()]);
    const swingy = aggregateTeam(biobuzz, 2, [
      entry({ teleop_hive_tips: 0 }),
      entry({ teleop_hive_tips: 6 }),
    ]);
    expect(swingy.consistency).toBeLessThan(steady.consistency);
  });

  it('counts cards and dead robots as failures', () => {
    const stats = aggregateTeam(biobuzz, 1, [
      entry({ penalty_status: 'none' }),
      entry({ penalty_status: 'dead' }),
      entry({ penalty_status: 'yellow_card' }),
      entry({ penalty_status: 'none' }),
    ]);
    expect(stats.penaltyRate).toBe(50);
  });
});

describe('seasonMetrics', () => {
  it('builds a metric for every scoring counter and toggle of the season', () => {
    const ids = new Set(seasonMetrics(biobuzz).flatMap((c) => c.metrics).map((m) => m.id));

    expect(ids.has('avg:teleop_hive_tips')).toBe(true);
    expect(ids.has('rate:auto_leave')).toBe(true);
    expect(ids.has('predAuto')).toBe(true);
    // Fouls are a penalty metric, never an "average element" one.
    expect(ids.has('avg:auto_fouls_minor')).toBe(false);
    expect(ids.has('foul:auto_fouls_minor')).toBe(true);
  });

  it('gives DECODE its own metric set, not BIOBUZZ\'s', () => {
    const ids = new Set(seasonMetrics(decode).flatMap((c) => c.metrics).map((m) => m.id));
    expect(ids.has('avg:teleop_scored_close')).toBe(true);
    expect(ids.has('avg:teleop_hive_tips')).toBe(false);
  });
});

describe('selectionScore', () => {
  const metrics = metricIndex(biobuzz);

  it('multiplies each enabled metric by its weight', () => {
    const stats = aggregateTeam(biobuzz, 1, [entry()]);
    const score = selectionScore(stats, [
      { id: 'predAuto', label: 'Auto', weight: 2, enabled: true },
    ], metrics);

    expect(score).toBe(stats.avgAuto * 2);
  });

  it('ignores disabled weights', () => {
    const stats = aggregateTeam(biobuzz, 1, [entry()]);
    const score = selectionScore(stats, [
      { id: 'predAuto', label: 'Auto', weight: 2, enabled: false },
    ], metrics);
    expect(score).toBe(0);
  });

  it('ignores weights this season does not define, so a saved DECODE config is harmless', () => {
    const stats = aggregateTeam(biobuzz, 1, [entry()]);
    const score = selectionScore(stats, [
      { id: 'avg:teleop_scored_close', label: 'TeleOp Close', weight: 5, enabled: true },
      { id: 'predAuto', label: 'Auto', weight: 1, enabled: true },
    ], metrics);

    expect(score).toBe(stats.avgAuto);
  });

  it('routes unknown ids through the extra hook for API metrics', () => {
    const stats = aggregateTeam(biobuzz, 1, [entry()]);
    const score = selectionScore(
      stats,
      [{ id: 'apiRank', label: 'Rank', weight: 2, enabled: true }],
      metrics,
      (id) => (id === 'apiRank' ? 5 : null),
    );
    expect(score).toBe(10);
  });

  it('defaultWeights covers every metric the season declares', () => {
    const weights = defaultWeights(biobuzz);
    const ids = new Set(seasonMetrics(biobuzz).flatMap((c) => c.metrics).map((m) => m.id));
    expect(weights).toHaveLength(ids.size);
    expect(weights.every((w) => ids.has(w.id))).toBe(true);
  });
});
