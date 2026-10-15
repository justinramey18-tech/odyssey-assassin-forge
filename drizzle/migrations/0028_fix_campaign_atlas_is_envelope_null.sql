-- Fix: for a legacy map (no "format" key) the check returned NULL instead of false, so
-- "NOT is_envelope(x)" was also NULL. That made the connector installer treat legacy maps as
-- atlases, and let the atlas guard miss a legacy overwrite. Same answer for every real atlas.
CREATE OR REPLACE FUNCTION public.campaign_atlas_is_envelope(_d jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_typeof(_d) = 'object' AND _d->>'format' = 'odyssey-campaign-atlas', false)
$$;
