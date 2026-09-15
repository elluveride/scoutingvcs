/**
 * QR transport for scouting entries.
 *
 * A phone in the stands has no network. It has a screen and a camera, so the
 * screen is the wire: the scout's device renders its entries as QR codes and
 * the lead's device reads them back.
 *
 * The payload is *self-describing*. Rather than hard-coding a short key per
 * column (which meant editing this file every season), each payload carries the
 * field list it was built from and the rows as positional arrays:
 *
 *   { v: 2, s: 'biobuzz', k: 'm', e: 'USAZCMP', f: ['team_number', ...], d: [[1234, ...]] }
 *
 * The header costs a couple of hundred bytes once per code and buys two things:
 * a new season needs no change here, and the receiver can tell a BIOBUZZ code
 * from a DECODE one instead of silently importing nonsense.
 *
 * v1 payloads (`{ d: [{ t, m, ac, af, ... }] }`, DECODE's fixed short keys) still
 * decode, so codes printed last season keep working.
 */
import { z } from 'zod';
import type { SeasonConfig } from '@/seasons/types';
import { matchFields, pitFields, type FieldSpec } from '@/seasons/fields';

export const QR_FORMAT_VERSION = 2;

export type EntryKind = 'match' | 'pit';

/** Wire-level kind marker — one character, because every byte is a QR module. */
const KIND_CODE: Record<EntryKind, string> = { match: 'm', pit: 'p' };
const KIND_FROM_CODE: Record<string, EntryKind> = { m: 'match', p: 'pit' };

export type CellValue = number | string | null;

export interface QRPayload {
  /** Format version. */
  v: number;
  /** Season id the entries were scouted under. */
  s: string;
  /** Entry kind code. */
  k: string;
  /** Event code. */
  e: string;
  /** Column names, in payload order. */
  f: string[];
  /** Rows, positional against `f`. */
  d: CellValue[][];
}

export const QRPayloadV2Schema = z.object({
  v: z.literal(2),
  s: z.string().min(1).max(32),
  k: z.enum(['m', 'p']),
  e: z.string().max(32).default(''),
  f: z.array(z.string().min(1).max(64)).min(1).max(64),
  d: z.array(z.array(z.union([z.number(), z.string(), z.null()])).max(64)).max(200),
});

/** Legacy DECODE payload: fixed short keys, match entries only. */
export const QRPayloadV1Schema = z.object({
  d: z.array(
    z.object({
      t: z.number().int().positive().max(99999),
      m: z.number().int().positive().max(999),
      ac: z.number().int().min(0).max(100).default(0),
      af: z.number().int().min(0).max(100).default(0),
      tc: z.number().int().min(0).max(200).default(0),
      tf: z.number().int().min(0).max(200).default(0),
      ll: z.boolean().default(false),
      dr: z.number().int().min(0).max(5).default(0),
      er: z.string().default('not_returned'),
      ps: z.string().default('none'),
      f: z.number().int().min(0).max(50).default(0),
    }),
  ).max(200),
});

const V1_TO_COLUMN: Record<string, string> = {
  t: 'team_number',
  m: 'match_number',
  ac: 'auto_scored_close',
  af: 'auto_scored_far',
  tc: 'teleop_scored_close',
  tf: 'teleop_scored_far',
  ll: 'on_launch_line',
  dr: 'defense_rating',
  er: 'endgame_return',
  ps: 'penalty_status',
  f: 'auto_fouls_minor',
};

export function fieldsFor(season: SeasonConfig, kind: EntryKind): FieldSpec[] {
  return kind === 'match' ? matchFields(season) : pitFields(season);
}

/** Booleans ride the wire as 0/1 — a third of the bytes of `true`/`false`. */
function toCell(value: unknown, field: FieldSpec): CellValue {
  switch (field.type) {
    case 'bool':
      return value ? 1 : 0;
    case 'int': {
      const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
      return Number.isFinite(n) ? n : 0;
    }
    default:
      return value == null ? '' : String(value);
  }
}

function fromCell(cell: CellValue, field: FieldSpec): number | boolean | string {
  switch (field.type) {
    case 'bool':
      return cell === 1 || cell === '1' || cell === 'true';
    case 'int': {
      const n = typeof cell === 'number' ? cell : parseInt(String(cell ?? ''), 10);
      if (!Number.isFinite(n)) return 0;
      const clamped = Math.max(0, Math.min(field.max ?? 999, Math.round(n)));
      return clamped;
    }
    case 'enum': {
      const s = String(cell ?? '');
      return field.options?.includes(s) ? s : (field.options?.[0] ?? '');
    }
    case 'text':
      return String(cell ?? '').slice(0, 500);
  }
}

/** Build a payload from DB-shaped rows (keys are column names). */
export function encodePayload(
  season: SeasonConfig,
  kind: EntryKind,
  eventCode: string,
  rows: Record<string, unknown>[],
): QRPayload {
  const fields = fieldsFor(season, kind);
  return {
    v: QR_FORMAT_VERSION,
    s: season.id,
    k: KIND_CODE[kind],
    e: eventCode,
    f: fields.map((f) => f.key),
    d: rows.map((row) => fields.map((f) => toCell(row[f.key], f))),
  };
}

export interface DecodedPayload {
  kind: EntryKind;
  seasonId: string;
  eventCode: string;
  formatVersion: number;
  /** Rows keyed by DB column name, values coerced to the season's field types. */
  rows: Record<string, number | boolean | string>[];
}

/**
 * Decode one scanned code against the active season.
 *
 * Returns null for anything that is not a scouting payload — a scanner sees
 * plenty of other QR codes, and a stray URL should not raise an error toast.
 * A payload from a *different* season still decodes; the caller compares
 * `seasonId` and decides, because refusing silently is worse than saying why.
 */
export function decodePayload(text: string, season: SeasonConfig): DecodedPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const v2 = QRPayloadV2Schema.safeParse(parsed);
  if (v2.success) {
    const kind = KIND_FROM_CODE[v2.data.k];
    const specs = new Map(fieldsFor(season, kind).map((f) => [f.key, f]));
    const rows = v2.data.d.map((cells) => {
      const row: Record<string, number | boolean | string> = {};
      v2.data.f.forEach((key, i) => {
        const spec = specs.get(key);
        // Columns this season does not know about are dropped rather than
        // written blindly — the DB would reject them anyway.
        if (spec) row[key] = fromCell(cells[i] ?? null, spec);
      });
      return row;
    });
    return {
      kind,
      seasonId: v2.data.s,
      eventCode: v2.data.e,
      formatVersion: 2,
      rows,
    };
  }

  const v1 = QRPayloadV1Schema.safeParse(parsed);
  if (v1.success) {
    return {
      kind: 'match',
      seasonId: 'decode',
      eventCode: '',
      formatVersion: 1,
      rows: v1.data.d.map((entry) =>
        Object.fromEntries(
          Object.entries(entry).map(([k, value]) => [V1_TO_COLUMN[k] ?? k, value as number | boolean | string]),
        ),
      ),
    };
  }

  return null;
}

/**
 * Split rows across as many payloads as it takes to stay under `maxBytes`.
 *
 * Every chunk repeats the header so each QR code stands alone — a scout can
 * hand over codes out of order, or re-show just the one that failed to scan.
 */
export function chunkPayload(
  season: SeasonConfig,
  kind: EntryKind,
  eventCode: string,
  rows: Record<string, unknown>[],
  maxBytes = 1800,
): string[] {
  if (rows.length === 0) return [];

  const chunks: string[] = [];
  let current: Record<string, unknown>[] = [];

  const serialize = (batch: Record<string, unknown>[]) =>
    JSON.stringify(encodePayload(season, kind, eventCode, batch));

  for (const row of rows) {
    const candidate = [...current, row];
    if (current.length > 0 && serialize(candidate).length > maxBytes) {
      chunks.push(serialize(current));
      current = [row];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) chunks.push(serialize(current));
  return chunks;
}

/** Stable duplicate key for an entry of either kind. */
export function entryKey(kind: EntryKind, row: Record<string, unknown>): string {
  return kind === 'match'
    ? `${row.team_number}-${row.match_number}`
    : `${row.team_number}`;
}
