
CREATE TABLE public.party_director_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  category TEXT CHECK (category IN ('question','private_action','public_action','escalated','rejected')),
  content TEXT NOT NULL,
  overridden BOOLEAN NOT NULL DEFAULT false,
  consumed_by_dm BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdm_party_user ON public.party_director_messages(party_id, user_id, created_at);
CREATE INDEX idx_pdm_unconsumed ON public.party_director_messages(party_id, consumed_by_dm) WHERE consumed_by_dm = false;

ALTER TABLE public.party_director_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own director messages"
  ON public.party_director_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts view all director messages in their parties"
  ON public.party_director_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_director_messages.party_id AND p.created_by = auth.uid()));

CREATE POLICY "Users insert their own director messages"
  ON public.party_director_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts insert director messages in their parties"
  ON public.party_director_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_director_messages.party_id AND p.created_by = auth.uid()));

CREATE POLICY "Hosts update director messages in their parties"
  ON public.party_director_messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_director_messages.party_id AND p.created_by = auth.uid()));

CREATE POLICY "Users update their own director messages"
  ON public.party_director_messages FOR UPDATE
  USING (auth.uid() = user_id);


CREATE TABLE public.party_director_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  request_text TEXT NOT NULL,
  ai_rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  host_comment TEXT,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_pde_party_status ON public.party_director_escalations(party_id, status, created_at);

ALTER TABLE public.party_director_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own escalations"
  ON public.party_director_escalations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts view all escalations in their parties"
  ON public.party_director_escalations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_director_escalations.party_id AND p.created_by = auth.uid()));

CREATE POLICY "Users insert their own escalations"
  ON public.party_director_escalations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts update escalations in their parties"
  ON public.party_director_escalations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_director_escalations.party_id AND p.created_by = auth.uid()));

ALTER TABLE public.party_director_messages REPLICA IDENTITY FULL;
ALTER TABLE public.party_director_escalations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_director_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_director_escalations;
