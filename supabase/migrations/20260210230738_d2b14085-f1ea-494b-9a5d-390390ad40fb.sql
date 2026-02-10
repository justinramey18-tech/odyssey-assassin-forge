
-- Feature 1: Party Chat
CREATE TABLE public.party_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read messages"
ON public.party_messages FOR SELECT
USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can send messages"
ON public.party_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_party_member(auth.uid(), party_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;

-- Feature 4: Party Combat Log
CREATE TABLE public.party_combat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  character_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.party_combat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read combat log"
ON public.party_combat_log FOR SELECT
USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can insert combat log"
ON public.party_combat_log FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_party_member(auth.uid(), party_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.party_combat_log;
