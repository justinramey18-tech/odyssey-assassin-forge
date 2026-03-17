-- Add audio_url column to party_messages for voice messages
ALTER TABLE public.party_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Create storage bucket for chat audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('party-chat-audio', 'party-chat-audio', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Authenticated users can upload chat audio
CREATE POLICY "Authenticated users can upload chat audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'party-chat-audio');

-- RLS policy: Anyone can read chat audio (public bucket)
CREATE POLICY "Anyone can read chat audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'party-chat-audio');