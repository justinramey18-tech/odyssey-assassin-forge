-- Allow any party member to update vote shared state rows (needed for castVote from non-creators)
CREATE POLICY "Members can update vote shared state"
  ON public.party_shared_state FOR UPDATE
  USING (state_type = 'vote' AND is_party_member(auth.uid(), party_id))
  WITH CHECK (state_type = 'vote' AND is_party_member(auth.uid(), party_id));
