ALTER TABLE public.party_message_audio ADD COLUMN IF NOT EXISTS part text NOT NULL DEFAULT 'story';
ALTER TABLE public.party_message_audio DROP CONSTRAINT IF EXISTS party_message_audio_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS party_message_audio_message_part_key ON public.party_message_audio (message_id, part);