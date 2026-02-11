
-- Add reply_to_id for quote/reply functionality
ALTER TABLE public.party_messages 
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.party_messages(id) ON DELETE SET NULL;

-- Add image_url for image attachments
ALTER TABLE public.party_messages 
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add is_pinned for pinned messages
ALTER TABLE public.party_messages 
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Index for fast pinned message lookups
CREATE INDEX IF NOT EXISTS idx_party_messages_pinned ON public.party_messages(party_id) WHERE is_pinned = true;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('party-chat-images', 'party-chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: party members can upload chat images
CREATE POLICY "Party members can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'party-chat-images'
  AND auth.uid() IS NOT NULL
);

-- RLS: anyone can view chat images (public bucket)
CREATE POLICY "Chat images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'party-chat-images');

-- RLS: users can delete their own chat images
CREATE POLICY "Users can delete own chat images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'party-chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
