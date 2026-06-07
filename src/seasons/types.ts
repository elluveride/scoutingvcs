/**
 * Season configuration contract. Every season (DECODE 2025-26, the 2026-27 game,
 * etc.) implements this so MatchScout / PitScout / prediction / spreadsheet can
 * be driven by a single config object rather than hard-coded field names.
 *
 * Swap the active season by changing `CURRENT_SEASON` in ./index.ts.
 */

export interface ScoringPoints {
  /** Points for leaving the starting zone in auto */
  LEAVE: number;
  /** Points per classified auto score */
  CLASSIFIED_AUTO: number;
  /** Points per classified teleop score */
  CLASSIFIED_TELEOP: number;
  /** Points per overflow auto score */
  OVERFLOW_AUTO: number;
  /** Points per overflow teleop score */
  OVERFLOW_TELEOP: number;
  /** Misc per-action bonuses (depot, pattern match, etc.) */
  EXTRAS: Record<string, number>;
  /** Endgame tiers — keys map to season-specific labels */
  ENDGAME: Record<string, number>;
  /** Penalty point values */
  MINOR_FOUL: number;
  MAJOR_FOUL: number;
}

export interface CounterField {
  /** Stable DB column name */
  key: string;
  /** Label shown in scout UI */
  label: string;
  /** Phase: which scouting section the field belongs to */
  phase: 'auto' | 'teleop' | 'endgame';
  /** Min/max stepper bounds */
  min?: number;
  max?: number;
  /** Optional short helper text */
  hint?: string;
}

export interface ToggleField {
  key: string;
  label: string;
  phase: 'auto' | 'teleop' | 'endgame';
  /** When true, turning the toggle ON is considered destructive (e.g. Launch Line penalty) */
  destructive?: boolean;
  hint?: string;
}

export interface EnumField {
  key: string;
  label: string;
  phase: 'auto' | 'teleop' | 'endgame';
  options: { value: string; label: string }[];
}

export interface SeasonConfig {
  /** Internal id, e.g. "decode" */
  id: string;
  /** Display name, e.g. "DECODE (2025-26)" */
  name: string;
  /** FTC season year, e.g. 2025 */
  seasonYear: number;
  /** Point values for prediction math */
  points: ScoringPoints;
  /** All counter inputs the match scout records */
  counters: CounterField[];
  /** All boolean toggles the match scout records */
  toggles: ToggleField[];
  /** All enum / select inputs the match scout records */
  enums: EnumField[];
}
