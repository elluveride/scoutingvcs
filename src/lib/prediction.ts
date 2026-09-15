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

export interface MatchEntryLite {
  auto_leave?: boolean;
  auto_park?: boolean;
  auto_hive_tips?: number;
  teleop_hive_tips?: number;
  teleop_cell_remaining?: number;
  teleop_flower_scored?: number;
  teleop_bottom_nectar?: number;
  teleop_garden?: number;
  teleop_park?: boolean;
  defense_rating: number;
  auto_fouls_minor: number;
  auto_fouls_major?: number;
  penalty_status: string;
  /** Legacy DECODE columns — still present on archived rows. */
  auto_scored_close?: number;
  auto_scored_far?: number;
  teleop_scored_close?: number;
  teleop_scored_far?: number;
  endgame_return?: string;
  on_launch_line?: boolean;
}

export interface TeamPrediction {
  teamNumber: number;
  // Auto breakdown
  autoLeavePoints: number;
  autoParkPoints: number;
  autoHivePoints: number;
  // TeleOp breakdown
  teleopHivePoints: number;
  teleopCellPoints: number;
  teleopFlowerPoints: number;
  teleopNectarPoints: number;
  teleopGardenPoints: number;
  // Endgame
  endgamePoints: number;
  foulsGivenToOpponent: number;
  predictedAuto: number;
  predictedTeleop: number;
  predictedEndgame: number;
  predictedTotal: number;
  // Rates (percentages)
  leaveRate: number;
  autoParkRate: number;
  /** Endgame park rate — kept under this name so existing UI keeps working. */
  fullReturnRate: number;
  partialReturnRate: number;
  liftRate: number;
  avgHiveTips: number;
  consistency: number;
  matchCount: number;
  avgDefense: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const n = (v: number | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export function predictTeam(teamNumber: number, entries: MatchEntryLite[]): TeamPrediction {
  const empty: TeamPrediction = {
    teamNumber,
    autoLeavePoints: 0, autoParkPoints: 0, autoHivePoints: 0,
    teleopHivePoints: 0, teleopCellPoints: 0, teleopFlowerPoints: 0,
    teleopNectarPoints: 0, teleopGardenPoints: 0,
    endgamePoints: 0, foulsGivenToOpponent: 0,
    predictedAuto: 0, predictedTeleop: 0, predictedEndgame: 0, predictedTotal: 0,
    leaveRate: 0, autoParkRate: 0, fullReturnRate: 0, partialReturnRate: 0, liftRate: 0,
    avgHiveTips: 0, consistency: 0, matchCount: 0, avgDefense: 0,
  };
  if (entries.length === 0) return empty;

  // Recency weighting — later entries count more.
  const weights = entries.map((_, i) => Math.pow(1.3, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wAvg = (fn: (e: MatchEntryLite) => number) =>
    entries.reduce((s, e, i) => s + fn(e) * weights[i], 0) / totalWeight;
  const rate = (fn: (e: MatchEntryLite) => boolean) =>
    entries.filter(fn).length / entries.length;

  const leaveRate = rate(e => !!e.auto_leave);
  const autoParkRate = rate(e => !!e.auto_park);
  const parkRate = rate(e => !!e.teleop_park);

  const autoLeavePoints = leaveRate * POINTS.LEAVE;
  const autoParkPoints = autoParkRate * POINTS.AUTO_PARK;
  const avgAutoTips = wAvg(e => n(e.auto_hive_tips));
  const autoHivePoints = avgAutoTips * POINTS.HIVE_TIP;
  const predictedAuto = autoLeavePoints + autoParkPoints + autoHivePoints;

  const avgTeleopTips = wAvg(e => n(e.teleop_hive_tips));
  const teleopHivePoints = avgTeleopTips * POINTS.HIVE_TIP;
  const teleopCellPoints = wAvg(e => n(e.teleop_cell_remaining)) * POINTS.CELL_REMAINING;
  const teleopFlowerPoints = wAvg(e => n(e.teleop_flower_scored)) * POINTS.FLOWER;
  const teleopNectarPoints = wAvg(e => n(e.teleop_bottom_nectar)) * POINTS.BOTTOM_NECTAR_BONUS;
  const teleopGardenPoints = wAvg(e => n(e.teleop_garden)) * POINTS.GARDEN;
  const predictedTeleop =
    teleopHivePoints + teleopCellPoints + teleopFlowerPoints + teleopNectarPoints + teleopGardenPoints;

  const endgamePoints = parkRate * POINTS.TELEOP_PARK;
  const predictedEndgame = endgamePoints;

  const foulsGivenToOpponent =
    wAvg(e => n(e.auto_fouls_minor)) * POINTS.MINOR_FOUL +
    wAvg(e => n(e.auto_fouls_major)) * POINTS.MAJOR_FOUL;

  const predictedTotal = predictedAuto + predictedTeleop + predictedEndgame;

  const matchTotals = entries.map(e => {
    const a = (e.auto_leave ? POINTS.LEAVE : 0) + (e.auto_park ? POINTS.AUTO_PARK : 0) +
      n(e.auto_hive_tips) * POINTS.HIVE_TIP;
    const t = n(e.teleop_hive_tips) * POINTS.HIVE_TIP +
      n(e.teleop_cell_remaining) * POINTS.CELL_REMAINING +
      n(e.teleop_flower_scored) * POINTS.FLOWER +
      n(e.teleop_bottom_nectar) * POINTS.BOTTOM_NECTAR_BONUS +
      n(e.teleop_garden) * POINTS.GARDEN;
    const eg = e.teleop_park ? POINTS.TELEOP_PARK : 0;
    return a + t + eg;
  });
  const mean = matchTotals.reduce((a, b) => a + b, 0) / matchTotals.length;
  const variance = matchTotals.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / matchTotals.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const consistency = Math.max(0, Math.round((1 - cv) * 100));
  const avgDefense = wAvg(e => n(e.defense_rating));

  return {
    teamNumber,
    autoLeavePoints: round1(autoLeavePoints),
    autoParkPoints: round1(autoParkPoints),
    autoHivePoints: round1(autoHivePoints),
    teleopHivePoints: round1(teleopHivePoints),
    teleopCellPoints: round1(teleopCellPoints),
    teleopFlowerPoints: round1(teleopFlowerPoints),
    teleopNectarPoints: round1(teleopNectarPoints),
    teleopGardenPoints: round1(teleopGardenPoints),
    endgamePoints: round1(endgamePoints),
    foulsGivenToOpponent: round1(foulsGivenToOpponent),
    predictedAuto: round1(predictedAuto),
    predictedTeleop: round1(predictedTeleop),
    predictedEndgame: round1(predictedEndgame),
    predictedTotal: round1(predictedTotal),
    leaveRate: Math.round(leaveRate * 100),
    autoParkRate: Math.round(autoParkRate * 100),
    fullReturnRate: Math.round(parkRate * 100),
    partialReturnRate: 0,
    liftRate: 0,
    avgHiveTips: round1(avgAutoTips + avgTeleopTips),
    consistency,
    matchCount: entries.length,
    avgDefense: round1(avgDefense),
  };
}
