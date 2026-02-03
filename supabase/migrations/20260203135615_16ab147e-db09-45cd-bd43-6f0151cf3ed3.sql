-- Create chronicle_sessions table for hybrid session history storage
CREATE TABLE public.chronicle_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_name TEXT NOT NULL DEFAULT 'Imported Session',
  input_preview TEXT NOT NULL, -- First 200 chars of input
  input_hash TEXT NOT NULL, -- Hash to detect duplicates
  parse_mode TEXT NOT NULL DEFAULT 'offline',
  parsed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Applied changes summary
  changes_applied INTEGER NOT NULL DEFAULT 0,
  xp_total INTEGER NOT NULL DEFAULT 0,
  gold_gained INTEGER NOT NULL DEFAULT 0,
  gold_spent INTEGER NOT NULL DEFAULT 0,
  items_acquired INTEGER NOT NULL DEFAULT 0,
  items_consumed INTEGER NOT NULL DEFAULT 0,
  achievements_triggered INTEGER NOT NULL DEFAULT 0,
  
  -- Combat analytics
  damage_dealt INTEGER NOT NULL DEFAULT 0,
  damage_taken INTEGER NOT NULL DEFAULT 0,
  healing_received INTEGER NOT NULL DEFAULT 0,
  critical_hits INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  
  -- Enhanced detection analytics
  spell_slots_used JSONB DEFAULT '{}', -- {"1": 2, "2": 1} etc
  death_saves JSONB DEFAULT '{}', -- {"successes": 2, "failures": 1}
  rests_taken JSONB DEFAULT '{}', -- {"short": 1, "long": 1}
  combat_rounds INTEGER NOT NULL DEFAULT 0,
  conditions_applied TEXT[] DEFAULT '{}',
  
  -- Full parse data for undo/replay
  full_parse_result JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chronicle_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view their own chronicle sessions"
ON public.chronicle_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create their own chronicle sessions"
ON public.chronicle_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own chronicle sessions"
ON public.chronicle_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_chronicle_sessions_user_id ON public.chronicle_sessions(user_id);
CREATE INDEX idx_chronicle_sessions_parsed_at ON public.chronicle_sessions(parsed_at DESC);

-- Create campaign_analytics table for aggregate stats
CREATE TABLE public.campaign_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- Lifetime combat stats
  total_damage_dealt INTEGER NOT NULL DEFAULT 0,
  total_damage_taken INTEGER NOT NULL DEFAULT 0,
  total_healing_received INTEGER NOT NULL DEFAULT 0,
  total_critical_hits INTEGER NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  total_deaths INTEGER NOT NULL DEFAULT 0,
  
  -- Lifetime resource stats
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  total_gold_earned INTEGER NOT NULL DEFAULT 0,
  total_gold_spent INTEGER NOT NULL DEFAULT 0,
  total_items_acquired INTEGER NOT NULL DEFAULT 0,
  total_items_consumed INTEGER NOT NULL DEFAULT 0,
  total_sessions_imported INTEGER NOT NULL DEFAULT 0,
  
  -- Rest tracking
  total_short_rests INTEGER NOT NULL DEFAULT 0,
  total_long_rests INTEGER NOT NULL DEFAULT 0,
  
  -- Spell tracking
  total_spells_cast INTEGER NOT NULL DEFAULT 0,
  spell_slots_used_by_level JSONB DEFAULT '{}',
  
  -- Death save tracking
  death_save_successes INTEGER NOT NULL DEFAULT 0,
  death_save_failures INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own analytics
CREATE POLICY "Users can view their own campaign analytics"
ON public.campaign_analytics
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own analytics
CREATE POLICY "Users can create their own campaign analytics"
ON public.campaign_analytics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own analytics
CREATE POLICY "Users can update their own campaign analytics"
ON public.campaign_analytics
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_campaign_analytics_user_id ON public.campaign_analytics(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_campaign_analytics_updated_at
BEFORE UPDATE ON public.campaign_analytics
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();