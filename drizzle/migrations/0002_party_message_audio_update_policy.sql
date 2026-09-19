-- Allow narration clips to be replaced (re-record / re-voice):
-- the upsert on party_message_audio takes the UPDATE path when a row
-- already exists, so an UPDATE policy is required for the save to succeed.
DROP POLICY IF EXISTS "Members replace own message audio, hosts replace any" ON public.party_message_audio;

CREATE POLICY "Members replace own message audio, hosts replace any"
ON public.party_message_audio
FOR UPDATE
TO authenticated
USING (
  (public.is_party_member(auth.uid(), party_id) AND created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_message_audio.party_id
      AND (p.created_by = auth.uid() OR public.is_co_host_of(p.created_by))
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_party_member(auth.uid(), party_id)
    OR EXISTS (
      SELECT 1 FROM public.parties p
      WHERE p.id = party_message_audio.party_id
        AND (p.created_by = auth.uid() OR public.is_co_host_of(p.created_by))
    )
  )
);