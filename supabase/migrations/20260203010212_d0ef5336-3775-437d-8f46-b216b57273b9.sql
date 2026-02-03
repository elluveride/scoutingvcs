-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;

CREATE POLICY "Anyone can view events"
ON public.events
FOR SELECT
TO authenticated
USING (true);