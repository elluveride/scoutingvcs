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

/*──────────────────────────────────────────────────────────────
  Table columns

  The dense, read-only surfaces — Spreadsheet, match log, CSV export —
  all want the same thing: the season's scoring columns, grouped by
  phase, with headers short enough to fit. Deriving it once here keeps
  those three agreeing about what a row contains.
──────────────────────────────────────────────────────────────*/

export interface TableColumn extends FieldSpec {
  phase: 'auto' | 'teleop' | 'endgame';
  /**
   * Compact header, for a table whose own layout already says which phase the
   * column belongs to (the Spreadsheet's phase bands).
   */
  short: string;
  /**
   * Compact header that stands alone. Identical to `short` unless another phase
   * uses the same word — BIOBUZZ has "Hive" in auto and teleop, and "Park" in
   * auto and endgame — in which case it gains a phase prefix. Charts, legends
   * and flat tables want this one: two radar axes both reading "Park" is worse
   * than a longer label.
   */
  uniqueShort: string;
  /** Integer columns can be sorted on; booleans and text are not worth it. */
  sortable: boolean;
}

const PHASE_PREFIX = { auto: 'A', teleop: 'T', endgame: 'E' } as const;

/** Words that carry no information in a four-character table header. */
const FILLER = /\b(elements?|bonus(es)?|remaining|scored|tips?|status|rating)\b/gi;

/** Fallback when a season field declares no `short`. */
export function shortLabel(label: string): string {
  const stripped = label
    .replace(/^(auto|teleop|endgame)\s+/i, '')
    .replace(FILLER, '')
    .replace(/\s+/g, ' ')
    .trim();
  const source = stripped || label.replace(/^(auto|teleop|endgame)\s+/i, '').trim() || label;
  return source.split(' ')[0];
}

/**
 * Scoring columns for a season, in phase order. Fouls, defense, penalty and
 * notes are excluded — every surface renders those in its own fixed block
 * because they mean the same thing whatever the game.
 */
export function tableColumns(season: SeasonConfig): TableColumn[] {
  const columns = rawTableColumns(season);

  // Disambiguate only the labels that actually collide, so unique ones stay short.
  const seen = new Map<string, number>();
  for (const c of columns) seen.set(c.short, (seen.get(c.short) ?? 0) + 1);

  return columns.map((c) => ({
    ...c,
    uniqueShort: (seen.get(c.short) ?? 0) > 1 ? `${PHASE_PREFIX[c.phase]}. ${c.short}` : c.short,
  }));
}

function rawTableColumns(season: SeasonConfig): Omit<TableColumn, 'uniqueShort'>[] {
  const enumKeys = new Set(season.enums.map((e) => e.key));
  const phases: ('auto' | 'teleop' | 'endgame')[] = ['auto', 'teleop', 'endgame'];

  return phases.flatMap((phase) => [
    ...season.counters
      .filter((c) => c.phase === phase && (c.role ?? 'score') === 'score' && !enumKeys.has(c.key))
      .map((c): Omit<TableColumn, 'uniqueShort'> => ({
        key: c.key,
        label: c.label,
        short: c.short ?? shortLabel(c.label),
        phase,
        type: 'int',
        max: c.max ?? 999,
        sortable: true,
      })),
    ...season.toggles
      .filter((t) => t.phase === phase)
      .map((t): Omit<TableColumn, 'uniqueShort'> => ({
        key: t.key,
        label: t.label,
        short: t.short ?? shortLabel(t.label),
        phase,
        type: 'bool',
        sortable: false,
      })),
    // Endgame enums (DECODE's return status) are a real scoring column.
    ...season.enums
      .filter((e) => e.phase === phase && !e.key.includes('penalty') && !e.key.includes('defense'))
      .map((e): Omit<TableColumn, 'uniqueShort'> => ({
        key: e.key,
        label: e.label,
        short: e.label.split(' ')[0],
        phase,
        type: 'enum',
        options: e.options.map((o) => o.value),
        sortable: false,
      })),
  ]);
}

/** Columns for one phase, for a table that groups its headers. */
export function tableColumnsByPhase(season: SeasonConfig) {
  const cols = tableColumns(season);
  return {
    auto: cols.filter((c) => c.phase === 'auto'),
    teleop: cols.filter((c) => c.phase === 'teleop'),
    endgame: cols.filter((c) => c.phase === 'endgame'),
  };
}
