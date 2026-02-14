
-- Create a security definer function to check if user is on a privileged team
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

-- Update match_entries SELECT policy to allow privileged teams global read
DROP POLICY IF EXISTS "Users can view their team match entries" ON public.match_entries;
CREATE POLICY "Users can view their team match entries"
ON public.match_entries FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_privileged_team(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles scouter ON (viewer.team_number = scouter.team_number OR is_allied_team(viewer.team_number, scouter.team_number))
    WHERE viewer.id = auth.uid() AND scouter.id = match_entries.scouter_id
  )
);

-- Update pit_entries SELECT policy to allow privileged teams global read
DROP POLICY IF EXISTS "Users can view their team pit entries" ON public.pit_entries;
CREATE POLICY "Users can view their team pit entries"
ON public.pit_entries FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_privileged_team(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles editor ON (viewer.team_number = editor.team_number OR is_allied_team(viewer.team_number, editor.team_number))
    WHERE viewer.id = auth.uid() AND editor.id = pit_entries.last_edited_by
  )
);
