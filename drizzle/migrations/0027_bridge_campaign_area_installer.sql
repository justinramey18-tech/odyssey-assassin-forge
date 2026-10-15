-- Connector area installer (service role only). See AGENTS.md atlas rule.

CREATE TABLE public.bridge_campaign_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  party_id uuid NOT NULL,
  actor text NOT NULL CHECK (btrim(actor) <> '' AND char_length(actor) <= 200),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  input_digest text NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
  host_user_id uuid NOT NULL,
  state_row_id uuid NOT NULL,
  converted_legacy boolean NOT NULL,
  original_state_data jsonb NOT NULL,
  original_updated_at timestamptz NOT NULL,
  installed_map_id uuid NOT NULL,
  parent_map_id uuid NOT NULL,
  parent_location_id text NOT NULL,
  guide_ids uuid[] NOT NULL DEFAULT '{}',
  new_revision integer NOT NULL,
  new_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bridge_campaign_installs_one_request UNIQUE (party_id, actor, request_id)
);
COMMENT ON TABLE public.bridge_campaign_installs IS 'Private receipts + pre-install snapshots for connector area installs. Service role only; never player-readable.';
REVOKE ALL ON public.bridge_campaign_installs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bridge_campaign_installs TO service_role;
ALTER TABLE public.bridge_campaign_installs ENABLE ROW LEVEL SECURITY;

-- Full atlas validation: envelope shape + graph invariants. Rejects, never repairs.
CREATE OR REPLACE FUNCTION public.bridge_atlas_validate_full(_a jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  m jsonb; st jsonb; l jsonb; r jsonb; pt jsonb; x jsonb;
  root_id text; active_id text; nmaps int;
  parents jsonb := '{}'; attach text[] := '{}';
  loc_ids text[]; route_ids text[]; locparent jsonb; cur text; steps int; k text; nm text;
BEGIN
  PERFORM public.campaign_atlas_validate(_a);
  root_id := _a->>'rootMapId'; active_id := _a->>'activeMapId';
  nmaps := jsonb_array_length(_a->'maps');
  IF nmaps > 512 THEN RAISE EXCEPTION 'Too many maps (512 at most)' USING ERRCODE='22023'; END IF;
  IF octet_length((_a->'maps')::text) > 8388608 THEN RAISE EXCEPTION 'Map collection over 8 MiB' USING ERRCODE='22023'; END IF;
  SELECT jsonb_object_agg(y->>'id', y->'parentMapId') INTO parents FROM jsonb_array_elements(_a->'maps') y;

  FOR m IN SELECT * FROM jsonb_array_elements(_a->'maps') LOOP
    st := m->'state'; nm := m->>'name';
    IF st ? 'version' AND st->'version' <> '1'::jsonb THEN RAISE EXCEPTION 'Map "%" uses an unknown geography version', nm USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(st->'locations') IS DISTINCT FROM 'array' OR jsonb_typeof(st->'routes') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Map "%" has malformed places or roads', nm USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(st->'locations') > 500 THEN RAISE EXCEPTION 'Map "%" has over 500 places', nm USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(st->'routes') > 1000 THEN RAISE EXCEPTION 'Map "%" has over 1000 roads', nm USING ERRCODE='22023'; END IF;
    FOREACH k IN ARRAY ARRAY['campaignMinute','realMinutesPerGameHour','imageNaturalWidth','imageNaturalHeight'] LOOP
      IF coalesce(jsonb_typeof(st->k),'null') NOT IN ('null','number') THEN RAISE EXCEPTION 'Map "%" has a non-numeric %', nm, k USING ERRCODE='22023'; END IF;
    END LOOP;

    loc_ids := '{}'; locparent := '{}';
    FOR l IN SELECT * FROM jsonb_array_elements(st->'locations') LOOP
      IF jsonb_typeof(l) <> 'object' OR jsonb_typeof(l->'id') IS DISTINCT FROM 'string' OR btrim(l->>'id') = '' OR char_length(l->>'id') > 80 THEN
        RAISE EXCEPTION 'Map "%" has a place with an invalid id', nm USING ERRCODE='22023'; END IF;
      IF (l->>'id') = ANY(loc_ids) THEN RAISE EXCEPTION 'Map "%" has two places with the same id', nm USING ERRCODE='22023'; END IF;
      loc_ids := loc_ids || (l->>'id');
      IF jsonb_typeof(l->'name') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Map "%" has a place without a name', nm USING ERRCODE='22023'; END IF;
      IF NOT ((coalesce(jsonb_typeof(l->'x'),'null') = 'null' AND coalesce(jsonb_typeof(l->'y'),'null') = 'null')
           OR (jsonb_typeof(l->'x') = 'number' AND jsonb_typeof(l->'y') = 'number')) THEN
        RAISE EXCEPTION 'Map "%" has a place with invalid coordinates', nm USING ERRCODE='22023'; END IF;
      IF coalesce(jsonb_typeof(l->'parentLocationId'),'null') NOT IN ('null','string') THEN
        RAISE EXCEPTION 'Map "%" has a place with an invalid parent', nm USING ERRCODE='22023'; END IF;
      locparent := locparent || jsonb_build_object(l->>'id', nullif(l->>'parentLocationId',''));
    END LOOP;
    -- location ancestry: parents exist, no loops
    FOREACH k IN ARRAY loc_ids LOOP
      cur := locparent->>k; steps := 0;
      WHILE cur IS NOT NULL LOOP
        IF NOT (cur = ANY(loc_ids)) THEN RAISE EXCEPTION 'Map "%" has a place inside a missing place', nm USING ERRCODE='22023'; END IF;
        steps := steps + 1;
        IF cur = k OR steps > array_length(loc_ids,1) THEN RAISE EXCEPTION 'Map "%" has places inside each other in a loop', nm USING ERRCODE='22023'; END IF;
        cur := locparent->>cur;
      END LOOP;
    END LOOP;

    route_ids := '{}';
    FOR r IN SELECT * FROM jsonb_array_elements(st->'routes') LOOP
      IF jsonb_typeof(r) <> 'object' OR jsonb_typeof(r->'id') IS DISTINCT FROM 'string' OR btrim(r->>'id') = '' OR char_length(r->>'id') > 80 THEN
        RAISE EXCEPTION 'Map "%" has a road with an invalid id', nm USING ERRCODE='22023'; END IF;
      IF (r->>'id') = ANY(route_ids) THEN RAISE EXCEPTION 'Map "%" has two roads with the same id', nm USING ERRCODE='22023'; END IF;
      route_ids := route_ids || (r->>'id');
      IF NOT (coalesce(r->>'fromLocationId','') = ANY(loc_ids)) OR NOT (coalesce(r->>'toLocationId','') = ANY(loc_ids)) OR r->>'fromLocationId' = r->>'toLocationId' THEN
        RAISE EXCEPTION 'Map "%" has a road to a missing place', nm USING ERRCODE='22023'; END IF;
      IF jsonb_typeof(r->'distanceMiles') IS DISTINCT FROM 'number' OR coalesce(jsonb_typeof(r->'terrainFactor'),'number') <> 'number'
         OR coalesce(jsonb_typeof(r->'calibratedDistanceMiles'),'null') NOT IN ('null','number') THEN
        RAISE EXCEPTION 'Map "%" has a road with invalid numbers', nm USING ERRCODE='22023'; END IF;
      IF coalesce(jsonb_typeof(r->'path'),'array') <> 'array' OR jsonb_array_length(coalesce(r->'path','[]')) > 200 THEN
        RAISE EXCEPTION 'Map "%" has a road with an invalid path', nm USING ERRCODE='22023'; END IF;
      FOR pt IN SELECT * FROM jsonb_array_elements(coalesce(r->'path','[]')) LOOP
        IF jsonb_typeof(pt) <> 'object' OR jsonb_typeof(pt->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(pt->'y') IS DISTINCT FROM 'number' THEN
          RAISE EXCEPTION 'Map "%" has a road with invalid coordinates', nm USING ERRCODE='22023'; END IF;
      END LOOP;
    END LOOP;

    IF jsonb_typeof(st->'currentLocationId') = 'string' AND NOT ((st->>'currentLocationId') = ANY(loc_ids)) THEN
      RAISE EXCEPTION 'Map "%" has the party at a missing place', nm USING ERRCODE='22023'; END IF;
    IF coalesce(jsonb_typeof(st->'currentLocationId'),'null') NOT IN ('null','string') THEN
      RAISE EXCEPTION 'Map "%" has an invalid current place', nm USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(m->'entryLocationId') = 'string' AND NOT ((m->>'entryLocationId') = ANY(loc_ids)) THEN
      RAISE EXCEPTION 'Map "%" has an entry point that does not exist', nm USING ERRCODE='22023'; END IF;
    IF coalesce(jsonb_typeof(st->'currentRoutePosition'),'null') <> 'null' THEN
      IF NOT (coalesce(st->'currentRoutePosition'->>'routeId','') = ANY(route_ids)) OR jsonb_typeof(st->'currentRoutePosition'->'progress') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'Map "%" has the party on a missing road', nm USING ERRCODE='22023'; END IF;
    END IF;
    IF coalesce(jsonb_typeof(st->'activeTravel'),'null') <> 'null' OR coalesce(jsonb_typeof(st->'journeyPlan'),'null') <> 'null' THEN
      IF (m->>'id') <> active_id THEN RAISE EXCEPTION 'Map "%" has travel running but the party is not there', nm USING ERRCODE='22023'; END IF;
    END IF;
    IF coalesce(jsonb_typeof(st->'activeTravel'),'null') <> 'null' THEN
      IF NOT (coalesce(st->'activeTravel'->>'routeId','') = ANY(route_ids)) THEN RAISE EXCEPTION 'Map "%" travel uses a missing road', nm USING ERRCODE='22023'; END IF;
      FOR x IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(st->'activeTravel'->'segments') = 'array' THEN st->'activeTravel'->'segments' ELSE '[]' END) LOOP
        IF NOT (coalesce(x->>'routeId','') = ANY(route_ids)) THEN RAISE EXCEPTION 'Map "%" travel uses a missing road', nm USING ERRCODE='22023'; END IF;
      END LOOP;
    END IF;
    IF coalesce(jsonb_typeof(st->'journeyPlan'),'null') <> 'null' THEN
      IF NOT (coalesce(st->'journeyPlan'->>'destinationLocationId','') = ANY(loc_ids)) THEN RAISE EXCEPTION 'Map "%" journey goes to a missing place', nm USING ERRCODE='22023'; END IF;
      FOR x IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(st->'journeyPlan'->'legs') = 'array' THEN st->'journeyPlan'->'legs' ELSE '[]' END) LOOP
        IF NOT (coalesce(x->>'routeId','') = ANY(route_ids)) THEN RAISE EXCEPTION 'Map "%" journey uses a missing road', nm USING ERRCODE='22023'; END IF;
      END LOOP;
    END IF;

    -- attachment + connection to root
    IF (m->>'id') = root_id THEN
      IF jsonb_typeof(m->'parentMapId') <> 'null' OR jsonb_typeof(m->'parentLocationId') <> 'null' THEN
        RAISE EXCEPTION 'The top map cannot have a parent' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
    IF jsonb_typeof(m->'parentMapId') <> 'string' OR jsonb_typeof(m->'parentLocationId') <> 'string' THEN
      RAISE EXCEPTION 'Map "%" is not attached to any map', nm USING ERRCODE='22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_a->'maps') p, jsonb_array_elements(p->'state'->'locations') pl
                   WHERE p->>'id' = m->>'parentMapId' AND pl->>'id' = m->>'parentLocationId') THEN
      RAISE EXCEPTION 'Map "%" is attached to a missing map or place', nm USING ERRCODE='22023'; END IF;
    k := (m->>'parentMapId') || chr(1) || (m->>'parentLocationId');
    IF k = ANY(attach) THEN RAISE EXCEPTION 'Two area maps are attached to the same place' USING ERRCODE='22023'; END IF;
    attach := attach || k;
    cur := m->>'id'; steps := 0;
    WHILE cur IS NOT NULL AND cur <> root_id LOOP
      steps := steps + 1;
      IF steps > nmaps THEN RAISE EXCEPTION 'The maps are attached in a loop' USING ERRCODE='22023'; END IF;
      cur := parents->>cur;
    END LOOP;
    IF cur IS NULL THEN RAISE EXCEPTION 'Map "%" is not connected to the top map', nm USING ERRCODE='22023'; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.bridge_atlas_validate_full(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_atlas_validate_full(jsonb) TO service_role;

-- Location chain (outer → inner) as [{id,name}], inside one map state.
CREATE OR REPLACE FUNCTION public.bridge_atlas_location_chain(_state jsonb, _loc text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE out jsonb := '[]'; cur text := _loc; l jsonb; steps int := 0;
BEGIN
  WHILE cur IS NOT NULL LOOP
    SELECT y INTO l FROM jsonb_array_elements(_state->'locations') y WHERE y->>'id' = cur LIMIT 1;
    IF l IS NULL THEN RAISE EXCEPTION 'Missing place in guide path' USING ERRCODE='22023'; END IF;
    out := jsonb_build_array(jsonb_build_object('id', l->>'id', 'name', l->>'name')) || out;
    steps := steps + 1;
    IF steps > 501 THEN RAISE EXCEPTION 'Place loop in guide path' USING ERRCODE='22023'; END IF;
    cur := nullif(l->>'parentLocationId',''); l := NULL;
  END LOOP;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.bridge_atlas_location_chain(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_atlas_location_chain(jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.bridge_campaign_install_receipt_json(_r public.bridge_campaign_installs, _replayed boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'requestId', _r.request_id, 'partyId', _r.party_id, 'actor', _r.actor,
    'mapId', _r.installed_map_id, 'parentMapId', _r.parent_map_id, 'parentLocationId', _r.parent_location_id,
    'guideIds', to_jsonb(_r.guide_ids), 'guideCount', coalesce(array_length(_r.guide_ids,1),0),
    'revision', _r.new_revision, 'updatedAt', _r.new_updated_at, 'convertedLegacy', _r.converted_legacy,
    'payloadDigest', _r.payload_digest, 'installedAt', _r.created_at, 'replayed', _replayed)
$$;
REVOKE ALL ON FUNCTION public.bridge_campaign_install_receipt_json(public.bridge_campaign_installs, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_campaign_install_receipt_json(public.bridge_campaign_installs, boolean) TO service_role;

/*
  CONTRACT (step 2 calls this with the service role only):

  public.bridge_install_campaign_area(
    _party_id            uuid,         -- party to install into
    _actor               text,         -- verified connector identity (audit only, 1..200 chars)
    _request_id          uuid,         -- idempotency key, unique per (party, actor)
    _expected_host_id    uuid,         -- host the caller read; mismatch = 40001
    _expected_updated_at timestamptz,  -- campaign_map row updated_at the caller read
    _expected_revision   integer,      -- atlas revision read; NULL when _expected_legacy
    _expected_legacy     boolean,      -- true = caller read a legacy v1 map (will be wrapped)
    _parent_map_id       uuid,         -- existing atlas map; NULL only for a legacy root
    _parent_location_id  text,         -- existing place on that map, with no area attached yet
    _area_name           text,         -- 1..120 chars
    _map_state           jsonb,        -- v1 map: https imageUrl (already verified), locations, routes,
                                       -- currentLocationId (becomes entry point), defaultPace.
                                       -- activeTravel / journeyPlan / currentRoutePosition are rejected.
    _guides              jsonb,        -- [] or [{scope:'map'|'location', locationId?, name, content, enabled?}]
    _payload_digest      text          -- bridge-computed sha256 hex of the canonical request
  ) RETURNS jsonb receipt:
    { requestId, partyId, actor, mapId, parentMapId, parentLocationId, guideIds, guideCount,
      revision, updatedAt, convertedLegacy, payloadDigest, installedAt, replayed }

  Errors: 22023 invalid input · P0002 party/map missing · 40001 stale/host changed/format changed ·
          23505 place occupied or request id reused with different input · 55000 party inactive ·
          54000 guide budget exceeded.
  Same (party, actor, request) + same input returns the original receipt with replayed=true.

  public.bridge_get_campaign_install(_party_id uuid, _actor text, _request_id uuid) RETURNS jsonb
    -- same receipt shape (replayed=true) or NULL. Never returns snapshots or guide text.
*/
CREATE OR REPLACE FUNCTION public.bridge_install_campaign_area(
  _party_id uuid, _actor text, _request_id uuid, _expected_host_id uuid,
  _expected_updated_at timestamptz, _expected_revision integer, _expected_legacy boolean,
  _parent_map_id uuid, _parent_location_id text, _area_name text,
  _map_state jsonb, _guides jsonb, _payload_digest text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  sep constant text := E'\n\n---\n\n';
  ws constant text := E' \t\n\r';
  p record; cur public.party_shared_state%ROWTYPE; rec public.bridge_campaign_installs%ROWTYPE;
  legacy boolean; atlas jsonb; parent_id uuid; parent_node jsonb; root_id uuid;
  new_id uuid := gen_random_uuid(); st jsonb; child jsonb; new_rev integer; new_updated timestamptz;
  rate numeric; cm numeric; input_digest text; guides jsonb := coalesce(_guides, '[]'::jsonb);
  g jsonb; l jsonb; keys text[] := '{}'; k text; gid uuid; gids uuid[] := '{}';
  child_locs text[];
  core text; prefix text[] := '{}'; path uuid[] := '{}'; pm uuid; node jsonb; via text; c jsonb; piece text;
  area_parts text[]; area text; combined text; best int := 0; nm text; i int;
BEGIN
  -- arguments
  IF _party_id IS NULL OR _request_id IS NULL OR _expected_host_id IS NULL THEN RAISE EXCEPTION 'Missing party, request or host' USING ERRCODE='22023'; END IF;
  IF _actor IS NULL OR btrim(_actor) = '' OR char_length(_actor) > 200 THEN RAISE EXCEPTION 'Invalid actor' USING ERRCODE='22023'; END IF;
  IF _payload_digest IS NULL OR _payload_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid payload digest' USING ERRCODE='22023'; END IF;
  input_digest := encode(sha256(convert_to(jsonb_build_object(
    'party', _party_id, 'host', _expected_host_id, 'updatedAt', _expected_updated_at, 'revision', _expected_revision,
    'legacy', _expected_legacy, 'parentMap', _parent_map_id, 'parentLocation', _parent_location_id,
    'name', _area_name, 'map', _map_state, 'guides', _guides)::text, 'UTF8')), 'hex');

  -- serialize installs for this party, then idempotency
  SELECT id, created_by, is_active INTO p FROM public.parties WHERE id = _party_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Party not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO rec FROM public.bridge_campaign_installs WHERE party_id = _party_id AND actor = _actor AND request_id = _request_id;
  IF FOUND THEN
    IF rec.payload_digest = _payload_digest AND rec.input_digest = input_digest THEN
      RETURN public.bridge_campaign_install_receipt_json(rec, true);
    END IF;
    RAISE EXCEPTION 'This request id was already used for a different install' USING ERRCODE='23505';
  END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Party is not active' USING ERRCODE='55000'; END IF;
  IF p.created_by IS DISTINCT FROM _expected_host_id THEN RAISE EXCEPTION 'Party host changed' USING ERRCODE='40001'; END IF;

  SELECT * INTO cur FROM public.party_shared_state s
    WHERE s.party_id = _party_id AND s.user_id = p.created_by AND s.state_type = 'campaign_map' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign map not found' USING ERRCODE='P0002'; END IF;
  IF _expected_updated_at IS NULL OR cur.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'Campaign map changed; reload first' USING ERRCODE='40001'; END IF;

  legacy := NOT public.campaign_atlas_is_envelope(cur.state_data);
  IF legacy THEN
    IF NOT coalesce(_expected_legacy, false) OR _expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Campaign map format changed; reload first' USING ERRCODE='40001'; END IF;
    IF _parent_map_id IS NOT NULL THEN RAISE EXCEPTION 'A legacy map has no area ids yet; parent map must be empty' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(cur.state_data) <> 'object' OR cur.state_data ? 'format' OR (cur.state_data ? 'version' AND cur.state_data->'version' <> '1'::jsonb) THEN
      RAISE EXCEPTION 'Unknown campaign map format' USING ERRCODE='22023'; END IF;
    IF coalesce(jsonb_typeof(cur.state_data->'campaignMinute'),'null') NOT IN ('null','number') OR coalesce((cur.state_data->>'campaignMinute')::numeric,0) < 0 THEN
      RAISE EXCEPTION 'Legacy map clock is invalid' USING ERRCODE='22023'; END IF;
    cm := coalesce((cur.state_data->>'campaignMinute')::numeric, 0);
    rate := CASE WHEN jsonb_typeof(cur.state_data->'realMinutesPerGameHour') = 'number'
                  AND (cur.state_data->>'realMinutesPerGameHour')::numeric BETWEEN 0.25 AND 240
                 THEN (cur.state_data->>'realMinutesPerGameHour')::numeric ELSE 5 END;
    root_id := gen_random_uuid();
    atlas := jsonb_build_object('format','odyssey-campaign-atlas','version',2,'revision',0,'sourcePartyId',_party_id::text,
      'rootMapId',root_id::text,'activeMapId',root_id::text,'campaignMinute',cm,'realMinutesPerGameHour',rate,
      'maps', jsonb_build_array(jsonb_build_object('id',root_id::text,'name','World','parentMapId',null,'parentLocationId',null,
        'entryLocationId',null,'navigationMode','regional','state',cur.state_data)));
    parent_id := root_id; new_rev := 0;
  ELSE
    IF coalesce(_expected_legacy, false) OR _expected_revision IS NULL THEN RAISE EXCEPTION 'Campaign map format changed; reload first' USING ERRCODE='40001'; END IF;
    IF jsonb_typeof(cur.state_data->'revision') IS DISTINCT FROM 'number' OR (cur.state_data->>'revision')::numeric <> _expected_revision THEN
      RAISE EXCEPTION 'Campaign map changed; reload first' USING ERRCODE='40001'; END IF;
    IF _parent_map_id IS NULL THEN RAISE EXCEPTION 'Parent map is required' USING ERRCODE='22023'; END IF;
    IF cur.state_data->>'sourcePartyId' IS DISTINCT FROM _party_id::text THEN RAISE EXCEPTION 'Atlas belongs to a different party' USING ERRCODE='22023'; END IF;
    PERFORM public.bridge_atlas_validate_full(cur.state_data);
    atlas := cur.state_data; parent_id := _parent_map_id; new_rev := _expected_revision + 1;
  END IF;

  -- attachment point
  SELECT y INTO parent_node FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'id' = parent_id::text;
  IF parent_node IS NULL THEN RAISE EXCEPTION 'Parent map not found' USING ERRCODE='22023'; END IF;
  IF _parent_location_id IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(parent_node->'state'->'locations') y WHERE y->>'id' = _parent_location_id) THEN
    RAISE EXCEPTION 'Parent place not found' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'parentMapId' = parent_id::text AND y->>'parentLocationId' = _parent_location_id) THEN
    RAISE EXCEPTION 'That place already has an area map' USING ERRCODE='23505'; END IF;

  -- the new local area
  IF _area_name IS NULL OR btrim(_area_name) = '' OR char_length(btrim(_area_name)) > 120 THEN RAISE EXCEPTION 'Invalid area name' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_map_state) IS DISTINCT FROM 'object' OR _map_state ? 'format' OR (_map_state ? 'version' AND _map_state->'version' <> '1'::jsonb) THEN
    RAISE EXCEPTION 'Area map must be a version 1 map' USING ERRCODE='22023'; END IF;
  IF coalesce(jsonb_typeof(_map_state->'activeTravel'),'null') <> 'null' OR coalesce(jsonb_typeof(_map_state->'journeyPlan'),'null') <> 'null'
     OR coalesce(jsonb_typeof(_map_state->'currentRoutePosition'),'null') <> 'null' THEN
    RAISE EXCEPTION 'A new area cannot carry travel' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_map_state->'imageUrl') IS DISTINCT FROM 'string' OR _map_state->>'imageUrl' !~ '^https://' OR char_length(_map_state->>'imageUrl') > 2000 THEN
    RAISE EXCEPTION 'Area map needs a verified https image' USING ERRCODE='22023'; END IF;
  IF coalesce(_map_state->>'defaultPace','') NOT IN ('slow','normal','fast') THEN RAISE EXCEPTION 'Invalid default pace' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_map_state->'locations') IS DISTINCT FROM 'array' OR jsonb_array_length(_map_state->'locations') = 0 THEN
    RAISE EXCEPTION 'Area map needs places' USING ERRCODE='22023'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_map_state->'locations') LOOP
    IF jsonb_typeof(l->'name') IS DISTINCT FROM 'string' OR btrim(l->>'name') = '' OR char_length(l->>'name') > 80 THEN
      RAISE EXCEPTION 'Area places need names of 1 to 80 characters' USING ERRCODE='22023'; END IF;
  END LOOP;
  SELECT array_agg(y->>'id') INTO child_locs FROM jsonb_array_elements(_map_state->'locations') y;
  IF jsonb_typeof(_map_state->'currentLocationId') IS DISTINCT FROM 'string' OR NOT ((_map_state->>'currentLocationId') = ANY(child_locs)) THEN
    RAISE EXCEPTION 'Area map needs a valid arrival place' USING ERRCODE='22023'; END IF;
  st := (_map_state - 'activeTravel' - 'journeyPlan' - 'currentRoutePosition')
        || jsonb_build_object('version', 1, 'campaignMinute', atlas->'campaignMinute', 'realMinutesPerGameHour', atlas->'realMinutesPerGameHour');
  child := jsonb_build_object('id', new_id::text, 'name', btrim(_area_name), 'parentMapId', parent_id::text,
    'parentLocationId', _parent_location_id, 'entryLocationId', st->>'currentLocationId', 'navigationMode', 'local', 'state', st);
  atlas := jsonb_set(jsonb_set(atlas, '{maps}', (atlas->'maps') || jsonb_build_array(child)), '{revision}', to_jsonb(new_rev));
  PERFORM public.bridge_atlas_validate_full(atlas);

  -- guides
  IF jsonb_typeof(guides) <> 'array' OR jsonb_array_length(guides) > 501 THEN RAISE EXCEPTION 'Invalid guides list' USING ERRCODE='22023'; END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(guides) LOOP
    IF jsonb_typeof(g) <> 'object' OR coalesce(g->>'scope','') NOT IN ('map','location') THEN RAISE EXCEPTION 'Invalid guide scope' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(g->'name') IS DISTINCT FROM 'string' OR btrim(g->>'name') = '' OR char_length(btrim(g->>'name')) > 120 THEN RAISE EXCEPTION 'Invalid guide name' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(g->'content') IS DISTINCT FROM 'string' OR char_length(g->>'content') > 30000 THEN RAISE EXCEPTION 'Guide content over 30,000 characters' USING ERRCODE='22023'; END IF;
    IF coalesce(jsonb_typeof(g->'enabled'),'boolean') <> 'boolean' THEN RAISE EXCEPTION 'Invalid guide enabled flag' USING ERRCODE='22023'; END IF;
    IF g->>'scope' = 'map' THEN
      IF coalesce(jsonb_typeof(g->'locationId'),'null') <> 'null' THEN RAISE EXCEPTION 'Map guides have no place' USING ERRCODE='22023'; END IF;
      k := 'map';
    ELSE
      IF jsonb_typeof(g->'locationId') IS DISTINCT FROM 'string' OR NOT ((g->>'locationId') = ANY(child_locs)) THEN RAISE EXCEPTION 'Guide place is not on the new area' USING ERRCODE='22023'; END IF;
      k := 'location:' || (g->>'locationId');
    END IF;
    IF k = ANY(keys) THEN RAISE EXCEPTION 'Two guides target the same scope' USING ERRCODE='22023'; END IF;
    keys := keys || k;
  END LOOP;

  -- combined guide budget (core party guides + area guides on the path to every place in the new area)
  SELECT string_agg('### ' || name || E'\n' || content, sep ORDER BY created_at) INTO core
    FROM public.gm_guides WHERE user_id = p.created_by AND mode = 'party' AND enabled AND btrim(content, ws) <> '';
  core := btrim(coalesce(core, ''), ws);
  pm := parent_id;
  WHILE pm IS NOT NULL LOOP
    path := pm || path;
    IF array_length(path,1) > 513 THEN RAISE EXCEPTION 'Map loop' USING ERRCODE='22023'; END IF;
    SELECT public.safe_uuid(y->>'parentMapId') INTO pm FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'id' = pm::text;
  END LOOP;
  FOR i IN 1 .. array_length(path,1) LOOP
    SELECT y INTO node FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'id' = path[i]::text;
    nm := node->>'name';
    SELECT '### ' || name || ' — ' || nm || ' [area map ' || path[i] || ']' || E'\n' || content INTO piece
      FROM public.party_location_guides WHERE party_id = _party_id AND map_id = path[i] AND scope = 'map' AND enabled AND btrim(content, ws) <> '';
    IF piece IS NOT NULL THEN prefix := prefix || piece; END IF; piece := NULL;
    IF i < array_length(path,1) THEN
      SELECT y->>'parentLocationId' INTO via FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'id' = path[i+1]::text;
    ELSE via := _parent_location_id; END IF;
    FOR c IN SELECT * FROM jsonb_array_elements(public.bridge_atlas_location_chain(node->'state', via)) LOOP
      SELECT '### ' || name || ' — ' || nm || ' › ' || (c->>'name') || ' [place ' || (c->>'id') || ' on map ' || path[i] || ']' || E'\n' || content INTO piece
        FROM public.party_location_guides WHERE party_id = _party_id AND map_id = path[i] AND scope = 'location' AND location_id = c->>'id' AND enabled AND btrim(content, ws) <> '';
      IF piece IS NOT NULL THEN prefix := prefix || piece; END IF; piece := NULL;
    END LOOP;
  END LOOP;
  SELECT '### ' || btrim(g->>'name') || ' — ' || btrim(_area_name) || ' [area map ' || new_id || ']' || E'\n' || (g->>'content') INTO piece
    FROM jsonb_array_elements(guides) g WHERE g->>'scope' = 'map' AND coalesce((g->>'enabled')::boolean, true) AND btrim(g->>'content', ws) <> '';
  IF piece IS NOT NULL THEN prefix := prefix || piece; END IF; piece := NULL;
  FOREACH via IN ARRAY child_locs LOOP
    area_parts := prefix;
    FOR c IN SELECT * FROM jsonb_array_elements(public.bridge_atlas_location_chain(st, via)) LOOP
      SELECT '### ' || btrim(g->>'name') || ' — ' || btrim(_area_name) || ' › ' || (c->>'name') || ' [place ' || (c->>'id') || ' on map ' || new_id || ']' || E'\n' || (g->>'content') INTO piece
        FROM jsonb_array_elements(guides) g WHERE g->>'scope' = 'location' AND g->>'locationId' = c->>'id'
          AND coalesce((g->>'enabled')::boolean, true) AND btrim(g->>'content', ws) <> '';
      IF piece IS NOT NULL THEN area_parts := area_parts || piece; END IF; piece := NULL;
    END LOOP;
    area := btrim(coalesce(array_to_string(area_parts, sep), ''), ws);
    combined := CASE WHEN area = '' THEN core
                     WHEN core = '' THEN '## CURRENT AREA GUIDES (where the party is now)' || E'\n\n' || area
                     ELSE core || sep || '## CURRENT AREA GUIDES (where the party is now)' || E'\n\n' || area END;
    best := greatest(best, char_length(combined));
  END LOOP;
  IF best > 200000 THEN RAISE EXCEPTION 'Guides for the new area would add up to % characters, over the 200,000 limit', best USING ERRCODE='54000'; END IF;

  -- write map, guides and receipt atomically
  UPDATE public.party_shared_state s SET state_data = atlas WHERE s.id = cur.id RETURNING s.updated_at INTO new_updated;
  FOR g IN SELECT * FROM jsonb_array_elements(guides) LOOP
    INSERT INTO public.party_location_guides (party_id, map_id, scope, location_id, name, content, enabled)
      VALUES (_party_id, new_id, g->>'scope', CASE WHEN g->>'scope' = 'location' THEN g->>'locationId' END,
              btrim(g->>'name'), g->>'content', coalesce((g->>'enabled')::boolean, true))
      RETURNING id INTO gid;
    gids := gids || gid;
  END LOOP;
  INSERT INTO public.bridge_campaign_installs (request_id, party_id, actor, payload_digest, input_digest, host_user_id, state_row_id,
      converted_legacy, original_state_data, original_updated_at, installed_map_id, parent_map_id, parent_location_id, guide_ids, new_revision, new_updated_at)
    VALUES (_request_id, _party_id, _actor, _payload_digest, input_digest, p.created_by, cur.id,
      legacy, cur.state_data, cur.updated_at, new_id, parent_id, _parent_location_id, gids, new_rev, new_updated)
    RETURNING * INTO rec;
  RETURN public.bridge_campaign_install_receipt_json(rec, false);
END $$;
REVOKE ALL ON FUNCTION public.bridge_install_campaign_area(uuid, text, uuid, uuid, timestamptz, integer, boolean, uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_install_campaign_area(uuid, text, uuid, uuid, timestamptz, integer, boolean, uuid, text, text, jsonb, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.bridge_get_campaign_install(_party_id uuid, _actor text, _request_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT public.bridge_campaign_install_receipt_json(r, true) FROM public.bridge_campaign_installs r
  WHERE r.party_id = _party_id AND r.actor = _actor AND r.request_id = _request_id
$$;
REVOKE ALL ON FUNCTION public.bridge_get_campaign_install(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_get_campaign_install(uuid, text, uuid) TO service_role;
