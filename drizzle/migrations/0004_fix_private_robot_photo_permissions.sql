DROP POLICY IF EXISTS "Users can upload own team photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own team photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own team photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own team photos" ON storage.objects;
CREATE POLICY "Users can upload own team photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'robot-photos' AND (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.team_number::text = split_part(objects.name, '/', 1))));
CREATE POLICY "Users can update own team photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'robot-photos' AND (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.team_number::text = split_part(objects.name, '/', 1))))
WITH CHECK (bucket_id = 'robot-photos' AND (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.team_number::text = split_part(objects.name, '/', 1))));
CREATE POLICY "Users can delete own team photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'robot-photos' AND (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.status = 'approved' AND p.team_number::text = split_part(objects.name, '/', 1))));
CREATE POLICY "Users can view own team photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'robot-photos' AND (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = auth.uid() AND p.status = 'approved' AND (p.team_number::text = split_part(objects.name, '/', 1) OR (p.team_number IN (2844,12841) AND split_part(objects.name, '/', 1) IN ('2844','12841'))))));