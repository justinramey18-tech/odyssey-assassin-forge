-- Narration clips live at: <party_id>/narration/<message_id>-<part>.<ext>
-- storeClip() uploads them with upsert: true, and recordSegment() does the same.
-- An upsert over an existing object runs an UPDATE against storage.objects, which
-- needs an UPDATE policy. Deleting them needs a DELETE policy. Neither existed, so
-- regenerating narration failed with
-- "new row violates row-level security policy".

-- Folder names are user data, so the party-id segment may not always parse as a
-- uuid. This helper returns NULL instead of raising inside a policy.
CREATE OR REPLACE FUNCTION public.safe_uuid(txt text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN txt::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS "Party members can replace narration audio" ON storage.objects;
DROP POLICY IF EXISTS "Party members can delete narration audio" ON storage.objects;

CREATE POLICY "Party members can replace narration audio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'party-chat-audio'
  AND name LIKE '%/narration/%'
  AND public.is_party_member(auth.uid(), public.safe_uuid((storage.foldername(name))[1]))
)
WITH CHECK (
  bucket_id = 'party-chat-audio'
  AND name LIKE '%/narration/%'
  AND public.is_party_member(auth.uid(), public.safe_uuid((storage.foldername(name))[1]))
);

CREATE POLICY "Party members can delete narration audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'party-chat-audio'
  AND name LIKE '%/narration/%'
  AND public.is_party_member(auth.uid(), public.safe_uuid((storage.foldername(name))[1]))
);
