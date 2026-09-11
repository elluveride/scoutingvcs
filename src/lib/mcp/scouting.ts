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

export function predictFor(team: number, rows: MatchRow[] | undefined) {
  return predictTeam(team, rows ?? []);
}

/**
 * Alliance-level roll-up. Confidence is the match-count-weighted mean of each
 * team's consistency, scaled down when few matches have been scouted — the same
 * formula the Pit Display shows, so agents and the display agree.
 */
export function summarizeAlliance(teams: number[], byTeam: Map<number, MatchRow[]>) {
  const preds = teams.map((t) => predictFor(t, byTeam.get(t)));
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
