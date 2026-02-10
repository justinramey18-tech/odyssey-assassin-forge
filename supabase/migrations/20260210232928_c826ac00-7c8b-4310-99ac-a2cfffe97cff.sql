-- Allow any party member to update map_markers shared state rows
-- (needed because multiple users place markers on the same shared grid)
CREATE POLICY "Members can update map markers shared state"
  ON public.party_shared_state FOR UPDATE
  USING (state_type = 'map_markers' AND is_party_member(auth.uid(), party_id))
  WITH CHECK (state_type = 'map_markers' AND is_party_member(auth.uid(), party_id));

-- Allow any party member to delete vote/map_markers shared state rows
-- (needed so a new vote creator can clean up old vote rows from a different creator)
CREATE POLICY "Members can delete vote shared state"
  ON public.party_shared_state FOR DELETE
  USING (state_type = 'vote' AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can delete map markers shared state"
  ON public.party_shared_state FOR DELETE
  USING (state_type = 'map_markers' AND is_party_member(auth.uid(), party_id));
