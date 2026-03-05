
-- Co-hosts can update party DM messages (same as creator)
CREATE POLICY "Co-hosts can update dm messages"
ON public.party_dm_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM parties
    WHERE parties.id = party_dm_messages.party_id
    AND public.is_co_host_of(parties.created_by)
  )
);

-- Co-hosts can delete party DM messages (same as creator)
CREATE POLICY "Co-hosts can delete dm messages"
ON public.party_dm_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM parties
    WHERE parties.id = party_dm_messages.party_id
    AND public.is_co_host_of(parties.created_by)
  )
);
