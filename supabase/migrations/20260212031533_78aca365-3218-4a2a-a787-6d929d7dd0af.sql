
-- Create party_dm_messages table
CREATE TABLE public.party_dm_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  sender_user_id uuid,
  sender_name text NOT NULL DEFAULT 'DM',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.party_dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read dm messages"
  ON public.party_dm_messages FOR SELECT
  USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can insert dm messages"
  ON public.party_dm_messages FOR INSERT
  WITH CHECK (is_party_member(auth.uid(), party_id));

CREATE INDEX idx_party_dm_messages_party_id ON public.party_dm_messages(party_id, created_at);

-- Create party_dm_prompts table
CREATE TABLE public.party_dm_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text NOT NULL,
  prompt text NOT NULL,
  is_ready boolean NOT NULL DEFAULT false,
  round_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.party_dm_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read dm prompts"
  ON public.party_dm_prompts FOR SELECT
  USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can insert own prompts"
  ON public.party_dm_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can update own prompts"
  ON public.party_dm_prompts FOR UPDATE
  USING (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Host can delete prompts"
  ON public.party_dm_prompts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.parties
    WHERE parties.id = party_dm_prompts.party_id
    AND parties.created_by = auth.uid()
  ));

CREATE POLICY "Members can delete own prompts"
  ON public.party_dm_prompts FOR DELETE
  USING (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE INDEX idx_party_dm_prompts_party_round ON public.party_dm_prompts(party_id, round_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_dm_prompts;

-- Add dm_session RLS policies for party_shared_state
CREATE POLICY "Members can update dm_session shared state"
  ON public.party_shared_state FOR UPDATE
  USING (state_type = 'dm_session' AND is_party_member(auth.uid(), party_id))
  WITH CHECK (state_type = 'dm_session' AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can delete dm_session shared state"
  ON public.party_shared_state FOR DELETE
  USING (state_type = 'dm_session' AND is_party_member(auth.uid(), party_id));
