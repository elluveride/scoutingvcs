-- Add preferred_start column to pit_entries
ALTER TABLE public.pit_entries ADD COLUMN preferred_start text NOT NULL DEFAULT 'close' CHECK (preferred_start IN ('close', 'far'));

-- Remove park columns
ALTER TABLE public.pit_entries DROP COLUMN partial_park_capable;
ALTER TABLE public.pit_entries DROP COLUMN full_park_capable;