/**
 * Season-driven scoring.
 *
 * Every point value lives on the season config's fields (`pointsEach` / `role`),
 * so this module never names a game element. Change seasons and the Dashboard
 * columns, the weight sliders, and the predicted totals all follow — no edits
 * here.
 */
import type { SeasonConfig, CounterField, ToggleField } from '@/seasons/types';

export interface EntryScore {
  auto: number;
  teleop: number;
  endgame: number;
  total: number;
  /** Points this robot's fouls hand to the opposing alliance. */
  foulsGiven: number;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

const scores = (f: CounterField | ToggleField) =>
  (f.role ?? 'score') === 'score' && typeof f.pointsEach === 'number';

/** Points a single scouted entry is worth, split by phase. */
export function scoreEntry(season: SeasonConfig, entry: Record<string, unknown>): EntryScore {
  const phase = { auto: 0, teleop: 0, endgame: 0 };

  for (const c of season.counters) {
    if (!scores(c)) continue;
    phase[c.phase] += num(entry[c.key]) * (c.pointsEach as number);
  }
  for (const t of season.toggles) {
    if (!scores(t)) continue;
    if (entry[t.key]) phase[t.phase] += t.pointsEach as number;
  }
  // Endgame enums (DECODE's return status) score off the season's ENDGAME table.
  for (const e of season.enums) {
    if (e.phase !== 'endgame') continue;
    const value = String(entry[e.key] ?? '');
    const points = season.points.ENDGAME[value];
    if (typeof points === 'number') phase.endgame += points;
  }

  const foulsGiven = season.counters.reduce((sum, c) => {
    if (c.role !== 'foul_minor' && c.role !== 'foul_major') return sum;
    return sum + num(entry[c.key]) * (c.pointsEach ?? 0);
  }, 0);

  return {
    auto: round1(phase.auto),
    teleop: round1(phase.teleop),
    endgame: round1(phase.endgame),
    total: round1(phase.auto + phase.teleop + phase.endgame),
    foulsGiven: round1(foulsGiven),
  };
}

export interface TeamSeasonStats {
  teamNumber: number;
  matchesPlayed: number;
  /** Average per counter column, keyed by DB column name. */
  avg: Record<string, number>;
  /** Percentage of matches each toggle was ON, keyed by DB column name. */
  rate: Record<string, number>;
  avgAuto: number;
  avgTeleop: number;
  avgEndgame: number;
  avgTotal: number;
  avgFoulsGiven: number;
  /** % of matches ending in a card, a dead robot, or any non-'none' status. */
  penaltyRate: number;
  avgDefense: number;
  /** Standard deviation of per-match totals — the raw spread, in points. */
  varianceScore: number;
  /** 0–100, where 100 is a team that scores the same every match. */
  consistency: number;
  selectionScore: number;
}

/** The enum column that holds a 0–n defense rating, if the season has one. */
const defenseKey = (season: SeasonConfig) =>
  season.enums.find((e) => e.key.includes('defense'))?.key;

/** The enum column that flags cards / dead robots, if the season has one. */
const penaltyKey = (season: SeasonConfig) =>
  season.enums.find((e) => e.key.includes('penalty'))?.key;

export function aggregateTeam(
  season: SeasonConfig,
  teamNumber: number,
  entries: Record<string, unknown>[],
): TeamSeasonStats {
  const matchesPlayed = entries.length;
  const base: TeamSeasonStats = {
    teamNumber,
    matchesPlayed,
    avg: {},
    rate: {},
    avgAuto: 0, avgTeleop: 0, avgEndgame: 0, avgTotal: 0, avgFoulsGiven: 0,
    penaltyRate: 0, avgDefense: 0, varianceScore: 0, consistency: 0, selectionScore: 0,
  };
  if (matchesPlayed === 0) return base;

  const mean = (fn: (e: Record<string, unknown>) => number) =>
    entries.reduce((s, e) => s + fn(e), 0) / matchesPlayed;

  for (const c of season.counters) {
    base.avg[c.key] = round1(mean((e) => num(e[c.key])));
  }
  for (const t of season.toggles) {
    base.rate[t.key] = Math.round(mean((e) => (e[t.key] ? 1 : 0)) * 100);
  }
  // Endgame enum options get rates too, so DECODE's lift/full/partial still
  // have something to sort on.
  for (const e of season.enums) {
    if (e.phase !== 'endgame' || e.key === penaltyKey(season)) continue;
    for (const option of e.options) {
      base.rate[`${e.key}:${option.value}`] = Math.round(
        mean((entry) => (String(entry[e.key] ?? '') === option.value ? 1 : 0)) * 100,
      );
    }
  }

  const totals = entries.map((e) => scoreEntry(season, e));
  base.avgAuto = round1(totals.reduce((s, t) => s + t.auto, 0) / matchesPlayed);
  base.avgTeleop = round1(totals.reduce((s, t) => s + t.teleop, 0) / matchesPlayed);
  base.avgEndgame = round1(totals.reduce((s, t) => s + t.endgame, 0) / matchesPlayed);
  base.avgTotal = round1(totals.reduce((s, t) => s + t.total, 0) / matchesPlayed);
  base.avgFoulsGiven = round1(totals.reduce((s, t) => s + t.foulsGiven, 0) / matchesPlayed);

  const dKey = defenseKey(season);
  base.avgDefense = dKey ? round1(mean((e) => num(e[dKey]))) : 0;

  const pKey = penaltyKey(season);
  base.penaltyRate = pKey
    ? Math.round(mean((e) => (String(e[pKey] ?? 'none') !== 'none' ? 1 : 0)) * 100)
    : 0;

  const totalMean = base.avgTotal;
  const variance =
    totals.reduce((s, t) => s + Math.pow(t.total - totalMean, 2), 0) / matchesPlayed;
  base.varianceScore = round1(Math.sqrt(variance));
  const cv = totalMean > 0 ? base.varianceScore / totalMean : 1;
  base.consistency = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  return base;
}

/*──────────────────────────────────────────────────────────────
  Dashboard weights

  Each metric is a slider on the Dashboard. Only { id, label, weight,
  enabled } is persisted, so a season swap leaves old saved configs
  readable — unknown ids are simply ignored when scoring.
──────────────────────────────────────────────────────────────*/

export interface SeasonMetric {
  id: string;
  label: string;
  category: string;
  description: string;
  defaultWeight: number;
  defaultEnabled: boolean;
  /** Raw value pulled from a team's stats — multiplied by the slider weight. */
  value: (stats: TeamSeasonStats) => number;
}

export interface MetricCategory {
  id: string;
  label: string;
  metrics: SeasonMetric[];
}

/** Rates are 0–100; ×10 puts a full-rate metric on the same scale as counters. */
const RATE_SCALE = 10;

export function seasonMetrics(season: SeasonConfig): MetricCategory[] {
  const scoringCounters = season.counters.filter(scores);
  const fouls = season.counters.filter((c) => c.role === 'foul_minor' || c.role === 'foul_major');

  const phaseMetrics: SeasonMetric[] = [
    {
      id: 'predAuto', label: 'Auto Points', category: 'phase', defaultWeight: 5, defaultEnabled: true,
      description: 'Average auto points, priced with this season\'s point values. Weight 5, 12 pts avg → +60.',
      value: (s) => s.avgAuto,
    },
    {
      id: 'predTeleop', label: 'TeleOp Points', category: 'phase', defaultWeight: 4, defaultEnabled: true,
      description: 'Average TeleOp points from the season point values.',
      value: (s) => s.avgTeleop,
    },
    {
      id: 'predEndgame', label: 'Endgame Points', category: 'phase', defaultWeight: 3, defaultEnabled: true,
      description: 'Average endgame points from the season point values.',
      value: (s) => s.avgEndgame,
    },
    {
      id: 'predTotal', label: 'Total Points', category: 'phase', defaultWeight: 0, defaultEnabled: false,
      description: 'Average total points. Overlaps the three phase metrics — enable this instead of them, not alongside.',
      value: (s) => s.avgTotal,
    },
  ];

  const counterMetrics: SeasonMetric[] = scoringCounters.map((c) => ({
    id: `avg:${c.key}`,
    label: `Avg ${c.label}`,
    category: 'counts',
    defaultWeight: 0,
    defaultEnabled: false,
    description: `Average ${c.label.toLowerCase()} per match${c.pointsEach ? ` (worth ${c.pointsEach} pts each)` : ''}. Multiplied directly by the weight.`,
    value: (s) => s.avg[c.key] ?? 0,
  }));

  const rateMetrics: SeasonMetric[] = season.toggles
    .filter((t) => (t.role ?? 'score') === 'score')
    .map((t) => ({
      id: `rate:${t.key}`,
      label: `${t.label} %`,
      category: 'rates',
      defaultWeight: 2,
      defaultEnabled: true,
      description: `How often the robot achieves ${t.label.toLowerCase()}. Formula: (% ÷ 100) × weight × ${RATE_SCALE}. At weight 2, 80% → +16.`,
      value: (s) => ((s.rate[t.key] ?? 0) / 100) * RATE_SCALE,
    }));

  const endgameEnumMetrics: SeasonMetric[] = season.enums
    .filter((e) => e.phase === 'endgame' && e.key !== penaltyKey(season))
    .flatMap((e) =>
      e.options
        .filter((o) => (season.points.ENDGAME[o.value] ?? 0) > 0)
        .map((o): SeasonMetric => ({
          id: `rate:${e.key}:${o.value}`,
          label: `${o.label} %`,
          category: 'rates',
          defaultWeight: 2,
          defaultEnabled: true,
          description: `Share of matches ending in ${o.label}. Formula: (% ÷ 100) × weight × ${RATE_SCALE}.`,
          value: (s) => ((s.rate[`${e.key}:${o.value}`] ?? 0) / 100) * RATE_SCALE,
        })),
    );

  const otherMetrics: SeasonMetric[] = [
    {
      id: 'defense', label: 'Defense Rating', category: 'other', defaultWeight: 2, defaultEnabled: false,
      description: 'Average defense rating (0–3). Formula: rating × weight × 10. At weight 2, rating 2.5 → +50.',
      value: (s) => s.avgDefense * RATE_SCALE,
    },
    ...fouls.map((c): SeasonMetric => ({
      id: `foul:${c.key}`,
      label: `${c.label} (penalty)`,
      category: 'other',
      defaultWeight: -2,
      defaultEnabled: true,
      description: `Average ${c.label.toLowerCase()} per match, each handing ${c.pointsEach ?? 0} pts to the opponent. Negative weight → more fouls, lower rank.`,
      value: (s) => s.avg[c.key] ?? 0,
    })),
    {
      id: 'penalties', label: 'Card / Dead (penalty)', category: 'other', defaultWeight: -5, defaultEnabled: true,
      description: 'Share of matches ending in a card or a dead robot. Formula: (% ÷ 100) × weight × 10.',
      value: (s) => (s.penaltyRate / 100) * RATE_SCALE,
    },
    {
      id: 'variance', label: 'Score Spread (penalty)', category: 'other', defaultWeight: -1, defaultEnabled: true,
      description: 'Standard deviation of match totals, in points. Negative weight rewards teams that repeat themselves.',
      value: (s) => s.varianceScore,
    },
    {
      id: 'consistency', label: 'Consistency', category: 'other', defaultWeight: 0, defaultEnabled: false,
      description: '0–100 consistency score. Formula: (consistency ÷ 100) × weight × 10.',
      value: (s) => (s.consistency / 100) * RATE_SCALE,
    },
  ];

  return [
    { id: 'phase', label: `${season.name} Scoring`, metrics: phaseMetrics },
    { id: 'rates', label: 'Achievement Rates', metrics: [...rateMetrics, ...endgameEnumMetrics] },
    { id: 'counts', label: 'Per-Element Averages', metrics: counterMetrics },
    { id: 'other', label: 'Other Factors', metrics: otherMetrics },
  ].filter((c) => c.metrics.length > 0);
}

/** Flat metric lookup for scoring. */
export function metricIndex(season: SeasonConfig): Map<string, SeasonMetric> {
  return new Map(seasonMetrics(season).flatMap((c) => c.metrics).map((m) => [m.id, m]));
}

export interface WeightSetting {
  id: string;
  label: string;
  weight: number;
  enabled: boolean;
}

export function defaultWeights(season: SeasonConfig): WeightSetting[] {
  return seasonMetrics(season)
    .flatMap((c) => c.metrics)
    .map((m) => ({ id: m.id, label: m.label, weight: m.defaultWeight, enabled: m.defaultEnabled }));
}

/**
 * Weighted selection score. Weights whose id this season does not define are
 * skipped, which is what makes a saved DECODE config harmless under BIOBUZZ.
 */
export function selectionScore(
  stats: TeamSeasonStats,
  weights: WeightSetting[],
  metrics: Map<string, SeasonMetric>,
  extra: (id: string) => number | null = () => null,
): number {
  let score = 0;
  for (const w of weights) {
    if (!w.enabled) continue;
    const metric = metrics.get(w.id);
    if (metric) {
      score += metric.value(stats) * w.weight;
      continue;
    }
    const external = extra(w.id);
    if (external !== null) score += external * w.weight;
  }
  return Math.round(score * 10) / 10;
}
