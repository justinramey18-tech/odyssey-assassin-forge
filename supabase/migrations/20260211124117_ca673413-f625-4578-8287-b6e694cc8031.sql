
-- Reactions table for party chat messages
CREATE TABLE public.party_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.party_messages(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.party_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read reactions"
ON public.party_message_reactions FOR SELECT
USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can add reactions"
ON public.party_message_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Users can remove own reactions"
ON public.party_message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_message_reactions;
