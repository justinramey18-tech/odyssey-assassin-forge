
ALTER TABLE public.gm_guides ADD COLUMN mode TEXT NOT NULL DEFAULT 'solo';
ALTER TABLE public.ai_dm_campaigns ADD COLUMN mode TEXT NOT NULL DEFAULT 'solo';
CREATE INDEX idx_gm_guides_user_mode ON public.gm_guides (user_id, mode);
CREATE INDEX idx_ai_dm_campaigns_user_mode ON public.ai_dm_campaigns (user_id, mode);
