CREATE TABLE public.party_location_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id),
  map_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('map','location')),
  location_id text,
  name text NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 120),
  content text NOT NULL CHECK (char_length(content) <= 30000),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_location_guides_scope_location CHECK (
    (scope = 'map' AND location_id IS NULL)
    OR (scope = 'location' AND location_id IS NOT NULL AND btrim(location_id) <> '' AND char_length(location_id) <= 200)
  )
);
COMMENT ON COLUMN public.party_location_guides.map_id IS 'Logical link to a map node id inside the campaign atlas JSON envelope; no map table exists.';
CREATE UNIQUE INDEX party_location_guides_one_map_guide ON public.party_location_guides (party_id, map_id) WHERE scope = 'map';
CREATE UNIQUE INDEX party_location_guides_one_location_guide ON public.party_location_guides (party_id, map_id, location_id) WHERE scope = 'location';

ALTER TABLE public.party_location_guides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_location_guides FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_location_guides TO authenticated;
GRANT ALL ON public.party_location_guides TO service_role;

CREATE TRIGGER party_location_guides_updated_at BEFORE UPDATE ON public.party_location_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_read_party_location_guides(_party_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = _party_id AND (
      p.created_by = auth.uid()
      OR (p.is_active AND EXISTS (
        SELECT 1 FROM public.party_shared_state c
        WHERE c.party_id = p.id AND c.user_id = p.created_by AND c.state_type = 'co_hosts'
          AND jsonb_typeof(c.state_data->'userIds') = 'array'
          AND c.state_data->'userIds' ? auth.uid()::text))
    ))
$$;
REVOKE ALL ON FUNCTION public.can_read_party_location_guides(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_party_location_guides(uuid) TO authenticated, service_role;

CREATE POLICY "Host or exact-party co-host reads location guides" ON public.party_location_guides
  FOR SELECT TO authenticated USING (public.can_read_party_location_guides(party_id));
CREATE POLICY "Original host inserts location guides" ON public.party_location_guides
  FOR INSERT TO authenticated WITH CHECK (public.is_party_host(auth.uid(), party_id));
CREATE POLICY "Original host updates location guides" ON public.party_location_guides
  FOR UPDATE TO authenticated USING (public.is_party_host(auth.uid(), party_id)) WITH CHECK (public.is_party_host(auth.uid(), party_id));
CREATE POLICY "Original host deletes location guides" ON public.party_location_guides
  FOR DELETE TO authenticated USING (public.is_party_host(auth.uid(), party_id));

-- Envelope validation (shape only; client validates map contents)
CREATE OR REPLACE FUNCTION public.campaign_atlas_is_envelope(_d jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT jsonb_typeof(_d) = 'object' AND _d->>'format' = 'odyssey-campaign-atlas'
$$;

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
  IF rate NOT IN (1,5,15,60) THEN RAISE EXCEPTION 'Invalid time compression' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_d->'maps') <> 'array' OR jsonb_array_length(_d->'maps') = 0 THEN RAISE EXCEPTION 'Atlas needs maps' USING ERRCODE='22023'; END IF;
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
REVOKE ALL ON FUNCTION public.campaign_atlas_validate(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_atlas_validate(jsonb) TO authenticated, service_role;

-- Guard: once a campaign_map row holds an atlas, it can only be replaced by a newer atlas.
CREATE OR REPLACE FUNCTION public.guard_campaign_atlas_row()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF public.campaign_atlas_is_envelope(OLD.state_data) THEN
    IF NOT public.campaign_atlas_is_envelope(NEW.state_data) THEN
      RAISE EXCEPTION 'Nested campaign maps cannot be overwritten by an older map format' USING ERRCODE='40001';
    END IF;
    IF coalesce((NEW.state_data->>'revision')::numeric, -1) <= coalesce((OLD.state_data->>'revision')::numeric, -1) THEN
      RAISE EXCEPTION 'Stale campaign atlas write' USING ERRCODE='40001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_campaign_atlas_row BEFORE UPDATE ON public.party_shared_state
  FOR EACH ROW WHEN (OLD.state_type = 'campaign_map') EXECUTE FUNCTION public.guard_campaign_atlas_row();

-- Host-only compare-and-set write of the campaign_map atlas row.
CREATE OR REPLACE FUNCTION public.write_campaign_atlas(_party_id uuid, _envelope jsonb, _expected_updated_at timestamptz)
RETURNS TABLE(id uuid, state_data jsonb, updated_at timestamptz, server_time timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  cur public.party_shared_state%ROWTYPE;
  persisted numeric; next_rev numeric; env jsonb;
BEGIN
  IF uid IS NULL OR NOT public.is_party_host(uid, _party_id) THEN
    RAISE EXCEPTION 'Only the original host can save the campaign map' USING ERRCODE='42501';
  END IF;
  PERFORM public.campaign_atlas_validate(_envelope);
  IF (_envelope->>'sourcePartyId')::uuid <> _party_id THEN
    RAISE EXCEPTION 'Atlas belongs to a different party' USING ERRCODE='22023';
  END IF;

  SELECT * INTO cur FROM public.party_shared_state s
    WHERE s.party_id = _party_id AND s.user_id = uid AND s.state_type = 'campaign_map' FOR UPDATE;

  IF NOT FOUND THEN
    IF _expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Campaign map changed; reload first' USING ERRCODE='40001'; END IF;
    persisted := -1;
  ELSE
    IF _expected_updated_at IS NULL OR cur.updated_at <> _expected_updated_at THEN
      RAISE EXCEPTION 'Campaign map changed; reload first' USING ERRCODE='40001';
    END IF;
    persisted := CASE WHEN public.campaign_atlas_is_envelope(cur.state_data)
                      THEN coalesce((cur.state_data->>'revision')::numeric, -1) ELSE -1 END;
  END IF;

  IF (_envelope->>'revision')::numeric <> greatest(persisted, 0) THEN
    RAISE EXCEPTION 'Atlas revision does not match the saved map' USING ERRCODE='40001';
  END IF;
  next_rev := persisted + 1;
  env := jsonb_set(jsonb_set(_envelope, '{revision}', to_jsonb(next_rev)), '{sourcePartyId}', to_jsonb(_party_id::text));

  IF NOT FOUND THEN
    INSERT INTO public.party_shared_state AS s (party_id, user_id, state_type, state_data)
      VALUES (_party_id, uid, 'campaign_map', env)
      ON CONFLICT (party_id, user_id, state_type) DO NOTHING
      RETURNING s.id, s.state_data, s.updated_at INTO id, state_data, updated_at;
    IF id IS NULL THEN RAISE EXCEPTION 'Campaign map was created elsewhere; reload first' USING ERRCODE='40001'; END IF;
  ELSE
    UPDATE public.party_shared_state s SET state_data = env
      WHERE s.id = cur.id
      RETURNING s.id, s.state_data, s.updated_at INTO id, state_data, updated_at;
  END IF;
  server_time := now();
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.write_campaign_atlas(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_campaign_atlas(uuid, jsonb, timestamptz) TO authenticated, service_role;