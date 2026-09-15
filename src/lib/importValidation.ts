/**
 * File import/export validation.
 *
 * Schemas are built from the active season's field list rather than written
 * out by hand, so the columns a file may carry are always exactly the columns
 * the scout app collects. The QR path has its own, denser format — see
 * `src/lib/qrPayload.ts`.
 */
import { z } from 'zod';
import type { SeasonConfig } from '@/seasons/types';
import { matchFields, pitFields, type FieldSpec } from '@/seasons/fields';

export const IMPORT_FORMAT_VERSION = '2.0';

/** A zod shape for one field, defaulted so a partial file still imports. */
function schemaForField(field: FieldSpec): z.ZodTypeAny {
  switch (field.type) {
    case 'int':
      return z.coerce.number().int().min(0).max(field.max ?? 999).catch(0).default(0);
    case 'bool':
      return z.coerce.boolean().catch(false).default(false);
    case 'enum':
      return z.string().catch('').default('').transform((v) =>
        field.options?.includes(v) ? v : (field.options?.[0] ?? ''),
      );
    case 'text':
      return z.string().max(500).catch('').default('');
  }
}

/**
 * Entry schema for a season. `team_number` and `match_number` stay required —
 * a row without them cannot be filed against anything.
 */
export function entrySchema(season: SeasonConfig, kind: 'match' | 'pit') {
  const fields = kind === 'match' ? matchFields(season) : pitFields(season);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.key === 'team_number') {
      shape[field.key] = z.coerce.number().int().positive().max(99999);
    } else if (field.key === 'match_number') {
      shape[field.key] = z.coerce.number().int().positive().max(999);
    } else {
      shape[field.key] = schemaForField(field);
    }
  }

  // Unknown columns are stripped rather than rejected, so a file exported under
  // a different season still imports whatever it has in common with this one.
  return z.object(shape).strip();
}

export function importFileSchema(season: SeasonConfig, kind: 'match' | 'pit' = 'match') {
  return z.object({
    format_version: z.string().optional(),
    /** Season the file was exported from; mismatches are reported, not silently merged. */
    season_id: z.string().optional(),
    event_code: z.string().optional(),
    event_name: z.string().optional(),
    exported_at: z.string().optional(),
    entries: z.array(entrySchema(season, kind)),
  });
}

/** Column order for CSV export/import, matching the scout form's order. */
export function exportColumns(season: SeasonConfig, kind: 'match' | 'pit' = 'match'): string[] {
  const fields = kind === 'match' ? matchFields(season) : pitFields(season);
  return fields.map((f) => f.key);
}

export type ValidatedEntry = Record<string, number | boolean | string>;
