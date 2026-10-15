-- Fix: a query alias shadowed the loop variable "g" (error 42702), so every install with guides failed.
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
  IF _party_id IS NULL OR _request_id IS NULL OR _expected_host_id IS NULL THEN RAISE EXCEPTION 'Missing party, request or host' USING ERRCODE='22023'; END IF;
  IF _actor IS NULL OR btrim(_actor) = '' OR char_length(_actor) > 200 THEN RAISE EXCEPTION 'Invalid actor' USING ERRCODE='22023'; END IF;
  IF _payload_digest IS NULL OR _payload_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid payload digest' USING ERRCODE='22023'; END IF;
  input_digest := encode(sha256(convert_to(jsonb_build_object(
    'party', _party_id, 'host', _expected_host_id, 'updatedAt', _expected_updated_at, 'revision', _expected_revision,
    'legacy', _expected_legacy, 'parentMap', _parent_map_id, 'parentLocation', _parent_location_id,
    'name', _area_name, 'map', _map_state, 'guides', _guides)::text, 'UTF8')), 'hex');

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

  SELECT y INTO parent_node FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'id' = parent_id::text;
  IF parent_node IS NULL THEN RAISE EXCEPTION 'Parent map not found' USING ERRCODE='22023'; END IF;
  IF _parent_location_id IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(parent_node->'state'->'locations') y WHERE y->>'id' = _parent_location_id) THEN
    RAISE EXCEPTION 'Parent place not found' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(atlas->'maps') y WHERE y->>'parentMapId' = parent_id::text AND y->>'parentLocationId' = _parent_location_id) THEN
    RAISE EXCEPTION 'That place already has an area map' USING ERRCODE='23505'; END IF;

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
  SELECT '### ' || btrim(gg->>'name') || ' — ' || btrim(_area_name) || ' [area map ' || new_id || ']' || E'\n' || (gg->>'content') INTO piece
    FROM jsonb_array_elements(guides) AS t(gg) WHERE gg->>'scope' = 'map' AND coalesce((gg->>'enabled')::boolean, true) AND btrim(gg->>'content', ws) <> '';
  IF piece IS NOT NULL THEN prefix := prefix || piece; END IF; piece := NULL;
  FOREACH via IN ARRAY child_locs LOOP
    area_parts := prefix;
    FOR c IN SELECT * FROM jsonb_array_elements(public.bridge_atlas_location_chain(st, via)) LOOP
      SELECT '### ' || btrim(gg->>'name') || ' — ' || btrim(_area_name) || ' › ' || (c->>'name') || ' [place ' || (c->>'id') || ' on map ' || new_id || ']' || E'\n' || (gg->>'content') INTO piece
        FROM jsonb_array_elements(guides) AS t(gg) WHERE gg->>'scope' = 'location' AND gg->>'locationId' = c->>'id'
          AND coalesce((gg->>'enabled')::boolean, true) AND btrim(gg->>'content', ws) <> '';
      IF piece IS NOT NULL THEN area_parts := area_parts || piece; END IF; piece := NULL;
    END LOOP;
    area := btrim(coalesce(array_to_string(area_parts, sep), ''), ws);
    combined := CASE WHEN area = '' THEN core
                     WHEN core = '' THEN '## CURRENT AREA GUIDES (where the party is now)' || E'\n\n' || area
                     ELSE core || sep || '## CURRENT AREA GUIDES (where the party is now)' || E'\n\n' || area END;
    best := greatest(best, char_length(combined));
  END LOOP;
  IF best > 200000 THEN RAISE EXCEPTION 'Guides for the new area would add up to % characters, over the 200,000 limit', best USING ERRCODE='54000'; END IF;

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
