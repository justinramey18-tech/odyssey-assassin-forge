CREATE POLICY "Party members can update message audio"
ON public.party_message_audio
FOR UPDATE
TO authenticated
USING (is_party_member(auth.uid(), party_id))
WITH CHECK (is_party_member(auth.uid(), party_id) AND created_by = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_message_audio TO authenticated;
GRANT ALL ON public.party_message_audio TO service_role;