-- ─────────────────────────────────────────────────────────────────────────────
-- Weekly match cleanup
--
-- Every Wednesday at 09:00 UTC, move the previous calendar week's match entries
-- (Monday 00:00 → Sunday 24:00 UTC of the week *before* the run) out of
-- `match_entries` into `match_entries_archive`. Nothing is hard-deleted: the
-- archive keeps every column, so an admin can restore rows with a single
-- INSERT ... SELECT if a cleanup ever needs to be undone.
--
-- Rationale: FTC events run on weekends. By Wednesday the previous weekend's
-- data is stale for the dashboard / pit display, which are per-event and only
-- need the current event's rows. Archiving keeps those queries small.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Archive table mirrors match_entries (same columns, same order) plus audit fields.
CREATE TABLE IF NOT EXISTS public.match_entries_archive (
  LIKE public.match_entries INCLUDING DEFAULTS,
  archived_at   timestamptz NOT NULL DEFAULT now(),
  archive_reason text        NOT NULL DEFAULT 'weekly_cleanup'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.match_entries_archive'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.match_entries_archive ADD PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_match_entries_archive_event
  ON public.match_entries_archive (event_code, team_number, match_number);
CREATE INDEX IF NOT EXISTS idx_match_entries_archive_archived_at
  ON public.match_entries_archive (archived_at);

ALTER TABLE public.match_entries_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view archived match entries" ON public.match_entries_archive;
CREATE POLICY "Admins can view archived match entries"
  ON public.match_entries_archive FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete archived match entries" ON public.match_entries_archive;
CREATE POLICY "Admins can delete archived match entries"
  ON public.match_entries_archive FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 2. Audit log so admins can see what each scheduled run did.
CREATE TABLE IF NOT EXISTS public.maintenance_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job           text        NOT NULL,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  window_start  timestamptz,
  window_end    timestamptz,
  rows_affected integer     NOT NULL DEFAULT 0,
  details       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_ran_at ON public.maintenance_log (ran_at DESC);

ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view maintenance log" ON public.maintenance_log;
CREATE POLICY "Admins can view maintenance log"
  ON public.maintenance_log FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 3. The cleanup routine. SECURITY DEFINER so pg_cron (and admins via RPC) can
--    move rows regardless of RLS. Column list is computed at runtime so adding a
--    column to match_entries (and the archive) never breaks the job.
CREATE OR REPLACE FUNCTION public.cleanup_last_week_matches(_dry_run boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') - interval '7 days';
  v_end   timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC');
  v_cols  text;
  v_count integer := 0;
BEGIN
  -- Callable by pg_cron (no auth.uid()) or by admins through PostgREST.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can run the match cleanup';
  END IF;

  IF _dry_run THEN
    SELECT count(*) INTO v_count
    FROM public.match_entries
    WHERE created_at >= v_start AND created_at < v_end;
    RETURN v_count;
  END IF;

  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'match_entries'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns a
      WHERE a.table_schema = 'public'
        AND a.table_name = 'match_entries_archive'
        AND a.column_name = c.column_name
    );

  EXECUTE format(
    'WITH moved AS (
       DELETE FROM public.match_entries
       WHERE created_at >= $1 AND created_at < $2
       RETURNING *
     )
     INSERT INTO public.match_entries_archive (%s)
     SELECT %s FROM moved
     ON CONFLICT (id) DO NOTHING',
    v_cols, v_cols
  ) USING v_start, v_end;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.maintenance_log (job, window_start, window_end, rows_affected, details)
  VALUES (
    'weekly-match-cleanup',
    v_start,
    v_end,
    v_count,
    jsonb_build_object('triggered_by', COALESCE(auth.uid()::text, 'pg_cron'))
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_last_week_matches(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_last_week_matches(boolean) TO authenticated, service_role;

-- 4. Restore helper for admins: put an archived event back (or a single team).
CREATE OR REPLACE FUNCTION public.restore_archived_matches(_event_code text, _team_number integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols    text;
  v_count   integer := 0;
  v_skipped integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can restore archived matches';
  END IF;

  -- A live row may have reappeared since the cleanup (a late QR import, say).
  -- Those archived copies are left in the archive rather than restored, so a
  -- restore can never discard the archived version of a match.
  SELECT count(*) INTO v_skipped
  FROM public.match_entries_archive a
  WHERE a.event_code = _event_code
    AND (_team_number IS NULL OR a.team_number = _team_number)
    AND EXISTS (
      SELECT 1 FROM public.match_entries m
      WHERE m.event_code   = a.event_code
        AND m.team_number  = a.team_number
        AND m.match_number = a.match_number
        AND m.scouter_id   = a.scouter_id
    );

  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'match_entries'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns a
      WHERE a.table_schema = 'public'
        AND a.table_name = 'match_entries_archive'
        AND a.column_name = c.column_name
    );

  -- Delete only the archived rows that have no live counterpart, so a conflict
  -- can never consume the archive copy. No ON CONFLICT clause on purpose: if a
  -- live row appears between the filter and the insert, the unique violation
  -- aborts the whole function and the archive is left intact, which is the safe
  -- failure for data an admin is trying to recover.
  EXECUTE format(
    'WITH restorable AS (
       SELECT a.id
       FROM public.match_entries_archive a
       WHERE a.event_code = $1
         AND ($2 IS NULL OR a.team_number = $2)
         AND NOT EXISTS (
           SELECT 1 FROM public.match_entries m
           WHERE m.event_code   = a.event_code
             AND m.team_number  = a.team_number
             AND m.match_number = a.match_number
             AND m.scouter_id   = a.scouter_id
         )
     ),
     restored AS (
       DELETE FROM public.match_entries_archive
       WHERE id IN (SELECT id FROM restorable)
       RETURNING *
     )
     INSERT INTO public.match_entries (%s)
     SELECT %s FROM restored',
    v_cols, v_cols
  ) USING _event_code, _team_number;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.maintenance_log (job, rows_affected, details)
  VALUES ('restore-archived-matches', v_count,
          jsonb_build_object('event_code', _event_code, 'team_number', _team_number,
                             'skipped_still_live', v_skipped, 'triggered_by', auth.uid()));

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_archived_matches(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_archived_matches(text, integer) TO authenticated, service_role;

-- 5. Schedule: every Wednesday 09:00 UTC (04:00 EST / 05:00 EDT).
--    pg_cron was enabled in 20260208154423. Re-running this migration replaces
--    the job instead of duplicating it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-match-cleanup') THEN
      PERFORM cron.unschedule('weekly-match-cleanup');
    END IF;
    PERFORM cron.schedule(
      'weekly-match-cleanup',
      '0 9 * * 3',
      $job$ SELECT public.cleanup_last_week_matches(); $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; weekly-match-cleanup was NOT scheduled.';
  END IF;
END $$;
