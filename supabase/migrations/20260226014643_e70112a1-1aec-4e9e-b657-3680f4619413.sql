
-- Add team column to party_dm_messages for split party feature
ALTER TABLE public.party_dm_messages ADD COLUMN team text DEFAULT NULL;

-- Add team column to party_dm_prompts for split party feature
ALTER TABLE public.party_dm_prompts ADD COLUMN team text DEFAULT NULL;
