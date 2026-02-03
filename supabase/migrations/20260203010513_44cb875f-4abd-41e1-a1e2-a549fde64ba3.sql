-- Fix pit_entries RLS policies to be permissive (they were restrictive)
DROP POLICY IF EXISTS "Anyone can view pit entries" ON public.pit_entries;
DROP POLICY IF EXISTS "Approved users can insert pit entries" ON public.pit_entries;
DROP POLICY IF EXISTS "Approved users can update pit entries" ON public.pit_entries;

-- Recreate as permissive policies
CREATE POLICY "Anyone can view pit entries"
ON public.pit_entries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Approved users can insert pit entries"
ON public.pit_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can update pit entries"
ON public.pit_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);