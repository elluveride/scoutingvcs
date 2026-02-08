
-- Fix: Require authentication to view events
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;

CREATE POLICY "Authenticated users can view active events"
ON public.events
FOR SELECT
TO authenticated
USING ((archived = false) OR is_admin(auth.uid()));
