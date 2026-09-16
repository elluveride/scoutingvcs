/**
 * Field specs — the flat, transport-shaped view of a season config.
 *
 * `SeasonConfig` is organised for the scout UI (counters / toggles / enums,
 * grouped by phase). Everything that moves data rather than renders it — the QR
 * payload, offline queue, imports — wants one flat list of "this column, this
 * type" instead. These helpers derive that list, so a new season needs no
 * changes anywhere downstream.
 */
import type { SeasonConfig } from './types';

export type FieldType = 'int' | 'bool' | 'enum' | 'text';

export interface FieldSpec {
  /** DB column name — also the key used in QR payloads. */
  key: string;
  label: string;
  type: FieldType;
  /** Allowed values for `enum` fields. */
  options?: string[];
  /** Upper bound used when validating imported values. */
  max?: number;
}

const INT_MAX = 999;

/** Columns every match entry carries, whatever the season. */
const MATCH_IDENTITY: FieldSpec[] = [
  { key: 'team_number', label: 'Team', type: 'int', max: 99999 },
  { key: 'match_number', label: 'Match', type: 'int', max: 999 },
];

/** Columns every pit entry carries, whatever the season. */
const PIT_IDENTITY: FieldSpec[] = [
  { key: 'team_number', label: 'Team', type: 'int', max: 99999 },
  { key: 'team_name', label: 'Team Name', type: 'text' },
];

/**
 * Every match-entry column the active season writes, in a stable order.
 * Order matters: it is the order QR payloads and their field headers use.
 */
export function matchFields(season: SeasonConfig): FieldSpec[] {
  const counters: FieldSpec[] = season.counters.map((c) => ({
    key: c.key,
    label: c.label,
    type: 'int',
    max: c.max ?? INT_MAX,
  }));

  const toggles: FieldSpec[] = season.toggles.map((t) => ({
    key: t.key,
    label: t.label,
    type: 'bool',
  }));

  const enums: FieldSpec[] = season.enums.map((e) => ({
    key: e.key,
    // `defense_rating` is stored as an integer column but picked from a list.
    type: e.options.every((o) => /^\d+$/.test(o.value)) ? 'int' : 'enum',
    label: e.label,
    options: e.options.map((o) => o.value),
    max: INT_MAX,
  }));

  // An enum and a counter can name the same column (defense_rating is both a
  // 0–3 picker and an integer column); the enum wins, so the scout gets the
  // picker rather than a stepper.
  const enumKeys = new Set(enums.map((f) => f.key));

  return [
    ...MATCH_IDENTITY,
    ...counters.filter((c) => !enumKeys.has(c.key)),
    ...toggles,
    ...enums,
    { key: 'notes', label: 'Notes', type: 'text' },
  ];
}

/** Every pit-entry column the active season writes, in a stable order. */
export function pitFields(season: SeasonConfig): FieldSpec[] {
  return [
    ...PIT_IDENTITY,
    { key: 'drive_type', label: 'Drive Type', type: 'enum', options: season.pit.driveOptions.map((o) => o.value) },
    { key: 'auto_consistency', label: 'Auto Consistency', type: 'enum', options: season.pit.consistencyOptions.map((o) => o.value) },
    { key: 'reliable_auto_leave', label: 'Reliable Auto Leave', type: 'enum', options: season.pit.autoLeaveOptions.map((o) => o.value) },
    { key: 'preferred_start', label: 'Preferred Start', type: 'enum', options: season.pit.preferredStartOptions.map((o) => o.value) },
    { key: 'endgame_consistency', label: 'Endgame Consistency', type: 'enum', options: season.pit.consistencyOptions.map((o) => o.value) },
    ...season.pit.capabilities.map((c): FieldSpec => ({ key: c.key, label: c.label, type: 'bool' })),
  ];
}

/** Counters that actually earn points, split by phase — used by the scout form. */
export function countersForPhase(season: SeasonConfig, phase: 'auto' | 'teleop' | 'endgame') {
  const enumKeys = new Set(season.enums.map((e) => e.key));
  return season.counters.filter(
    (c) => c.phase === phase && c.role !== 'foul_minor' && c.role !== 'foul_major' && !enumKeys.has(c.key),
  );
}

export function togglesForPhase(season: SeasonConfig, phase: 'auto' | 'teleop' | 'endgame') {
  return season.toggles.filter((t) => t.phase === phase);
}

export function enumsForPhase(season: SeasonConfig, phase: 'auto' | 'teleop' | 'endgame') {
  return season.enums.filter((e) => e.phase === phase);
}

/** Foul counters, which the scout form groups into its own section. */
export function foulCounters(season: SeasonConfig) {
  return season.counters.filter((c) => c.role === 'foul_minor' || c.role === 'foul_major');
}

/** Default value for a field, used to seed empty forms and fill absent imports. */
export function defaultFor(field: FieldSpec): number | boolean | string {
  switch (field.type) {
    case 'int': return 0;
    case 'bool': return false;
    case 'enum': return field.options?.[0] ?? '';
    case 'text': return '';
  }
}

/** An empty entry for the given field list. */
export function emptyRecord(fields: FieldSpec[]): Record<string, number | boolean | string> {
  return Object.fromEntries(fields.map((f) => [f.key, defaultFor(f)]));
}
