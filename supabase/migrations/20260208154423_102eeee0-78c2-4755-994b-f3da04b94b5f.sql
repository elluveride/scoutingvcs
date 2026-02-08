
-- 1. Create allied teams function (must come before policies that reference it)
CREATE OR REPLACE FUNCTION public.is_allied_team(team_a integer, team_b integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (team_a = 2844 AND team_b = 12841) 
      OR (team_a = 12841 AND team_b = 2844)
$$;

-- 2. Create ftc_events_cache table for storing all FTC events from API
CREATE TABLE public.ftc_events_cache (
  code text PRIMARY KEY,
  name text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  season integer NOT NULL,
  team_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  city text,
  state_prov text,
  country text,
  last_synced timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ftc_events_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cached events"
ON public.ftc_events_cache FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Create dashboard_configs table for per-team dashboard settings
CREATE TABLE public.dashboard_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_number integer NOT NULL,
  event_code text NOT NULL,
  config_index integer NOT NULL DEFAULT 0,
  list_name text NOT NULL DEFAULT 'List',
  weights jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(team_number, event_code, config_index)
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

-- Team members can view their team's configs (+ allied teams)
CREATE POLICY "Users can view team dashboard configs"
ON public.dashboard_configs FOR SELECT
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.team_number = dashboard_configs.team_number
      OR is_allied_team(profiles.team_number, dashboard_configs.team_number)
    )
  )
);

CREATE POLICY "Admins can insert dashboard configs"
ON public.dashboard_configs FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update dashboard configs"
ON public.dashboard_configs FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete dashboard configs"
ON public.dashboard_configs FOR DELETE
USING (is_admin(auth.uid()));

-- 4. Update RLS policies for cross-team data sharing (2844 <-> 12841)

-- match_entries: allow allied teams to see each other's data
DROP POLICY IF EXISTS "Users can view their team match entries" ON public.match_entries;
CREATE POLICY "Users can view their team match entries"
ON public.match_entries FOR SELECT
USING (
  is_admin(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles scouter ON (
      viewer.team_number = scouter.team_number
      OR is_allied_team(viewer.team_number, scouter.team_number)
    )
    WHERE viewer.id = auth.uid() 
    AND scouter.id = match_entries.scouter_id
  )
);

-- pit_entries: allow allied teams to see each other's data
DROP POLICY IF EXISTS "Users can view their team pit entries" ON public.pit_entries;
CREATE POLICY "Users can view their team pit entries"
ON public.pit_entries FOR SELECT
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles editor ON (
      viewer.team_number = editor.team_number
      OR is_allied_team(viewer.team_number, editor.team_number)
    )
    WHERE viewer.id = auth.uid()
    AND editor.id = pit_entries.last_edited_by
  )
);

-- scouter_assignments: allow allied teams to see each other's assignments
DROP POLICY IF EXISTS "Team members can view assignments" ON public.scouter_assignments;
CREATE POLICY "Team members can view assignments"
ON public.scouter_assignments FOR SELECT
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles creator ON (
      viewer.team_number = creator.team_number
      OR is_allied_team(viewer.team_number, creator.team_number)
    )
    WHERE viewer.id = auth.uid()
    AND creator.id = scouter_assignments.created_by
  )
);

-- 5. Enable realtime for dashboard_configs
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_configs;

-- 6. Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
