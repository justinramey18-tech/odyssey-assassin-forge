CREATE TABLE public.party_message_audio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.party_dm_messages(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  voice_id text,
  provider text NOT NULL DEFAULT 'speechify',
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_message_audio TO authenticated;
GRANT ALL ON public.party_message_audio TO service_role;

ALTER TABLE public.party_message_audio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read message audio"
ON public.party_message_audio FOR SELECT TO authenticated
USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can create message audio"
ON public.party_message_audio FOR INSERT TO authenticated
WITH CHECK (public.is_party_member(auth.uid(), party_id) AND created_by = auth.uid());

CREATE POLICY "Hosts and co-hosts can delete message audio"
ON public.party_message_audio FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parties p
  WHERE p.id = party_message_audio.party_id
    AND (p.created_by = auth.uid() OR public.is_co_host_of(p.created_by))
));

CREATE INDEX idx_party_message_audio_party ON public.party_message_audio(party_id);

ALTER TABLE public.party_message_audio REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_message_audio;