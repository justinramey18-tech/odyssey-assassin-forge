
-- Allow party creator to update any message's is_pinned field
CREATE POLICY "Party creator can update pin status"
ON public.party_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM parties
    WHERE parties.id = party_messages.party_id
    AND parties.created_by = auth.uid()
    AND parties.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM parties
    WHERE parties.id = party_messages.party_id
    AND parties.created_by = auth.uid()
    AND parties.is_active = true
  )
);
