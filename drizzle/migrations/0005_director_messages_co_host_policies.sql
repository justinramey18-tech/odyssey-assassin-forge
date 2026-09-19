-- Players may clear their own Director thread
CREATE POLICY "Users delete their own director messages"
  ON public.party_director_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Co-hosts get the same read/update rights as the host so DM generation run by a co-host
-- can see private actions and mark them consumed
CREATE POLICY "Co-hosts view director messages in their parties"
  ON public.party_director_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_director_messages.party_id
      AND public.is_co_host_of(p.created_by)
  ));

CREATE POLICY "Co-hosts update director messages in their parties"
  ON public.party_director_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_director_messages.party_id
      AND public.is_co_host_of(p.created_by)
  ));

CREATE POLICY "Co-hosts view escalations in their parties"
  ON public.party_director_escalations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_director_escalations.party_id
      AND public.is_co_host_of(p.created_by)
  ));

CREATE POLICY "Co-hosts update escalations in their parties"
  ON public.party_director_escalations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_director_escalations.party_id
      AND public.is_co_host_of(p.created_by)
  ));