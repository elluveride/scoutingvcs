
-- Add team_number to profiles
ALTER TABLE public.profiles ADD COLUMN team_number integer;

-- Drop existing open SELECT policies
DROP POLICY IF EXISTS "Anyone can view match entries" ON public.match_entries;
DROP POLICY IF EXISTS "Anyone can view pit entries" ON public.pit_entries;

-- Match entries: users see entries from scouters on the same team, admins see all
CREATE POLICY "Users can view their team match entries"
ON public.match_entries
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles scouter ON viewer.team_number = scouter.team_number
    WHERE viewer.id = auth.uid()
    AND scouter.id = match_entries.scouter_id
  )
);

-- Pit entries: users see entries edited by scouters on the same team, admins see all
CREATE POLICY "Users can view their team pit entries"
ON public.pit_entries
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM profiles viewer
    JOIN profiles editor ON viewer.team_number = editor.team_number
    WHERE viewer.id = auth.uid()
    AND editor.id = pit_entries.last_edited_by
  )
);
