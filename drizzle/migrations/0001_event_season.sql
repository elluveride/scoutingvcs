-- Per-event season selection.
--
-- Scouts on one event must all be collecting the same game's fields, otherwise
-- a QR handoff imports columns the receiver never scouted. Storing the season on
-- the event (rather than per device) makes that agreement the event's property.
--
-- Existing rows default to 'biobuzz', the current season; DECODE events can be
-- switched back from the season setup screen.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS season_id text NOT NULL DEFAULT 'biobuzz';

COMMENT ON COLUMN public.events.season_id IS
  'Active season config id (see src/seasons/index.ts). Drives scout fields and scoring.';
