-- party_message_audio is written with .upsert(..., { onConflict: 'message_id,part' }).
-- An upsert that hits an existing row runs the ON CONFLICT DO UPDATE branch, which
-- requires an UPDATE policy. The table has SELECT, INSERT and DELETE policies but
-- no UPDATE policy, so every regeneration failed with "new row violates row-level security policy".

DROP POLICY IF EXISTS "Party members can update message audio" ON public.party_message_audio;

CREATE POLICY "Party members can update message audio"
ON public.party_message_audio FOR UPDATE TO authenticated
USING (public.is_party_member(auth.uid(), party_id))
WITH CHECK (
  public.is_party_member(auth.uid(), party_id)
  AND created_by = auth.uid()
);
