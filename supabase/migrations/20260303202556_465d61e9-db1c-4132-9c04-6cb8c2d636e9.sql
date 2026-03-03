
-- Create storage bucket for custom SFX audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-sfx', 'custom-sfx', false);

-- Users can upload their own SFX files
CREATE POLICY "Users can upload their own SFX"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'custom-sfx'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own SFX files
CREATE POLICY "Users can read their own SFX"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'custom-sfx'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own SFX files
CREATE POLICY "Users can update their own SFX"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'custom-sfx'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own SFX files
CREATE POLICY "Users can delete their own SFX"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'custom-sfx'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
