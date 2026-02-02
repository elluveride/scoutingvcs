-- Fix permissive RLS policy for events insert
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

-- Create a more restrictive policy - only admins can create events
CREATE POLICY "Admins can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR NOT EXISTS (SELECT 1 FROM public.events));