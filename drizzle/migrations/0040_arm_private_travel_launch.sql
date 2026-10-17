CREATE FUNCTION public.arm_private_travel_launch(
  _event_id uuid, _expected_map jsonb, _started_at bigint, _schedule jsonb DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  e public.party_travel_events%ROWTYPE;
  r public.party_shared_state%ROWTYPE;
  host_id uuid; env jsonb; st jsonb; t jsonb; plan jsonb; normalized_legs jsonb;
  atlas boolean; node_index integer; plan_hash text;
  segments jsonb; seg jsonb; chosen jsonb; leg jsonb; segment_index integer;
  total double precision; f double precision; base double precision; want double precision;
  k double precision; progress double precision; forward_progress double precision;
  minute double precision; duration double precision; due_ms double precision;
  route_id text; reversed boolean; leg_index integer; scheduled timestamptz;
BEGIN
  IF _started_at IS NULL OR _started_at <= 0 THEN RETURN false; END IF;
  SELECT * INTO e FROM public.party_travel_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR NOT ((NOT e.has_event AND e.status = 'no_event') OR (e.has_event AND e.status = 'planned')) THEN RETURN false; END IF;
  SELECT created_by INTO host_id FROM public.parties WHERE id = e.party_id FOR SHARE;
  IF NOT FOUND OR host_id IS DISTINCT FROM e.created_by THEN RETURN false; END IF;
  SELECT * INTO r FROM public.party_shared_state
    WHERE party_id = e.party_id AND user_id = host_id AND state_type = 'campaign_map' FOR UPDATE;
  IF NOT FOUND OR r.state_data IS DISTINCT FROM _expected_map THEN RETURN false; END IF;
  env := r.state_data;
  atlas := public.campaign_atlas_is_envelope(env);
  IF atlas THEN
    IF env->>'sourcePartyId' IS DISTINCT FROM e.party_id::text
      OR env->>'activeMapId' IS DISTINCT FROM e.map_id::text THEN RETURN false; END IF;
    SELECT (ord - 1)::integer, n->'state' INTO node_index, st
      FROM jsonb_array_elements(env->'maps') WITH ORDINALITY AS a(n,ord)
      WHERE n->>'id' = env->>'activeMapId';
    IF NOT FOUND OR env->'campaignMinute' IS DISTINCT FROM st->'campaignMinute' THEN RETURN false; END IF;
  ELSE
    IF e.map_id IS NOT NULL THEN RETURN false; END IF;
    st := env;
  END IF;
  plan := st->'journeyPlan'; t := st->'activeTravel';
  IF jsonb_typeof(plan) IS DISTINCT FROM 'object' OR jsonb_typeof(t) IS DISTINCT FROM 'object'
    OR jsonb_typeof(plan->'legs') IS DISTINCT FROM 'array' OR t->'startedAt' IS DISTINCT FROM 'null'::jsonb
    OR st->>'travelScale' = 'city' THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('routeId',l->'routeId','fromLocationId',l->'fromLocationId',
    'toLocationId',l->'toLocationId','reversed',l->'reversed') ORDER BY ord),'[]'::jsonb)
    INTO normalized_legs FROM jsonb_array_elements(plan->'legs') WITH ORDINALITY a(l,ord);
  plan_hash := encode(sha256(convert_to(jsonb_build_object('destinationLocationId',plan->'destinationLocationId',
    'pace',plan->'pace','legs',normalized_legs)::text,'UTF8')),'hex');
  IF plan->>'destinationLocationId' IS DISTINCT FROM e.destination_location_id
    OR plan_hash IS DISTINCT FROM e.journey_plan_hash OR t->>'pace' IS DISTINCT FROM plan->>'pace' THEN RETURN false; END IF;
  duration := (t->>'realDurationMs')::double precision;
  base := coalesce((t->>'pausedFraction')::double precision,0);
  IF duration IS NULL OR NOT (duration > 0 AND duration < 'Infinity'::double precision)
    OR NOT (base >= 0 AND base < 1) THEN RETURN false; END IF;
  IF e.has_event THEN
    -- A queued callback is required, and its clock must exactly describe this staged tranche.
    IF jsonb_typeof(_schedule) IS DISTINCT FROM 'object'
      OR jsonb_typeof(_schedule->'expected_tranche_started_at') IS DISTINCT FROM 'number'
      OR (_schedule->>'expected_tranche_started_at')::numeric IS DISTINCT FROM _started_at::numeric
      OR jsonb_typeof(_schedule->'target_tranche_fraction') IS DISTINCT FROM 'number'
      OR jsonb_typeof(_schedule->'target_campaign_minute') IS DISTINCT FROM 'number'
      OR jsonb_typeof(_schedule->'target_route_progress') IS DISTINCT FROM 'number'
      OR jsonb_typeof(_schedule->'scheduled_at') IS DISTINCT FROM 'string'
      OR jsonb_typeof(_schedule->'qstash_message_id') IS DISTINCT FROM 'string'
      OR length(btrim(_schedule->>'qstash_message_id')) = 0 THEN RETURN false; END IF;
    f := (_schedule->>'target_tranche_fraction')::double precision;
    IF NOT (f > base AND f <= 1) THEN RETURN false; END IF;
    IF jsonb_typeof(t->'segments') = 'array' AND jsonb_array_length(t->'segments') > 0 THEN
      segments := t->'segments';
    ELSE
      segments := jsonb_build_array(t || jsonb_build_object('legIndex',plan->'currentLegIndex'));
    END IF;
    SELECT sum((s->>'gameMinutes')::double precision) INTO total FROM jsonb_array_elements(segments) a(s);
    IF total IS NULL OR NOT (total > 0 AND total < 'Infinity'::double precision) THEN RETURN false; END IF;
    want := total * f;
    FOR seg, segment_index IN SELECT s, ord::integer FROM jsonb_array_elements(segments) WITH ORDINALITY a(s,ord) ORDER BY ord LOOP
      IF (seg->>'gameMinutes')::double precision IS NULL
        OR NOT ((seg->>'gameMinutes')::double precision > 0 AND (seg->>'gameMinutes')::double precision < 'Infinity'::double precision) THEN RETURN false; END IF;
      chosen := seg;
      EXIT WHEN want < (seg->>'gameMinutes')::double precision OR segment_index = jsonb_array_length(segments);
      want := want - (seg->>'gameMinutes')::double precision;
    END LOOP;
    k := least(1, want / (chosen->>'gameMinutes')::double precision);
    progress := (chosen->>'startProgress')::double precision
      + ((chosen->>'endProgress')::double precision - (chosen->>'startProgress')::double precision) * k;
    route_id := chosen->>'routeId'; reversed := (chosen->>'reversed')::boolean;
    leg_index := (chosen->>'legIndex')::integer;
    forward_progress := CASE WHEN reversed THEN 1 - progress ELSE progress END;
    minute := (t->>'startCampaignMinute')::double precision + total * f;
    leg := plan->'legs'->e.target_leg_index;
    IF route_id IS DISTINCT FROM e.target_route_id OR reversed IS DISTINCT FROM e.target_reversed
      OR leg_index IS DISTINCT FROM e.target_leg_index OR leg->>'routeId' IS DISTINCT FROM route_id
      OR (leg->>'reversed')::boolean IS DISTINCT FROM reversed
      OR forward_progress IS NULL OR NOT (forward_progress >= 0 AND forward_progress <= 1)
      OR abs(forward_progress - e.target_route_progress) > 1e-9
      OR abs((_schedule->>'target_route_progress')::double precision - e.target_route_progress) > 1e-9
      OR NOT ((_schedule->>'target_route_progress')::double precision >= 0 AND (_schedule->>'target_route_progress')::double precision <= 1)
      OR minute IS NULL OR NOT (minute >= 0 AND minute < 'Infinity'::double precision)
      OR NOT ((_schedule->>'target_campaign_minute')::double precision >= 0 AND (_schedule->>'target_campaign_minute')::double precision < 'Infinity'::double precision)
      OR abs(minute - (_schedule->>'target_campaign_minute')::double precision) > 1e-7 THEN RETURN false; END IF;
    due_ms := _started_at + (f - base) / (1 - base) * duration;
    scheduled := (_schedule->>'scheduled_at')::timestamptz;
    -- JavaScript timestamps have millisecond precision; accept only that rounding loss.
    IF NOT isfinite(scheduled) OR abs(extract(epoch FROM scheduled) * 1000 - due_ms) >= 1 THEN RETURN false; END IF;
  END IF;
  st := jsonb_set(st,'{activeTravel,startedAt}',to_jsonb(_started_at),false);
  IF atlas THEN
    env := jsonb_set(env,ARRAY['maps',node_index::text,'state'],st,false);
    env := jsonb_set(env,'{revision}',to_jsonb((env->>'revision')::numeric + 1),false);
    PERFORM public.campaign_atlas_validate(env);
  ELSE env := st;
  END IF;
  UPDATE public.party_shared_state SET state_data = env, updated_at = clock_timestamp() WHERE id = r.id;
  IF e.has_event THEN
    UPDATE public.party_travel_events SET status = 'scheduled',target_tranche_fraction = f,
      target_campaign_minute = minute,expected_tranche_started_at = _started_at,
      scheduled_at = scheduled,qstash_message_id = _schedule->>'qstash_message_id'
      WHERE id = e.id;
  END IF;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format
  OR datetime_field_overflow OR invalid_parameter_value THEN
  -- The exception block rolls back both writes if validation rejects the proposed atlas.
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.arm_private_travel_launch(uuid,jsonb,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arm_private_travel_launch(uuid,jsonb,bigint,jsonb) TO service_role;
COMMENT ON FUNCTION public.arm_private_travel_launch(uuid,jsonb,bigint,jsonb) IS
  'Server-only atomic staged overland launch. started_at is server epoch milliseconds; schedule uses the existing target_tranche_fraction, target_campaign_minute, target_route_progress, expected_tranche_started_at, scheduled_at and qstash_message_id fields. Never called by the existing client launch path in foundation step 1.';