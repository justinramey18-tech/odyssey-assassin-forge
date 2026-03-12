CREATE POLICY "Members can update dm_poll shared state"
  ON public.party_shared_state FOR UPDATE
  USING (state_type = 'dm_poll' AND is_party_member(auth.uid(), party_id))
  WITH CHECK (state_type = 'dm_poll' AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can delete dm_poll shared state"
  ON public.party_shared_state FOR DELETE
  USING (state_type = 'dm_poll' AND is_party_member(auth.uid(), party_id));