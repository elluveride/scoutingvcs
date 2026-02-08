
-- =====================================================
-- Fix ALL RLS policies: Convert from RESTRICTIVE to PERMISSIVE
-- and add TO authenticated to require login
-- =====================================================

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view relevant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  (auth.uid() = id)
  OR is_admin(auth.uid())
  OR (
    team_number IS NOT NULL
    AND get_my_team_number() IS NOT NULL
    AND (team_number = get_my_team_number() OR is_allied_team(team_number, get_my_team_number()))
  )
);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (is_admin(auth.uid()));

-- ==================== EVENTS ====================
DROP POLICY IF EXISTS "Authenticated users can view active events" ON public.events;
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Authenticated users can view active events"
ON public.events FOR SELECT TO authenticated
USING ((archived = false) OR is_admin(auth.uid()));

CREATE POLICY "Admins can create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()) OR NOT EXISTS (SELECT 1 FROM events));

CREATE POLICY "Admins can update events"
ON public.events FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete events"
ON public.events FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- ==================== FTC_EVENTS_CACHE ====================
DROP POLICY IF EXISTS "Authenticated users can view cached events" ON public.ftc_events_cache;

CREATE POLICY "Authenticated users can view cached events"
ON public.ftc_events_cache FOR SELECT TO authenticated
USING (true);

-- ==================== MATCH_ENTRIES ====================
DROP POLICY IF EXISTS "Users can view their team match entries" ON public.match_entries;
DROP POLICY IF EXISTS "Approved users can insert match entries" ON public.match_entries;
DROP POLICY IF EXISTS "Admins can update any entry" ON public.match_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.match_entries;
DROP POLICY IF EXISTS "Admins can delete match entries" ON public.match_entries;

CREATE POLICY "Users can view their team match entries"
ON public.match_entries FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles scouter ON (viewer.team_number = scouter.team_number OR is_allied_team(viewer.team_number, scouter.team_number))
    WHERE viewer.id = auth.uid() AND scouter.id = match_entries.scouter_id
  )
);

CREATE POLICY "Approved users can insert match entries"
ON public.match_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::user_status
));

CREATE POLICY "Admins can update any entry"
ON public.match_entries FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own entries"
ON public.match_entries FOR UPDATE TO authenticated
USING (scouter_id = auth.uid());

CREATE POLICY "Admins can delete match entries"
ON public.match_entries FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- ==================== PIT_ENTRIES ====================
DROP POLICY IF EXISTS "Users can view their team pit entries" ON public.pit_entries;
DROP POLICY IF EXISTS "Approved users can insert pit entries" ON public.pit_entries;
DROP POLICY IF EXISTS "Approved users can update pit entries" ON public.pit_entries;

CREATE POLICY "Users can view their team pit entries"
ON public.pit_entries FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles editor ON (viewer.team_number = editor.team_number OR is_allied_team(viewer.team_number, editor.team_number))
    WHERE viewer.id = auth.uid() AND editor.id = pit_entries.last_edited_by
  )
);

CREATE POLICY "Approved users can insert pit entries"
ON public.pit_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::user_status
));

CREATE POLICY "Approved users can update pit entries"
ON public.pit_entries FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::user_status
));

-- ==================== SCOUTER_ASSIGNMENTS ====================
DROP POLICY IF EXISTS "Team members can view assignments" ON public.scouter_assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.scouter_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.scouter_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.scouter_assignments;

CREATE POLICY "Team members can view assignments"
ON public.scouter_assignments FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles creator ON (viewer.team_number = creator.team_number OR is_allied_team(viewer.team_number, creator.team_number))
    WHERE viewer.id = auth.uid() AND creator.id = scouter_assignments.created_by
  )
);

CREATE POLICY "Admins can insert assignments"
ON public.scouter_assignments FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update assignments"
ON public.scouter_assignments FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete assignments"
ON public.scouter_assignments FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- ==================== DASHBOARD_CONFIGS ====================
DROP POLICY IF EXISTS "Users can view team dashboard configs" ON public.dashboard_configs;
DROP POLICY IF EXISTS "Admins can insert dashboard configs" ON public.dashboard_configs;
DROP POLICY IF EXISTS "Admins can update dashboard configs" ON public.dashboard_configs;
DROP POLICY IF EXISTS "Admins can delete dashboard configs" ON public.dashboard_configs;

CREATE POLICY "Users can view team dashboard configs"
ON public.dashboard_configs FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_number = dashboard_configs.team_number OR is_allied_team(profiles.team_number, dashboard_configs.team_number))
  )
);

CREATE POLICY "Admins can insert dashboard configs"
ON public.dashboard_configs FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update dashboard configs"
ON public.dashboard_configs FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete dashboard configs"
ON public.dashboard_configs FOR DELETE TO authenticated
USING (is_admin(auth.uid()));
