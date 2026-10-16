-- Private scene videos use party_id/message_id/random-uuid.extension.
-- Compare the first segment as text: malformed names must never be cast to UUID.
CREATE POLICY "Party members can read private scene videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'party-scene-videos'
  AND EXISTS (
    SELECT 1 FROM public.party_members AS member
    WHERE member.party_id::text = split_part(storage.objects.name, '/', 1)
      AND member.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Original party host can upload private scene videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'party-scene-videos'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$'
  AND EXISTS (
    SELECT 1 FROM public.parties AS party
    WHERE party.id::text = split_part(storage.objects.name, '/', 1)
      AND party.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Original party host can delete private scene videos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'party-scene-videos'
  AND EXISTS (
    SELECT 1 FROM public.parties AS party
    WHERE party.id::text = split_part(storage.objects.name, '/', 1)
      AND party.created_by = (SELECT auth.uid())
  )
);