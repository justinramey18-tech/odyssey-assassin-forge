
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cinematic-audio', 'cinematic-audio', true, 10485760);

CREATE POLICY "Anyone can read cinematic audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'cinematic-audio');

CREATE POLICY "Authenticated users can upload cinematic audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cinematic-audio');

CREATE POLICY "Authenticated users can delete cinematic audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cinematic-audio');
