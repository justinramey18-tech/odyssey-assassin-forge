CREATE OR REPLACE FUNCTION public.campaign_atlas_validate(_d jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  m jsonb; ids text[] := '{}'; rate numeric;
BEGIN
  IF NOT public.campaign_atlas_is_envelope(_d) THEN RAISE EXCEPTION 'Not a campaign atlas' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'version') <> 'number' OR (_d->>'version')::numeric <> 2 THEN RAISE EXCEPTION 'Unsupported atlas version' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'revision') <> 'number' OR (_d->>'revision')::numeric < 0 OR (_d->>'revision')::numeric <> trunc((_d->>'revision')::numeric) THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
  IF coalesce(_d->>'sourcePartyId','') !~ uuid_re OR coalesce(_d->>'rootMapId','') !~ uuid_re OR coalesce(_d->>'activeMapId','') !~ uuid_re THEN RAISE EXCEPTION 'Invalid atlas ids' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'campaignMinute') <> 'number' OR (_d->>'campaignMinute')::numeric < 0 THEN RAISE EXCEPTION 'Invalid campaign minute' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'realMinutesPerGameHour') <> 'number' THEN RAISE EXCEPTION 'Invalid time compression' USING ERRCODE='22023'; END IF;
  rate := (_d->>'realMinutesPerGameHour')::numeric;
  IF rate < 0.25 OR rate > 240 THEN RAISE EXCEPTION 'Invalid time compression' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'maps') <> 'array' OR jsonb_array_length(_d->'maps') = 0 OR jsonb_array_length(_d->'maps') > 512 THEN RAISE EXCEPTION 'Atlas needs 1 to 512 maps' USING ERRCODE='22023'; END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(_d->'maps') LOOP
    IF jsonb_typeof(m) <> 'object' OR coalesce(m->>'id','') !~ uuid_re THEN RAISE EXCEPTION 'Invalid map id' USING ERRCODE='22023'; END IF;
    IF (m->>'id') = ANY(ids) THEN RAISE EXCEPTION 'Duplicate map id' USING ERRCODE='22023'; END IF;
    ids := ids || (m->>'id');
    IF jsonb_typeof(m->'name') <> 'string' THEN RAISE EXCEPTION 'Invalid map name' USING ERRCODE='22023'; END IF;
    IF NOT (jsonb_typeof(m->'parentMapId') = 'null' OR coalesce(m->>'parentMapId','') ~ uuid_re) THEN RAISE EXCEPTION 'Invalid parent map' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(m->'parentLocationId') NOT IN ('null','string') OR jsonb_typeof(m->'entryLocationId') NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid map links' USING ERRCODE='22023'; END IF;
    IF coalesce(m->>'navigationMode','') NOT IN ('regional','local') THEN RAISE EXCEPTION 'Invalid navigation mode' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(m->'state') <> 'object' THEN RAISE EXCEPTION 'Invalid map state' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF NOT ((_d->>'rootMapId') = ANY(ids)) OR NOT ((_d->>'activeMapId') = ANY(ids)) THEN RAISE EXCEPTION 'Root or active map missing' USING ERRCODE='22023'; END IF;
END $$;