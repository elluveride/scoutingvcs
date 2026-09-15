import type { MissingReason, TeamMissingInputs } from '@/components/shared/MissingDataBanner';
import type { SeasonConfig } from '@/seasons/types';
import { scoreEntry } from '@/lib/seasonScoring';

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

export interface ConflictRow {
  id: string;
  event_code: string;
  team_number: number;
  match_number: number;
  scouter_id: string;
  /** Season scoring columns — read through the season config, not by name. */
  [column: string]: unknown;
}

/**
 * Detect duplicate match/team rows scouted by different scouters whose totals
 * diverge by >= the threshold. Returns a Set of entry IDs flagged as conflicting.
 *
 * Totals are priced with the active season's point values, so the threshold
 * means the same thing whatever the game — two scouts one hive tip apart is a
 * 20-point disagreement, and should read as one.
 */
export function detectMatchConflicts(
  season: SeasonConfig,
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
    const scores = arr.map((r) => scoreEntry(season, r).total);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread >= threshold) arr.forEach(r => conflicts.add(r.id));
  }
  return conflicts;
}
