
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS campaign_type text;

-- Backfill from campaign summary stored in party_shared_state (state_type = 'dm_session').
UPDATE public.parties p
SET campaign_type = 'empyrean'
WHERE p.campaign_type IS NULL
  AND EXISTS (
    SELECT 1 FROM public.party_shared_state s
    WHERE s.party_id = p.id
      AND s.state_type = 'dm_session'
      AND (
        lower(coalesce(s.state_data->>'campaignSummary', '')) ~ '(basgiath|navarre|empyrean|threshing|venin|signet|tyrrendor|aretia|wyvern|gryphon|fourth wing|dragon rider)'
        OR lower(coalesce(s.state_data->>'campaignType', '')) = 'empyrean'
      )
  );

UPDATE public.parties SET campaign_type = 'dnd' WHERE campaign_type IS NULL;

ALTER TABLE public.parties
  ALTER COLUMN campaign_type SET DEFAULT 'dnd';

CREATE INDEX IF NOT EXISTS idx_parties_campaign_type ON public.parties (campaign_type);
