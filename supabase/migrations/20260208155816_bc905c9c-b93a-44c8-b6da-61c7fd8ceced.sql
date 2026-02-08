
-- =============================================
-- 1. PROFILES: Restrict SELECT to own team, allied teams, admins
-- =============================================

-- Create helper function to get current user's team number (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_team_number()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_number FROM profiles WHERE id = auth.uid()
$$;

-- Replace overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view relevant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR is_admin(auth.uid())
  OR (
    team_number IS NOT NULL
    AND get_my_team_number() IS NOT NULL
    AND (
      team_number = get_my_team_number()
      OR is_allied_team(team_number, get_my_team_number())
    )
  )
);

-- =============================================
-- 2. EVENTS: Add missing UPDATE/DELETE policies
-- =============================================

CREATE POLICY "Admins can update events"
ON public.events FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete events"
ON public.events FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- =============================================
-- 3. FIX auto_approve_first_user race condition
-- =============================================

CREATE OR REPLACE FUNCTION public.auto_approve_first_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  -- Advisory lock prevents race condition with simultaneous signups
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

-- =============================================
-- 4. ROBOT PHOTOS: Make bucket private
-- =============================================

UPDATE storage.buckets
SET public = false
WHERE id = 'robot-photos';

-- Drop old public policy
DROP POLICY IF EXISTS "Robot photos are publicly accessible" ON storage.objects;

-- Authenticated users can view robot photos (controlled by app logic)
CREATE POLICY "Authenticated users can view robot photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'robot-photos');

-- =============================================
-- 5. EVENTS: Add archived column for soft-delete
-- =============================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Filter archived events from default view
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;

CREATE POLICY "Anyone can view active events"
ON public.events FOR SELECT
TO authenticated
USING (archived = false OR is_admin(auth.uid()));
