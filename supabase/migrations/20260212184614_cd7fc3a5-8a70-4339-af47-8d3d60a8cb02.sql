
-- Host can edit messages
CREATE POLICY "Party creator can update dm messages"
  ON public.party_dm_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.parties
      WHERE id = party_dm_messages.party_id AND created_by = auth.uid()
    )
  );

-- Host can delete messages
CREATE POLICY "Party creator can delete dm messages"
  ON public.party_dm_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.parties
      WHERE id = party_dm_messages.party_id AND created_by = auth.uid()
    )
  );

-- Full row data on DELETE events for realtime
ALTER TABLE public.party_dm_messages REPLICA IDENTITY FULL;
