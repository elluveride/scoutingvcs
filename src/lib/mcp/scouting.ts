/**
 * Shared helpers for the MCP scouting tools.
 *
 * Every tool talks to Supabase through `supabaseForUser`, so RLS already scopes
 * rows to the signed-in scout's team (plus the 12841/2844 alliance, or
 * everything for admins). These helpers only handle shaping: deduplication,
 * grouping, and trimming rows down to something an LLM can read cheaply.
 */

import type { JsonValueInput } from '@lovable.dev/mcp-js';
import type { MatchEntryLite } from '@/lib/prediction';
import { predictTeam, type TeamPrediction } from '@/lib/prediction';
import { seasonById, DEFAULT_SEASON_ID } from '@/seasons';
import type { SeasonConfig } from '@/seasons/types';
import { aggregateTeam, scoreEntry } from '@/lib/seasonScoring';

export type MatchRow = MatchEntryLite & {
  id: string;
  event_code: string;
  team_number: number;
  match_number: number;
  scouter_id: string;
  notes: string | null;
  created_at: string;
};

/** Event codes are used in URLs and queries; keep them boring. */
export const EVENT_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function assertEventCode(code: string): string {
  const trimmed = code.trim();
  if (!EVENT_CODE_RE.test(trimmed)) {
    throw new Error(`Invalid event code: ${code}. Use the short FTC code, e.g. USAZCMP.`);
  }
  return trimmed;
}

/**
 * Multiple scouts can cover the same robot in the same match. The dashboard
 * keeps only the newest entry per (team, match); tools must agree with it or
 * an agent's numbers won't match what the team sees on screen.
 */
export function latestPerMatch(rows: MatchRow[]): MatchRow[] {
  const byKey = new Map<string, MatchRow>();
  for (const r of rows) {
    const key = `${r.team_number}:${r.match_number}`;
    const prev = byKey.get(key);
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) byKey.set(key, r);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.team_number - b.team_number || a.match_number - b.match_number,
  );
}

export function groupByTeam(rows: MatchRow[]): Map<number, MatchRow[]> {
  const m = new Map<number, MatchRow[]>();
  for (const r of rows) {
    const arr = m.get(r.team_number) ?? [];
    arr.push(r);
    m.set(r.team_number, arr);
  }
  return m;
}

/** Snake-case, LLM-friendly view of a prediction. */
export function compactPrediction(p: TeamPrediction) {
  return {
    team_number: p.teamNumber,
    matches_scouted: p.matchCount,
    predicted_total: p.predictedTotal,
    predicted_auto: p.predictedAuto,
    predicted_teleop: p.predictedTeleop,
    predicted_endgame: p.predictedEndgame,
    consistency_pct: p.consistency,
    leave_rate_pct: p.leaveRate,
    full_return_rate_pct: p.fullReturnRate,
    partial_return_rate_pct: p.partialReturnRate,
    lift_rate_pct: p.liftRate,
    avg_defense: p.avgDefense,
    fouls_points_given: p.foulsGivenToOpponent,
  };
}

export function predictFor(team: number, rows: MatchRow[] | undefined, seasonId?: string) {
  return predictTeam(seasonById(seasonId), team, rows ?? []);
}

/**
 * Minimal structural view of the Supabase client.
 *
 * Deliberately loose: PostgREST builders are thenables rather than real
 * Promises, and typing the full generic client here drags the whole Database
 * type into every tool for one column read.
 */
interface EventSeasonReader {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null }>;
      };
    };
  };
}

/**
 * The season an event is scouted under.
 *
 * An agent must price a match the same way the team's own screens do, and that
 * is a property of the event row, not of this process. Falls back to the default
 * season when the column is absent (pre-migration) or the event is unknown,
 * because a wrong-but-current answer beats a crash.
 */
export async function seasonForEvent(
  // `unknown` rather than the typed client: the generated Database type makes
  // this call chain too deep for TypeScript to instantiate, and every caller
  // would otherwise need the same cast. Narrowed to the shape used, below.
  supabase: unknown,
  eventCode: string,
): Promise<SeasonConfig> {
  try {
    const client = supabase as EventSeasonReader;
    const { data } = await client
      .from('events')
      .select('season_id')
      .eq('code', eventCode)
      .maybeSingle();
    const id = typeof data?.season_id === 'string' ? data.season_id : DEFAULT_SEASON_ID;
    return seasonById(id);
  } catch {
    return seasonById(DEFAULT_SEASON_ID);
  }
}

/**
 * Per-team averages in the season's own terms: points by phase, plus the raw
 * per-element counts under their real names. Replaces the old fixed
 * `auto_scored` / `teleop_scored` pair, which counted DECODE columns and so
 * reported zero for every BIOBUZZ team.
 */
export function compactTeamStats(season: SeasonConfig, team: number, rows: MatchRow[]) {
  const stats = aggregateTeam(season, team, rows as unknown as Record<string, unknown>[]);
  return {
    team_number: team,
    season: season.id,
    matches_scouted: stats.matchesPlayed,
    avg_total_points: stats.avgTotal,
    avg_auto_points: stats.avgAuto,
    avg_teleop_points: stats.avgTeleop,
    avg_endgame_points: stats.avgEndgame,
    avg_defense: stats.avgDefense,
    consistency_pct: stats.consistency,
    failure_rate_pct: stats.penaltyRate,
    avg_fouls_points_given: stats.avgFoulsGiven,
    /** Averages per scoring element, keyed by the season's own column names. */
    avg_by_element: Object.fromEntries(
      season.counters
        .filter((c) => (c.role ?? 'score') === 'score')
        .map((c) => [c.key, stats.avg[c.key] ?? 0]),
    ),
    /** How often each achievement toggle was hit, as a percentage. */
    rate_pct_by_achievement: Object.fromEntries(
      season.toggles.map((t) => [t.key, stats.rate[t.key] ?? 0]),
    ),
  };
}

/** One match, priced — so an agent can cite a specific match, not just an average. */
export function compactMatch(season: SeasonConfig, row: MatchRow) {
  const score = scoreEntry(season, row as unknown as Record<string, unknown>);
  return {
    match_number: row.match_number,
    total_points: score.total,
    auto_points: score.auto,
    teleop_points: score.teleop,
    endgame_points: score.endgame,
    fouls_points_given: score.foulsGiven,
    notes: row.notes ?? '',
  };
}

/**
 * Alliance-level roll-up. Confidence is the match-count-weighted mean of each
 * team's consistency, scaled down when few matches have been scouted — the same
 * formula the Pit Display shows, so agents and the display agree.
 */
export function summarizeAlliance(
  teams: number[],
  byTeam: Map<number, MatchRow[]>,
  seasonId?: string,
) {
  const preds = teams.map((t) => predictFor(t, byTeam.get(t), seasonId));
  const total = preds.reduce((s, p) => s + p.predictedTotal, 0);
  const matches = preds.reduce((s, p) => s + p.matchCount, 0);
  const weighted = matches
    ? preds.reduce((s, p) => s + p.consistency * p.matchCount, 0) / matches
    : 0;
  const coverage = preds.length ? Math.min(1, matches / (preds.length * 4)) : 0;
  return {
    teams,
    predicted_total: round1(total),
    predicted_auto: round1(preds.reduce((s, p) => s + p.predictedAuto, 0)),
    predicted_teleop: round1(preds.reduce((s, p) => s + p.predictedTeleop, 0)),
    predicted_endgame: round1(preds.reduce((s, p) => s + p.predictedEndgame, 0)),
    confidence_pct: Math.round(weighted * coverage),
    teams_with_data: preds.filter((p) => p.matchCount > 0).length,
    breakdown: preds.map(compactPrediction),
  };
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Standard MCP tool result carrying both the text and the structured form.
 *
 * `structuredContent` must be a JSON object. Rows read from Supabase are typed
 * as interfaces, which TypeScript will not widen to an index-signature type even
 * though they serialize fine, so the shape is asserted here once rather than at
 * every call site. `JSON.stringify` on the line above proves serializability at
 * runtime.
 */
export function toolResult(payload: unknown) {
  const structured = (
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { result: payload }
  ) as JsonValueInput;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: structured,
  };
}

export function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
