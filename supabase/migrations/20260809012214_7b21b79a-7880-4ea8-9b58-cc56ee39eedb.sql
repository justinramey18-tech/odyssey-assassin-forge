CREATE TABLE public.party_round_chat (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text NOT NULL DEFAULT 'Player',
  content text NOT NULL,
  in_character boolean NOT NULL DEFAULT true,
  round_id uuid NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_round_chat TO authenticated;
GRANT ALL ON public.party_round_chat TO service_role;

ALTER TABLE public.party_round_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read round chat"
ON public.party_round_chat FOR SELECT TO authenticated
USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can post their own round chat"
ON public.party_round_chat FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can update round chat in their party"
ON public.party_round_chat FOR UPDATE TO authenticated
USING (public.is_party_member(auth.uid(), party_id))
WITH CHECK (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can delete their own round chat"
ON public.party_round_chat FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_party_round_chat_party_round ON public.party_round_chat(party_id, round_id, created_at);

CREATE TABLE public.party_round_chat_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.party_round_chat(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT 'Player',
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.party_round_chat_reactions TO authenticated;
GRANT ALL ON public.party_round_chat_reactions TO service_role;

ALTER TABLE public.party_round_chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read round chat reactions"
ON public.party_round_chat_reactions FOR SELECT TO authenticated
USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can add their own round chat reactions"
ON public.party_round_chat_reactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can remove their own round chat reactions"
ON public.party_round_chat_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.party_round_chat REPLICA IDENTITY FULL;
ALTER TABLE public.party_round_chat_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_round_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_round_chat_reactions;