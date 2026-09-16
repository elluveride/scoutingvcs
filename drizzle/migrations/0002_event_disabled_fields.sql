ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS disabled_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.disabled_fields IS
  'Season scoring field keys switched off for this event (Season Setup). Disabled fields are removed from scout forms, scoring, and QR payloads.';