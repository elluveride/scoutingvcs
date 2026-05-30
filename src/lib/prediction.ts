// DECODE 2025-2026 Official Point Values (Table 10-2)
export const POINTS = {
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
  auto_scored_close: number;
  auto_scored_far: number;
  teleop_scored_close: number;
  teleop_scored_far: number;
  defense_rating: number;
  endgame_return: string;
  on_launch_line: boolean;
  auto_fouls_minor: number;
  penalty_status: string;
}

export interface TeamPrediction {
  teamNumber: number;
  autoLeavePoints: number;
  autoClassifiedPoints: number;
  autoOverflowPoints: number;
  teleopClassifiedPoints: number;
  teleopOverflowPoints: number;
  endgamePoints: number;
  foulsGivenToOpponent: number;
  predictedAuto: number;
  predictedTeleop: number;
  predictedEndgame: number;
  predictedTotal: number;
  leaveRate: number;
  fullReturnRate: number;
  partialReturnRate: number;
  liftRate: number;
  consistency: number;
  matchCount: number;
  avgDefense: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function predictTeam(teamNumber: number, entries: MatchEntryLite[]): TeamPrediction {
  const empty: TeamPrediction = {
    teamNumber,
    autoLeavePoints: 0, autoClassifiedPoints: 0, autoOverflowPoints: 0,
    teleopClassifiedPoints: 0, teleopOverflowPoints: 0,
    endgamePoints: 0, foulsGivenToOpponent: 0,
    predictedAuto: 0, predictedTeleop: 0, predictedEndgame: 0, predictedTotal: 0,
    leaveRate: 0, fullReturnRate: 0, partialReturnRate: 0, liftRate: 0,
    consistency: 0, matchCount: 0, avgDefense: 0,
  };
  if (entries.length === 0) return empty;

  const weights = entries.map((_, i) => Math.pow(1.3, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wAvg = (fn: (e: MatchEntryLite) => number) =>
    entries.reduce((s, e, i) => s + fn(e) * weights[i], 0) / totalWeight;
  const rate = (fn: (e: MatchEntryLite) => boolean) =>
    entries.filter(fn).length / entries.length;

  const leaveRate = rate(e => e.on_launch_line);
  const autoLeavePoints = leaveRate * POINTS.LEAVE;
  const avgAutoClassified = wAvg(e => e.auto_scored_close);
  const avgAutoOverflow = wAvg(e => e.auto_scored_far);
  const autoClassifiedPoints = avgAutoClassified * POINTS.CLASSIFIED_AUTO;
  const autoOverflowPoints = avgAutoOverflow * POINTS.OVERFLOW_AUTO;
  const predictedAuto = autoLeavePoints + autoClassifiedPoints + autoOverflowPoints;

  const avgTeleopClassified = wAvg(e => e.teleop_scored_close);
  const avgTeleopOverflow = wAvg(e => e.teleop_scored_far);
  const teleopClassifiedPoints = avgTeleopClassified * POINTS.CLASSIFIED_TELEOP;
  const teleopOverflowPoints = avgTeleopOverflow * POINTS.OVERFLOW_TELEOP;
  const predictedTeleop = teleopClassifiedPoints + teleopOverflowPoints;

  const fullReturnRate = rate(e => e.endgame_return === 'full');
  const partialReturnRate = rate(e => e.endgame_return === 'partial');
  const liftRate = rate(e => e.endgame_return === 'lift');
  const endgamePoints =
    (fullReturnRate + liftRate) * POINTS.BASE_FULL +
    partialReturnRate * POINTS.BASE_PARTIAL;

  const avgFouls = wAvg(e => e.auto_fouls_minor);
  const foulsGivenToOpponent = avgFouls * POINTS.MINOR_FOUL;

  const predictedEndgame = endgamePoints;
  const predictedTotal = predictedAuto + predictedTeleop + predictedEndgame;

  const matchTotals = entries.map(e => {
    const a = (e.on_launch_line ? POINTS.LEAVE : 0) +
      e.auto_scored_close * POINTS.CLASSIFIED_AUTO +
      e.auto_scored_far * POINTS.OVERFLOW_AUTO;
    const t = e.teleop_scored_close * POINTS.CLASSIFIED_TELEOP +
      e.teleop_scored_far * POINTS.OVERFLOW_TELEOP;
    const eg = (e.endgame_return === 'full' || e.endgame_return === 'lift') ? POINTS.BASE_FULL :
      e.endgame_return === 'partial' ? POINTS.BASE_PARTIAL : 0;
    return a + t + eg;
  });
  const mean = matchTotals.reduce((a, b) => a + b, 0) / matchTotals.length;
  const variance = matchTotals.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / matchTotals.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const consistency = Math.max(0, Math.round((1 - cv) * 100));
  const avgDefense = wAvg(e => e.defense_rating);

  return {
    teamNumber,
    autoLeavePoints: round1(autoLeavePoints),
    autoClassifiedPoints: round1(autoClassifiedPoints),
    autoOverflowPoints: round1(autoOverflowPoints),
    teleopClassifiedPoints: round1(teleopClassifiedPoints),
    teleopOverflowPoints: round1(teleopOverflowPoints),
    endgamePoints: round1(endgamePoints),
    foulsGivenToOpponent: round1(foulsGivenToOpponent),
    predictedAuto: round1(predictedAuto),
    predictedTeleop: round1(predictedTeleop),
    predictedEndgame: round1(predictedEndgame),
    predictedTotal: round1(predictedTotal),
    leaveRate: Math.round(leaveRate * 100),
    fullReturnRate: Math.round(fullReturnRate * 100),
    partialReturnRate: Math.round(partialReturnRate * 100),
    liftRate: Math.round(liftRate * 100),
    consistency,
    matchCount: entries.length,
    avgDefense: round1(avgDefense),
  };
}
