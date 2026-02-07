-- Allow admins to delete match entries
CREATE POLICY "Admins can delete match entries"
ON public.match_entries
FOR DELETE
USING (is_admin(auth.uid()));