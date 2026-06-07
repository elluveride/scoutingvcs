import type { MissingReason, TeamMissingInputs } from '@/components/shared/MissingDataBanner';

export interface MissingInputsArgs {
  teamNumbers: number[];
  matchCountByTeam: Record<number, number>;
  pitScoutedTeams: Set<number>;
  /** Optional: teams that lack official OPR data */
  noOprTeams?: Set<number>;
  /** Threshold for low-sample warning (default 3) */
  lowSampleThreshold?: number;
}

/**
 * Canonical "is this team missing required inputs?" check.
 * Used across PitDisplay, MatchPlanner, Dashboard, TeamDetail so all prediction
 * surfaces report the same reasons in the same order.
 */
export function evaluateMissingInputs(args: MissingInputsArgs): TeamMissingInputs[] {
  const threshold = args.lowSampleThreshold ?? 3;
  const out: TeamMissingInputs[] = [];

  for (const teamNumber of args.teamNumbers) {
    const count = args.matchCountByTeam[teamNumber] ?? 0;
    const reasons: MissingReason[] = [];

    if (count === 0) reasons.push('no_match_data');
    else if (count < threshold) reasons.push('low_sample');

    if (!args.pitScoutedTeams.has(teamNumber)) reasons.push('no_pit_data');
    if (args.noOprTeams?.has(teamNumber)) reasons.push('no_opr');

    if (reasons.length > 0) {
      out.push({
        teamNumber,
        reasons,
        detail: count > 0 && count < threshold ? `${count} match${count === 1 ? '' : 'es'}` : undefined,
      });
    }
  }

  return out;
}

interface ConflictRow {
  id: string;
  event_code: string;
  team_number: number;
  match_number: number;
  scouter_id: string;
  auto_scored_close: number;
  auto_scored_far: number;
  teleop_scored_close: number;
  teleop_scored_far: number;
  on_launch_line: boolean;
  endgame_return: string;
  auto_fouls_minor: number;
}

const rowScore = (e: ConflictRow): number => {
  const auto = (e.on_launch_line ? 3 : 0) + (e.auto_scored_close + e.auto_scored_far) * 3;
  const tele = (e.teleop_scored_close + e.teleop_scored_far) * 3;
  const eg = e.endgame_return === 'full' || e.endgame_return === 'lift' ? 10
    : e.endgame_return === 'partial' ? 5 : 0;
  return auto + tele + eg;
};

/**
 * Detect duplicate match/team rows scouted by different scouters whose totals
 * diverge by >= the threshold. Returns a Set of entry IDs flagged as conflicting.
 */
export function detectMatchConflicts(
  rows: ConflictRow[],
  threshold = 4,
): Set<string> {
  const groups = new Map<string, ConflictRow[]>();
  for (const r of rows) {
    const key = `${r.event_code}|${r.match_number}|${r.team_number}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const conflicts = new Set<string>();
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const scouters = new Set(arr.map(r => r.scouter_id));
    if (scouters.size < 2) continue;
    const scores = arr.map(rowScore);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread >= threshold) arr.forEach(r => conflicts.add(r.id));
  }
  return conflicts;
}
