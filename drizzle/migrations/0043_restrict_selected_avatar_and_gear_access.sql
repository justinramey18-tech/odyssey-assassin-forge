ALTER POLICY "Anyone signed in can view chat avatars"
ON public.player_chat_avatars
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.party_members AS target_member
    WHERE target_member.user_id = player_chat_avatars.user_id
      AND (
        public.is_party_member((SELECT auth.uid()), target_member.party_id)
        OR public.is_party_host((SELECT auth.uid()), target_member.party_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.parties AS target_party
    WHERE target_party.created_by = player_chat_avatars.user_id
      AND public.is_party_member((SELECT auth.uid()), target_party.id)
  )
);

ALTER POLICY "Anyone can update gear images"
ON storage.objects
TO authenticated
USING (
  bucket_id = 'gear-images'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'gear-images'
  AND owner_id = (SELECT auth.uid()::text)
);

ALTER POLICY "Anyone can delete gear images"
ON storage.objects
TO authenticated
USING (
  bucket_id = 'gear-images'
  AND owner_id = (SELECT auth.uid()::text)
);