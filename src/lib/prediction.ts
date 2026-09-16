/**
 * Match prediction.
 *
 * Point values live on the season config's fields; this module reads them
 * through `scoreEntry`/`aggregateTeam` so the Planner and the Dashboard price a
 * match identically. The `POINTS` tables below are what those configs are built
 * from, and stay exported for the reference panel on the Planner.
 */
import type { SeasonConfig } from '@/seasons/types';
import { scoreEntry, aggregateTeam } from '@/lib/seasonScoring';

// BIOBUZZ 2026-2027 Official Point Values (Competition Manual V1)
export const BIOBUZZ_POINTS = {
  LEAVE: 3,
  AUTO_PARK: 5,
  TELEOP_PARK: 5,
  HIVE_TIP: 20,
  CELL_REMAINING: 2,
  BOTTOM_NECTAR_BONUS: 5,
  FLOWER: 2,
  GARDEN: 1,
  MINOR_FOUL: 5,
  MAJOR_FOUL: 20,
} as const;

/** Active-season point values consumed by the prediction surfaces. */
export const POINTS = BIOBUZZ_POINTS;

/** Legacy DECODE (2025-26) values, kept so archived data can still be scored. */
export const DECODE_POINTS = {
  LEAVE: 3,
  CLASSIFIED_AUTO: 3,
  CLASSIFIED_TELEOP: 3,
  OVERFLOW_AUTO: 1,
  OVERFLOW_TELEOP: 1,
  DEPOT: 1,
  PATTERN_MATCH: 2,
  BASE_PARTIAL: 5,
  BASE_FULL: 10,
  BASE_BOTH_FULL_BONUS: 10,
  MINOR_FOUL: 5,
  MAJOR_FOUL: 15,
} as const;

/**
 * A scouted row, loosely typed.
 *
 * Which columns are present depends on the season; prediction reads them through
 * the season config rather than by name, so this only pins the ones every
 * surface touches.
 */
export interface MatchEntryLite {
  defense_rating: number;
  auto_fouls_minor: number;
  penalty_status: string;
  [column: string]: unknown;
}

/** One priced row of a phase breakdown — what the Planner's team cards print. */
export interface PredictionLine {
  key: string;
  label: string;
  /** Right-hand context, e.g. "× 20 pts" or "72%". */
  detail: string;
  points: number;
}

export interface TeamPrediction {
  teamNumber: number;
  matchCount: number;
  /** Priced contributions, grouped by phase and biggest-first. */
  breakdown: {
    auto: PredictionLine[];
    teleop: PredictionLine[];
    endgame: PredictionLine[];
  };
  predictedAuto: number;
  predictedTeleop: number;
  predictedEndgame: number;
  predictedTotal: number;
  foulsGivenToOpponent: number;
  /** Achievement rates, keyed by toggle column name, 0–100. */
  rates: Record<string, number>;
  /** Kept under these names so PitDisplay and the MCP tools keep working. */
  leaveRate: number;
  fullReturnRate: number;
  partialReturnRate: number;
  liftRate: number;
  consistency: number;
  avgDefense: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const emptyPrediction = (teamNumber: number): TeamPrediction => ({
  teamNumber,
  matchCount: 0,
  breakdown: { auto: [], teleop: [], endgame: [] },
  predictedAuto: 0, predictedTeleop: 0, predictedEndgame: 0, predictedTotal: 0,
  foulsGivenToOpponent: 0,
  rates: {},
  leaveRate: 0, fullReturnRate: 0, partialReturnRate: 0, liftRate: 0,
  consistency: 0, avgDefense: 0,
});

/**
 * Predict one team's contribution, priced with the given season's point values.
 *
 * Averages are recency-weighted (1.3^i): a robot that fixed its intake in match
 * 4 should not be judged on match 1 forever. That is the one place this differs
 * from the Dashboard, which reports plain averages of what actually happened.
 */
export function predictTeam(
  season: SeasonConfig,
  teamNumber: number,
  entries: MatchEntryLite[],
): TeamPrediction {
  if (entries.length === 0) return emptyPrediction(teamNumber);

  const weights = entries.map((_, i) => Math.pow(1.3, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wAvg = (fn: (e: MatchEntryLite) => number) =>
    entries.reduce((s, e, i) => s + fn(e) * weights[i], 0) / totalWeight;
  const rate = (fn: (e: MatchEntryLite) => boolean) =>
    entries.filter(fn).length / entries.length;

  const phases: TeamPrediction['breakdown'] = { auto: [], teleop: [], endgame: [] };
  const rates: Record<string, number> = {};

  for (const c of season.counters) {
    if ((c.role ?? 'score') !== 'score' || !c.pointsEach) continue;
    const avg = wAvg((e) => num(e[c.key]));
    phases[c.phase].push({
      key: c.key,
      label: c.label,
      detail: `${round1(avg)} × ${c.pointsEach} pts`,
      points: round1(avg * c.pointsEach),
    });
  }

  for (const t of season.toggles) {
    const r = rate((e) => !!e[t.key]);
    rates[t.key] = Math.round(r * 100);
    if ((t.role ?? 'score') !== 'score' || !t.pointsEach) continue;
    phases[t.phase].push({
      key: t.key,
      label: t.label,
      detail: `${Math.round(r * 100)}% × ${t.pointsEach} pts`,
      points: round1(r * t.pointsEach),
    });
  }

  // Endgame enums (DECODE's return status) price off the season's ENDGAME table.
  for (const e of season.enums) {
    if (e.phase !== 'endgame') continue;
    for (const option of e.options) {
      const r = rate((entry) => String(entry[e.key] ?? '') === option.value);
      rates[`${e.key}:${option.value}`] = Math.round(r * 100);
      const points = season.points.ENDGAME[option.value];
      if (!points) continue;
      phases.endgame.push({
        key: `${e.key}:${option.value}`,
        label: option.label,
        detail: `${Math.round(r * 100)}% × ${points} pts`,
        points: round1(r * points),
      });
    }
  }

  const sum = (lines: PredictionLine[]) => round1(lines.reduce((s, l) => s + l.points, 0));
  (Object.keys(phases) as (keyof typeof phases)[]).forEach((phase) => {
    phases[phase].sort((a, b) => b.points - a.points);
  });

  const predictedAuto = sum(phases.auto);
  const predictedTeleop = sum(phases.teleop);
  const predictedEndgame = sum(phases.endgame);

  const foulsGivenToOpponent = round1(
    season.counters.reduce((s, c) => {
      if (c.role !== 'foul_minor' && c.role !== 'foul_major') return s;
      return s + wAvg((e) => num(e[c.key])) * (c.pointsEach ?? 0);
    }, 0),
  );

  // Consistency and defense come from the same aggregation the Dashboard uses,
  // so the two screens never disagree about how steady a team is.
  const stats = aggregateTeam(season, teamNumber, entries as unknown as Record<string, unknown>[]);

  const defenseEnum = season.enums.find((e) => e.key.includes('defense'))?.key;

  return {
    teamNumber,
    matchCount: entries.length,
    breakdown: phases,
    predictedAuto,
    predictedTeleop,
    predictedEndgame,
    predictedTotal: round1(predictedAuto + predictedTeleop + predictedEndgame),
    foulsGivenToOpponent,
    rates,
    // Legacy aliases. `fullReturnRate` is whichever toggle/option represents
    // "made it home at the buzzer" for the season — endgame park in BIOBUZZ,
    // a full base return in DECODE.
    leaveRate: rates.auto_leave ?? rates.on_launch_line ?? 0,
    fullReturnRate: rates.teleop_park ?? rates['endgame_return:full'] ?? 0,
    partialReturnRate: rates['endgame_return:partial'] ?? 0,
    liftRate: rates['endgame_return:lift'] ?? 0,
    consistency: stats.consistency,
    avgDefense: defenseEnum ? round1(wAvg((e) => num(e[defenseEnum]))) : 0,
  };
}

/** Per-entry score, re-exported so callers need only one prediction import. */
export { scoreEntry };
