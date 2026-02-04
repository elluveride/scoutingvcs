-- Add photo_url column to pit_entries
ALTER TABLE public.pit_entries
ADD COLUMN robot_photo_url TEXT;

-- Create storage bucket for robot photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('robot-photos', 'robot-photos', true);

-- Allow anyone to view robot photos (public bucket)
CREATE POLICY "Robot photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'robot-photos');

-- Allow approved users to upload robot photos
CREATE POLICY "Approved users can upload robot photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'robot-photos' 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

-- Allow approved users to update robot photos
CREATE POLICY "Approved users can update robot photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'robot-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

-- Allow approved users to delete robot photos
CREATE POLICY "Approved users can delete robot photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'robot-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);