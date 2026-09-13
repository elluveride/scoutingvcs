-- BIOBUZZ (2026-2027) scouting fields. Additive: DECODE columns stay in place
-- so existing/archived entries remain readable.

ALTER TABLE public.match_entries
  ADD COLUMN IF NOT EXISTS auto_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_park boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_hive_tips integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_hive_tips integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_cell_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_flower_scored integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_bottom_nectar integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_garden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_park boolean NOT NULL DEFAULT false;

ALTER TABLE public.match_entries_archive
  ADD COLUMN IF NOT EXISTS auto_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_park boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_hive_tips integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_hive_tips integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_cell_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_flower_scored integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_bottom_nectar integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_garden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teleop_park boolean NOT NULL DEFAULT false;

ALTER TABLE public.pit_entries
  ADD COLUMN IF NOT EXISTS can_tip_hive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scores_pollen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scores_nectar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scores_flower boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scores_garden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS match_entries_event_team_idx
  ON public.match_entries (event_code, team_number);