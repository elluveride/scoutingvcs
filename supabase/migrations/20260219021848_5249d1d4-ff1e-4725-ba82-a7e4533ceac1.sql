
-- Add DECODE-specific columns to match_entries
ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS motif text NOT NULL DEFAULT 'PPG',
  ADD COLUMN IF NOT EXISTS auto_pattern_matches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_pattern_matches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_depot integer NOT NULL DEFAULT 0;

-- Add check constraint for motif values
ALTER TABLE public.match_entries
  ADD CONSTRAINT match_entries_motif_check CHECK (motif IN ('PPG', 'PGP', 'GPP'));

-- Add pit_entries column for depot capability
ALTER TABLE public.pit_entries
  ADD COLUMN IF NOT EXISTS scores_depot boolean NOT NULL DEFAULT false;
