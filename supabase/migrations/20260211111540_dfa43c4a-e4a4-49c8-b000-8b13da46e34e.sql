-- Add updated_at column to party_messages for edit tracking
ALTER TABLE public.party_messages 
ADD COLUMN updated_at timestamp with time zone DEFAULT NULL;

-- Allow users to update their own messages (edit)
CREATE POLICY "Users can update their own messages"
ON public.party_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.party_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Allow party creator to delete any message in their party (moderation)
CREATE POLICY "Party creator can delete any message"
ON public.party_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.parties 
    WHERE id = party_id 
    AND created_by = auth.uid() 
    AND is_active = true
  )
);