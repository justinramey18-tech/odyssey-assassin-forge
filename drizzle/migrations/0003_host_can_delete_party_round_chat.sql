CREATE POLICY "Party host can delete any round chat"
ON public.party_round_chat FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parties p
  WHERE p.id = party_round_chat.party_id
    AND p.created_by = auth.uid()
));