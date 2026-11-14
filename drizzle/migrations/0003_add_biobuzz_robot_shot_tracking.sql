ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS auto_shots_attempted integer,
  ADD COLUMN IF NOT EXISTS auto_shots_made integer,
  ADD COLUMN IF NOT EXISTS teleop_shots_attempted integer,
  ADD COLUMN IF NOT EXISTS teleop_shots_made integer;
ALTER TABLE public.match_entries_archive
  ADD COLUMN IF NOT EXISTS auto_shots_attempted integer,
  ADD COLUMN IF NOT EXISTS auto_shots_made integer,
  ADD COLUMN IF NOT EXISTS teleop_shots_attempted integer,
  ADD COLUMN IF NOT EXISTS teleop_shots_made integer;
ALTER TABLE public.match_entries ADD CONSTRAINT match_entries_valid_shots CHECK (
  (auto_shots_attempted IS NULL OR auto_shots_attempted BETWEEN 0 AND 999) AND
  (auto_shots_made IS NULL OR auto_shots_made BETWEEN 0 AND 999) AND
  (teleop_shots_attempted IS NULL OR teleop_shots_attempted BETWEEN 0 AND 999) AND
  (teleop_shots_made IS NULL OR teleop_shots_made BETWEEN 0 AND 999) AND
  (auto_shots_made IS NULL OR (auto_shots_attempted IS NOT NULL AND auto_shots_made <= auto_shots_attempted)) AND
  (teleop_shots_made IS NULL OR (teleop_shots_attempted IS NOT NULL AND teleop_shots_made <= teleop_shots_attempted))
);
COMMENT ON COLUMN public.match_entries.auto_shots_attempted IS 'BIOBUZZ robot-level shots attempted; scouting observation, not official scoring. NULL means not observed.';
COMMENT ON COLUMN public.match_entries.auto_shots_made IS 'BIOBUZZ robot-level shots made; scouting observation, not Hive Tips or official points. NULL means not observed.';
COMMENT ON COLUMN public.match_entries.teleop_shots_attempted IS 'BIOBUZZ robot-level shots attempted; scouting observation, not official scoring. NULL means not observed.';
COMMENT ON COLUMN public.match_entries.teleop_shots_made IS 'BIOBUZZ robot-level shots made; scouting observation, not Hive Tips or official points. NULL means not observed.';