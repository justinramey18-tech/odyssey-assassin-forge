
-- Create GM guides table for cloud persistence
CREATE TABLE public.gm_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Guide',
  content TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gm_guides ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own guides
CREATE POLICY "Users can view their own guides"
ON public.gm_guides FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guides"
ON public.gm_guides FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guides"
ON public.gm_guides FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guides"
ON public.gm_guides FOR DELETE
USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_gm_guides_updated_at
BEFORE UPDATE ON public.gm_guides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
