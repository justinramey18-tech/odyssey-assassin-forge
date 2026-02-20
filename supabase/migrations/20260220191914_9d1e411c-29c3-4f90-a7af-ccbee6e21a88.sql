-- Create dm_game_state table for persistent solo AI DM game state
-- This persists HP, gold, inventory, quest flags, and memory anchors
-- even if chat history is cleared.

CREATE TABLE public.dm_game_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.ai_dm_campaigns(id) ON DELETE SET NULL,
  
  -- Core vitals (snapshot of character at session points)
  current_hp integer NOT NULL DEFAULT 0,
  max_hp integer NOT NULL DEFAULT 0,
  gold integer NOT NULL DEFAULT 0,
  
  -- Inventory items acquired during this campaign (not equipment from character sheet)
  inventory jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Quest flags: { quest_id/key: status ('active'|'completed'|'failed'), notes }
  quest_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Memory anchors: persistent world facts extracted from DM narrative
  -- Array of { id, category, key, value, turn, created_at }
  memory_anchors jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Session metadata
  session_turn integer NOT NULL DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One game state per campaign (or one "default" per user with no campaign)
-- Using a unique index to allow upsert on (user_id, campaign_id)
CREATE UNIQUE INDEX dm_game_state_user_campaign_idx 
  ON public.dm_game_state (user_id, campaign_id) 
  WHERE campaign_id IS NOT NULL;

CREATE UNIQUE INDEX dm_game_state_user_no_campaign_idx 
  ON public.dm_game_state (user_id) 
  WHERE campaign_id IS NULL;

-- Enable RLS
ALTER TABLE public.dm_game_state ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own game state
CREATE POLICY "Users can view their own game state"
  ON public.dm_game_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game state"
  ON public.dm_game_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game state"
  ON public.dm_game_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own game state"
  ON public.dm_game_state FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE TRIGGER dm_game_state_updated_at
  BEFORE UPDATE ON public.dm_game_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();