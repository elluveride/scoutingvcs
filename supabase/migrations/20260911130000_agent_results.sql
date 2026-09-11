-- ─────────────────────────────────────────────────────────────────────────────
-- Agent results — the bridge between the MCP tools and the Pit Display.
--
-- The `record_insight` MCP tool inserts here as the signed-in scout (the tools
-- forward the user's bearer token, so these policies are what actually gates
-- writes). The Pit Display subscribes to the table over Supabase Realtime, so a
-- recorded insight appears on the team's screen within seconds.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_results (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code  text        NOT NULL,
  team_number integer     CHECK (team_number IS NULL OR (team_number BETWEEN 1 AND 99999)),
  match_label text        CHECK (match_label IS NULL OR char_length(match_label) <= 32),
  kind        text        NOT NULL DEFAULT 'insight'
              CHECK (kind IN ('insight', 'prediction', 'alert', 'note')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  summary     text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confidence  integer     CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 100)),
  created_by  uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id   text,
  client_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_results_event ON public.agent_results (event_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_results_team  ON public.agent_results (event_code, team_number);

ALTER TABLE public.agent_results ENABLE ROW LEVEL SECURITY;

-- Read: same team-scoped rule as match/pit entries — your team, your allied
-- team, or everything for admins and the privileged teams.
DROP POLICY IF EXISTS "Users can view their team agent results" ON public.agent_results;
CREATE POLICY "Users can view their team agent results"
  ON public.agent_results FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.is_privileged_team(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles viewer
      JOIN public.profiles author ON (
        viewer.team_number = author.team_number
        OR public.is_allied_team(viewer.team_number, author.team_number)
      )
      WHERE viewer.id = auth.uid() AND author.id = agent_results.created_by
    )
  );

-- Write: only an approved scout, and only as themselves. An agent acting for a
-- user therefore cannot post on behalf of anyone else.
DROP POLICY IF EXISTS "Approved users can insert agent results" ON public.agent_results;
CREATE POLICY "Approved users can insert agent results"
  ON public.agent_results FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.status = 'approved'
    )
  );

-- Dismiss: the author or an admin.
DROP POLICY IF EXISTS "Authors and admins can delete agent results" ON public.agent_results;
CREATE POLICY "Authors and admins can delete agent results"
  ON public.agent_results FOR DELETE
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Realtime: the Pit Display subscribes to inserts and deletes on this table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agent_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_results;
  END IF;
END $$;

-- Realtime DELETE payloads only carry the primary key unless the row is sent in
-- full; REPLICA IDENTITY FULL lets the Pit Display match deletes it cares about.
ALTER TABLE public.agent_results REPLICA IDENTITY FULL;

-- Housekeeping: drop expired and long-stale insights on the weekly Wednesday job.
CREATE OR REPLACE FUNCTION public.cleanup_expired_agent_results()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.agent_results
  WHERE (expires_at IS NOT NULL AND expires_at < now())
     OR created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.maintenance_log (job, rows_affected)
  VALUES ('agent-results-purge', v_count);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_agent_results() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_agent_results() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-agent-results-purge') THEN
      PERFORM cron.unschedule('weekly-agent-results-purge');
    END IF;
    PERFORM cron.schedule(
      'weekly-agent-results-purge', '30 9 * * 3',
      $job$ SELECT public.cleanup_expired_agent_results(); $job$
    );
  END IF;
END $$;
