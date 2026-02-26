-- =============================================================================
-- DECODE Scouting — Complete Schema Migration
-- Run this in your Supabase SQL Editor to recreate the entire database
-- =============================================================================

-- =====================
-- 1. ENUMS
-- =====================
CREATE TYPE public.app_role AS ENUM ('admin', 'scout');
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.drive_type AS ENUM ('tank', 'mecanum', 'swerve', 'other');
CREATE TYPE public.consistency_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.auto_leave_status AS ENUM ('yes', 'sometimes', 'no');
CREATE TYPE public.endgame_return_status AS ENUM ('not_returned', 'partial', 'full', 'lift');
CREATE TYPE public.penalty_status AS ENUM ('none', 'dead', 'yellow_card', 'red_card');
CREATE TYPE public.motif_type AS ENUM ('PPG', 'PGP', 'GPP');
CREATE TYPE public.park_status AS ENUM ('none', 'partial', 'full');

-- =====================
-- 2. TABLES
-- =====================

-- profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  name text NOT NULL,
  role app_role NOT NULL DEFAULT 'scout'::app_role,
  status user_status NOT NULL DEFAULT 'pending'::user_status,
  team_number integer,
  event_code text,
  team_number_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ftc_events_cache
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

-- match_entries
CREATE TABLE public.match_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  team_number integer NOT NULL,
  match_number integer NOT NULL,
  scouter_id uuid NOT NULL,
  auto_scored_close integer NOT NULL DEFAULT 0,
  auto_scored_far integer NOT NULL DEFAULT 0,
  auto_fouls_minor integer NOT NULL DEFAULT 0,
  auto_fouls_major integer NOT NULL DEFAULT 0,
  on_launch_line boolean NOT NULL DEFAULT false,
  teleop_scored_close integer NOT NULL DEFAULT 0,
  teleop_scored_far integer NOT NULL DEFAULT 0,
  teleop_depot integer NOT NULL DEFAULT 0,
  defense_rating integer NOT NULL DEFAULT 0,
  endgame_return endgame_return_status NOT NULL DEFAULT 'not_returned'::endgame_return_status,
  penalty_status penalty_status NOT NULL DEFAULT 'none'::penalty_status,
  auto_pattern_matches integer NOT NULL DEFAULT 0,
  teleop_pattern_matches integer NOT NULL DEFAULT 0,
  motif text NOT NULL DEFAULT 'PPG'::text,
  notes text NOT NULL DEFAULT ''::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_code, team_number, match_number, scouter_id)
);

-- pit_entries
CREATE TABLE public.pit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  team_number integer NOT NULL,
  team_name text NOT NULL,
  drive_type drive_type NOT NULL DEFAULT 'tank'::drive_type,
  scores_motifs boolean NOT NULL DEFAULT false,
  scores_artifacts boolean NOT NULL DEFAULT false,
  scores_depot boolean NOT NULL DEFAULT false,
  has_autonomous boolean NOT NULL DEFAULT false,
  auto_consistency consistency_level NOT NULL DEFAULT 'low'::consistency_level,
  reliable_auto_leave auto_leave_status NOT NULL DEFAULT 'no'::auto_leave_status,
  preferred_start text NOT NULL DEFAULT 'close'::text,
  endgame_consistency consistency_level NOT NULL DEFAULT 'low'::consistency_level,
  auto_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  robot_photo_url text,
  last_edited_by uuid,
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_code, team_number)
);

-- dashboard_configs
CREATE TABLE public.dashboard_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number integer NOT NULL,
  event_code text NOT NULL,
  config_index integer NOT NULL DEFAULT 0,
  list_name text NOT NULL DEFAULT 'List'::text,
  weights jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_number, event_code, config_index)
);

-- scouter_assignments
CREATE TABLE public.scouter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  match_number integer NOT NULL,
  team_number integer NOT NULL,
  position text NOT NULL,
  scouter_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- bug_reports
CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_url text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- team_change_requests
CREATE TABLE public.team_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_team_number integer NOT NULL,
  requested_team_number integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================
-- 3. DATABASE FUNCTIONS
-- =====================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_privileged_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = _user_id
    AND team_number IN (12841, 2844)
  )
$$;

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

CREATE OR REPLACE FUNCTION public.get_my_team_number()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_number FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.create_profile_for_signup(_user_id uuid, _name text, _team_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Invalid user ID';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;

  INSERT INTO profiles (id, name, team_number, role, status)
  VALUES (_user_id, _name, _team_number, 'scout', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_approve_first_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auto_approve_first_user'));

  SELECT COUNT(*) INTO profile_count
  FROM public.profiles
  WHERE id != NEW.id;

  IF profile_count = 0 THEN
    NEW.status := 'approved';
    NEW.role := 'admin';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

-- =====================
-- 4. TRIGGERS
-- =====================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER auto_approve_first_user_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_first_user();

-- =====================
-- 5. ENABLE RLS ON ALL TABLES
-- =====================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ftc_events_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouter_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_change_requests ENABLE ROW LEVEL SECURITY;

-- =====================
-- 6. RLS POLICIES
-- =====================

-- ---- profiles ----
CREATE POLICY "Users can view relevant profiles" ON public.profiles
  FOR SELECT USING (
    (auth.uid() = id)
    OR is_admin(auth.uid())
    OR (
      team_number IS NOT NULL
      AND get_my_team_number() IS NOT NULL
      AND (team_number = get_my_team_number() OR is_allied_team(team_number, get_my_team_number()))
    )
  );

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (is_admin(auth.uid()));

-- ---- user_roles ----
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (is_admin(auth.uid()));

-- ---- events ----
CREATE POLICY "Authenticated users can view active events" ON public.events
  FOR SELECT USING (archived = false OR is_admin(auth.uid()));

CREATE POLICY "Admins can create events" ON public.events
  FOR INSERT WITH CHECK (
    is_admin(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM events)
  );

CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE USING (is_admin(auth.uid()));

-- ---- ftc_events_cache ----
CREATE POLICY "Authenticated users can view cached events" ON public.ftc_events_cache
  FOR SELECT USING (true);

-- ---- match_entries ----
CREATE POLICY "Users can view their team match entries" ON public.match_entries
  FOR SELECT USING (
    is_admin(auth.uid())
    OR is_privileged_team(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM profiles viewer
      JOIN profiles scouter ON (
        viewer.team_number = scouter.team_number
        OR is_allied_team(viewer.team_number, scouter.team_number)
      )
      WHERE viewer.id = auth.uid()
        AND scouter.id = match_entries.scouter_id
    )
  );

CREATE POLICY "Approved users can insert match entries" ON public.match_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::user_status
    )
  );

CREATE POLICY "Admins can update any entry" ON public.match_entries
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own entries" ON public.match_entries
  FOR UPDATE USING (scouter_id = auth.uid());

CREATE POLICY "Admins can delete match entries" ON public.match_entries
  FOR DELETE USING (is_admin(auth.uid()));

-- ---- pit_entries ----
CREATE POLICY "Users can view their team pit entries" ON public.pit_entries
  FOR SELECT USING (
    is_admin(auth.uid())
    OR is_privileged_team(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM profiles viewer
      JOIN profiles editor ON (
        viewer.team_number = editor.team_number
        OR is_allied_team(viewer.team_number, editor.team_number)
      )
      WHERE viewer.id = auth.uid()
        AND editor.id = pit_entries.last_edited_by
    )
  );

CREATE POLICY "Approved users can insert pit entries" ON public.pit_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::user_status
    )
  );

CREATE POLICY "Approved users can update pit entries" ON public.pit_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::user_status
    )
  );

-- ---- dashboard_configs ----
CREATE POLICY "Users can view team dashboard configs" ON public.dashboard_configs
  FOR SELECT USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.team_number = dashboard_configs.team_number
             OR is_allied_team(profiles.team_number, dashboard_configs.team_number))
    )
  );

CREATE POLICY "Admins can insert dashboard configs" ON public.dashboard_configs
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update dashboard configs" ON public.dashboard_configs
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete dashboard configs" ON public.dashboard_configs
  FOR DELETE USING (is_admin(auth.uid()));

-- ---- scouter_assignments ----
CREATE POLICY "Team members can view assignments" ON public.scouter_assignments
  FOR SELECT USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM profiles viewer
      JOIN profiles creator ON (
        viewer.team_number = creator.team_number
        OR is_allied_team(viewer.team_number, creator.team_number)
      )
      WHERE viewer.id = auth.uid()
        AND creator.id = scouter_assignments.created_by
    )
  );

CREATE POLICY "Admins can insert assignments" ON public.scouter_assignments
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update assignments" ON public.scouter_assignments
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete assignments" ON public.scouter_assignments
  FOR DELETE USING (is_admin(auth.uid()));

-- ---- bug_reports ----
CREATE POLICY "Users can submit bug reports" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bug reports" ON public.bug_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bug reports" ON public.bug_reports
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update bug reports" ON public.bug_reports
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bug reports" ON public.bug_reports
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- team_change_requests ----
CREATE POLICY "Users can create own requests" ON public.team_change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON public.team_change_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests" ON public.team_change_requests
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update requests" ON public.team_change_requests
  FOR UPDATE USING (is_admin(auth.uid()));

-- =====================
-- 7. STORAGE BUCKETS
-- =====================

INSERT INTO storage.buckets (id, name, public)
VALUES ('robot-photos', 'robot-photos', false);

-- Storage RLS: team-scoped uploads
CREATE POLICY "Users can upload robot photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'robot-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::user_status
    )
  );

CREATE POLICY "Users can view robot photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'robot-photos');

CREATE POLICY "Users can update their uploads" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'robot-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::user_status
    )
  );

-- =====================
-- 8. REALTIME (optional — enable for live updates)
-- =====================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.match_entries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.scouter_assignments;

-- =====================
-- DONE! After running this:
-- 1. Add your Edge Functions (ftc-rankings, ftc-matches, ftc-events-sync, etc.)
-- 2. Set secrets: FTC_API_USERNAME, FTC_API_TOKEN, RESEND_API_KEY
-- 3. Import your data using INSERT statements (export separately)
-- =====================
