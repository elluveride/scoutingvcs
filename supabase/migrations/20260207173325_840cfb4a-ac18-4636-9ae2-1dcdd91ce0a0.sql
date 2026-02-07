
-- Fix: INSERT policy is RESTRICTIVE, meaning no permissive policy exists to grant access.
-- Drop the restrictive policy and recreate as PERMISSIVE.

DROP POLICY IF EXISTS "Approved users can insert match entries" ON public.match_entries;

CREATE POLICY "Approved users can insert match entries"
ON public.match_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'::user_status
  )
);

-- Also fix UPDATE policies - both are RESTRICTIVE (AND logic), meaning
-- non-admins fail the admin check even for their own entries.
DROP POLICY IF EXISTS "Admins can update any entry" ON public.match_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.match_entries;

CREATE POLICY "Admins can update any entry"
ON public.match_entries
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own entries"
ON public.match_entries
FOR UPDATE
TO authenticated
USING (scouter_id = auth.uid());

-- Fix SELECT policy too
DROP POLICY IF EXISTS "Users can view their team match entries" ON public.match_entries;

CREATE POLICY "Users can view their team match entries"
ON public.match_entries
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR
  EXISTS (
    SELECT 1
    FROM profiles viewer
    JOIN profiles scouter ON viewer.team_number = scouter.team_number
    WHERE viewer.id = auth.uid()
      AND scouter.id = match_entries.scouter_id
  )
);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Admins can delete match entries" ON public.match_entries;

CREATE POLICY "Admins can delete match entries"
ON public.match_entries
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
