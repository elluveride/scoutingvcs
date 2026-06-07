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

export interface EnumOption {
  value: string;
  label: string;
  /** Optional secondary label shown beneath the primary (e.g. defense tier description) */
  sublabel?: string;
  /** Optional hex/CSS color for badges (e.g. yellow_card) */
  color?: string;
}

export interface EnumField {
  key: string;
  label: string;
  phase: 'auto' | 'teleop' | 'endgame';
  options: EnumOption[];
}

export interface PitToggleField {
  key: string;
  label: string;
}

export interface PitConfig {
  driveOptions: EnumOption[];
  consistencyOptions: EnumOption[];
  autoLeaveOptions: EnumOption[];
  preferredStartOptions: EnumOption[];
  capabilities: PitToggleField[];
}

export interface SeasonConfig {
  id: string;
  name: string;
  seasonYear: number;
  points: ScoringPoints;
  counters: CounterField[];
  toggles: ToggleField[];
  enums: EnumField[];
  pit: PitConfig;
}

