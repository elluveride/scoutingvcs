import { z } from 'zod';

// Schema for validating imported match entries
export const MatchEntryImportSchema = z.object({
  team_number: z.number().int().positive().max(99999),
  match_number: z.number().int().positive().max(999),
  auto_scored_close: z.number().int().min(0).max(100).default(0),
  auto_scored_far: z.number().int().min(0).max(100).default(0),
  auto_fouls_minor: z.number().int().min(0).max(50).default(0),
  auto_fouls_major: z.number().int().min(0).max(50).default(0),
  on_launch_line: z.boolean().default(false),
  teleop_scored_close: z.number().int().min(0).max(200).default(0),
  teleop_scored_far: z.number().int().min(0).max(200).default(0),
  defense_rating: z.number().int().min(0).max(5).default(0),
  endgame_return: z.enum(['not_returned', 'partial', 'full', 'lift']).default('not_returned'),
  penalty_status: z.enum(['none', 'dead', 'yellow_card', 'red_card']).default('none'),
});

export const ImportFileSchema = z.object({
  format_version: z.string().optional(),
  event_code: z.string().optional(),
  event_name: z.string().optional(),
  exported_at: z.string().optional(),
  entries: z.array(MatchEntryImportSchema),
});

// Schema for compact QR entries
export const CompactEntrySchema = z.object({
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
});

export const QRPayloadSchema = z.object({
  d: z.array(CompactEntrySchema),
});

export type ValidatedMatchEntry = z.infer<typeof MatchEntryImportSchema>;
export type ValidatedCompactEntry = z.infer<typeof CompactEntrySchema>;
