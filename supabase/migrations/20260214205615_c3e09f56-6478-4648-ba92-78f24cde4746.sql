
-- Fix robot-photos storage policies to enforce team isolation via path prefix
DROP POLICY IF EXISTS "Approved users can upload robot photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can update robot photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete robot photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view robot photos" ON storage.objects;

-- Users can only upload photos under their team's folder
CREATE POLICY "Users can upload own team photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'robot-photos'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'
      AND CAST(profiles.team_number AS TEXT) = split_part(name, '/', 1)
    )
  )
);

-- Users can only update photos under their team's folder
CREATE POLICY "Users can update own team photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'robot-photos'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'
      AND CAST(profiles.team_number AS TEXT) = split_part(name, '/', 1)
    )
  )
);

-- Users can only delete photos under their team's folder
CREATE POLICY "Users can delete own team photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'robot-photos'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'
      AND CAST(profiles.team_number AS TEXT) = split_part(name, '/', 1)
    )
  )
);

-- Users can view photos from their own team (+ admins see all)
CREATE POLICY "Users can view own team photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'robot-photos'
  AND (
    is_admin(auth.uid())
    OR is_privileged_team(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND CAST(profiles.team_number AS TEXT) = split_part(name, '/', 1)
    )
  )
);
