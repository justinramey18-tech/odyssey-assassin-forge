
-- Drop the incorrect FK that references party_messages
ALTER TABLE public.party_message_reactions
  DROP CONSTRAINT party_message_reactions_message_id_fkey;

-- Add the correct FK that references party_dm_messages
ALTER TABLE public.party_message_reactions
  ADD CONSTRAINT party_message_reactions_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES public.party_dm_messages(id) ON DELETE CASCADE;
