
-- Create gm_guide_presets table
CREATE TABLE public.gm_guide_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  guide_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gm_guide_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as gm_guides)
CREATE POLICY "Users can view their own presets"
  ON public.gm_guide_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own presets"
  ON public.gm_guide_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets"
  ON public.gm_guide_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
  ON public.gm_guide_presets FOR DELETE
  USING (auth.uid() = user_id);
