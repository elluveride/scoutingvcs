ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS season_id text NOT NULL DEFAULT 'biobuzz';

COMMENT ON COLUMN public.events.season_id IS
  'Active season config id (see src/seasons/index.ts). Drives scout fields and scoring.';