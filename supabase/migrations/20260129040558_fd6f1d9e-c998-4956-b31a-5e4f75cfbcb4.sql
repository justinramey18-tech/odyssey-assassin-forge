-- Create storage bucket for gear images
INSERT INTO storage.buckets (id, name, public) VALUES ('gear-images', 'gear-images', true);

-- Allow anyone to view gear images (they're public)
CREATE POLICY "Gear images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'gear-images');

-- Allow anyone to upload gear images (no auth for simplicity since this is a single-player app)
CREATE POLICY "Anyone can upload gear images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gear-images');

-- Allow anyone to update their gear images
CREATE POLICY "Anyone can update gear images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'gear-images');

-- Allow anyone to delete gear images
CREATE POLICY "Anyone can delete gear images"
ON storage.objects FOR DELETE
USING (bucket_id = 'gear-images');