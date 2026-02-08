-- Add notes column to match_entries for qualitative observations
ALTER TABLE public.match_entries ADD COLUMN notes TEXT DEFAULT '' NOT NULL;