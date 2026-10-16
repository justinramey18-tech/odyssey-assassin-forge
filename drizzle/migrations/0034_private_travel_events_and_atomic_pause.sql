CREATE TABLE public.party_travel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  map_id uuid,
  destination_location_id text NOT NULL,
  journey_plan_hash text NOT NULL,
  has_event boolean NOT NULL,
  event_type text,
  event_premise text,
  target_leg_index integer CHECK (target_leg_index >= 0),
  target_route_id text,
  target_route_progress double precision CHECK (target_route_progress BETWEEN 0 AND 1),
  target_reversed boolean,
  target_overall_fraction double precision CHECK (target_overall_fraction BETWEEN 0 AND 1),
  target_tranche_fraction double precision CHECK (target_tranche_fraction BETWEEN 0 AND 1),
  target_campaign_minute double precision CHECK (target_campaign_minute >= 0 AND target_campaign_minute < 'Infinity'::double precision),
  expected_tranche_started_at bigint,
  scheduled_at timestamptz,
  qstash_message_id text,
  status text NOT NULL CHECK (status IN ('planned','scheduled','firing','posted','no_event','cancelled','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  dm_message_id uuid REFERENCES public.party_dm_messages(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT travel_event_shape CHECK (
    (has_event AND status <> 'no_event' AND event_type IS NOT NULL AND event_premise IS NOT NULL
      AND target_leg_index IS NOT NULL AND target_route_id IS NOT NULL AND target_route_progress IS NOT NULL
      AND target_reversed IS NOT NULL AND target_overall_fraction IS NOT NULL)
    OR (NOT has_event AND status = 'no_event' AND event_type IS NULL AND event_premise IS NULL
      AND target_leg_index IS NULL AND target_route_id IS NULL AND target_route_progress IS NULL
      AND target_reversed IS NULL AND target_overall_fraction IS NULL AND target_tranche_fraction IS NULL
      AND target_campaign_minute IS NULL AND expected_tranche_started_at IS NULL
      AND scheduled_at IS NULL AND qstash_message_id IS NULL)
  )
);
REVOKE ALL ON TABLE public.party_travel_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.party_travel_events TO service_role;
ALTER TABLE public.party_travel_events ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX party_travel_events_one_open ON public.party_travel_events(party_id)
  WHERE status IN ('planned','scheduled','firing','no_event');
CREATE INDEX party_travel_events_due ON public.party_travel_events(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX party_travel_events_history ON public.party_travel_events(party_id, created_at DESC);
CREATE TRIGGER party_travel_events_updated_at BEFORE UPDATE ON public.party_travel_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON COLUMN public.party_travel_events.journey_plan_hash IS
  'Lowercase SHA-256 of UTF-8 PostgreSQL jsonb text of {destinationLocationId, pace, legs}; legs contains only routeId, fromLocationId, toLocationId, reversed in original array order. Excludes currentLegIndex, dayComplete and totalMiles. Later server planners must use this exact canonical form.';

CREATE FUNCTION public.pause_campaign_travel_for_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  e public.party_travel_events%ROWTYPE;
  r public.party_shared_state%ROWTYPE;
  host_id uuid; env jsonb; st jsonb; t jsonb; plan jsonb; normalized_legs jsonb;
  node_index integer; segment_index integer; atlas boolean; seg jsonb; chosen jsonb; leg jsonb;
  total double precision; want double precision; f double precision; base double precision;
  k double precision; progress double precision; forward_progress double precision; minute double precision;
  route_id text; reversed boolean; leg_index integer; plan_hash text; due_ms double precision;
  result jsonb := jsonb_build_object('paused',false,'stale',true);
BEGIN
  SELECT * INTO e FROM public.party_travel_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN result || jsonb_build_object('reason','missing_event'); END IF;
  result := result || jsonb_build_object('destinationLocationId',e.destination_location_id);
  IF NOT e.has_event OR e.status NOT IN ('scheduled','firing') THEN
    RETURN result || jsonb_build_object('reason','inactive_event');
  END IF;
  SELECT created_by INTO host_id FROM public.parties WHERE id = e.party_id FOR SHARE;
  SELECT * INTO r FROM public.party_shared_state
    WHERE party_id = e.party_id AND user_id = host_id AND state_type = 'campaign_map' FOR UPDATE;
  IF NOT FOUND THEN RETURN result || jsonb_build_object('reason','missing_map'); END IF;
  env := r.state_data;
  atlas := public.campaign_atlas_is_envelope(env);
  IF atlas THEN
    IF env->>'sourcePartyId' IS DISTINCT FROM e.party_id::text THEN RETURN result || jsonb_build_object('reason','wrong_party'); END IF;
    IF e.map_id IS NOT NULL AND env->>'activeMapId' IS DISTINCT FROM e.map_id::text THEN
      RETURN result || jsonb_build_object('reason','wrong_map');
    END IF;
    SELECT (ord - 1)::integer, n->'state' INTO node_index, st
      FROM jsonb_array_elements(env->'maps') WITH ORDINALITY AS a(n,ord)
      WHERE n->>'id' = env->>'activeMapId';
  ELSE
    IF e.map_id IS NOT NULL THEN RETURN result || jsonb_build_object('reason','wrong_map'); END IF;
    st := env;
  END IF;
  plan := st->'journeyPlan'; t := st->'activeTravel';
  IF jsonb_typeof(plan) IS DISTINCT FROM 'object' OR jsonb_typeof(t) IS DISTINCT FROM 'object'
    OR jsonb_typeof(plan->'legs') IS DISTINCT FROM 'array' THEN
    RETURN result || jsonb_build_object('reason','missing_journey');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('routeId',l->'routeId','fromLocationId',l->'fromLocationId',
    'toLocationId',l->'toLocationId','reversed',l->'reversed') ORDER BY ord),'[]'::jsonb)
    INTO normalized_legs FROM jsonb_array_elements(plan->'legs') WITH ORDINALITY a(l,ord);
  plan_hash := encode(sha256(convert_to(jsonb_build_object('destinationLocationId',plan->'destinationLocationId',
    'pace',plan->'pace','legs',normalized_legs)::text,'UTF8')),'hex');
  IF plan->>'destinationLocationId' IS DISTINCT FROM e.destination_location_id OR plan_hash IS DISTINCT FROM e.journey_plan_hash
    OR t->>'pace' IS DISTINCT FROM plan->>'pace' THEN
    RETURN result || jsonb_build_object('reason','changed_journey');
  END IF;
  IF e.target_tranche_fraction IS NULL OR e.target_campaign_minute IS NULL OR e.expected_tranche_started_at IS NULL
    OR e.scheduled_at IS NULL THEN RETURN result || jsonb_build_object('reason','unarmed_event'); END IF;
  f := e.target_tranche_fraction;
  -- Exact translation of travelDetailAt: segment boundaries belong to the NEXT segment.
  IF jsonb_typeof(t->'segments') = 'array' AND jsonb_array_length(t->'segments') > 0 THEN
    SELECT sum((s->>'gameMinutes')::double precision) INTO total FROM jsonb_array_elements(t->'segments') a(s);
    want := total * f;
    FOR seg, segment_index IN SELECT s, ord::integer FROM jsonb_array_elements(t->'segments') WITH ORDINALITY a(s,ord) ORDER BY ord LOOP
      chosen := seg;
      EXIT WHEN want < (seg->>'gameMinutes')::double precision;
      -- Keep the last segment and its full duration at fraction 1.
      IF segment_index = jsonb_array_length(t->'segments') THEN EXIT; END IF;
      want := want - (seg->>'gameMinutes')::double precision;
    END LOOP;
    k := CASE WHEN (chosen->>'gameMinutes')::double precision > 0
      THEN least(1, want / (chosen->>'gameMinutes')::double precision) ELSE 1 END;
    progress := (chosen->>'startProgress')::double precision
      + ((chosen->>'endProgress')::double precision - (chosen->>'startProgress')::double precision) * k;
    route_id := chosen->>'routeId'; reversed := (chosen->>'reversed')::boolean;
    leg_index := (chosen->>'legIndex')::integer;
  ELSE
    total := (t->>'gameMinutes')::double precision;
    progress := (t->>'startProgress')::double precision
      + ((t->>'endProgress')::double precision - (t->>'startProgress')::double precision) * f;
    route_id := t->>'routeId'; reversed := (t->>'reversed')::boolean;
    leg_index := (plan->>'currentLegIndex')::integer;
  END IF;
  forward_progress := CASE WHEN reversed THEN 1 - progress ELSE progress END;
  minute := (t->>'startCampaignMinute')::double precision + total * f;
  leg := plan->'legs'->e.target_leg_index;
  IF total IS NULL OR total <= 0 OR total >= 'Infinity'::double precision
    OR minute IS NULL OR minute >= 'Infinity'::double precision
    OR route_id IS DISTINCT FROM e.target_route_id OR reversed IS DISTINCT FROM e.target_reversed
    OR leg_index IS DISTINCT FROM e.target_leg_index OR leg->>'routeId' IS DISTINCT FROM route_id
    OR (leg->>'reversed')::boolean IS DISTINCT FROM reversed
    OR forward_progress IS NULL OR abs(forward_progress - e.target_route_progress) > 1e-9
    OR abs(minute - e.target_campaign_minute) > 1e-7 THEN
    RETURN result || jsonb_build_object('reason','changed_target');
  END IF;
  result := result || jsonb_build_object('campaignMinute',e.target_campaign_minute,'routeId',e.target_route_id,
    'routeProgress',e.target_route_progress,'destinationLocationId',e.destination_location_id);
  IF e.status = 'firing' AND t->'startedAt' = 'null'::jsonb
    AND (t->>'pausedFraction')::double precision = f
    AND st->'currentRoutePosition'->>'routeId' = e.target_route_id
    AND (st->'currentRoutePosition'->>'progress')::double precision = e.target_route_progress
    AND (st->'currentRoutePosition'->>'reversed')::boolean = e.target_reversed
    AND (st->>'campaignMinute')::double precision = e.target_campaign_minute
    AND (NOT atlas OR (env->>'campaignMinute')::double precision = e.target_campaign_minute) THEN
    RETURN result || jsonb_build_object('paused',true,'stale',false,'alreadyPaused',true);
  END IF;
  IF e.status <> 'scheduled' OR jsonb_typeof(t->'startedAt') IS DISTINCT FROM 'number'
    OR (t->>'startedAt')::numeric <> e.expected_tranche_started_at THEN
    RETURN result || jsonb_build_object('reason','changed_tranche');
  END IF;
  base := greatest(0,least(1,coalesce((t->>'pausedFraction')::double precision,0)));
  IF f < base OR base >= 1 OR (t->>'realDurationMs')::double precision IS NULL
    OR (t->>'realDurationMs')::double precision <= 0 OR (t->>'realDurationMs')::double precision >= 'Infinity'::double precision THEN
    RETURN result || jsonb_build_object('reason','passed_target');
  END IF;
  -- travelFraction includes the saved fraction when a tranche was resumed.
  due_ms := e.expected_tranche_started_at + (f - base) / (1 - base) * (t->>'realDurationMs')::double precision;
  IF clock_timestamp() < e.scheduled_at OR extract(epoch FROM clock_timestamp()) * 1000 < due_ms THEN
    RETURN result || jsonb_build_object('stale',false,'reason','not_due');
  END IF;
  st := jsonb_set(st,'{activeTravel}',t || jsonb_build_object('startedAt',NULL,'pausedFraction',f));
  st := st || jsonb_build_object('currentRoutePosition',jsonb_build_object('routeId',e.target_route_id,
    'progress',e.target_route_progress,'reversed',e.target_reversed),'campaignMinute',e.target_campaign_minute);
  IF atlas THEN
    env := jsonb_set(env,ARRAY['maps',node_index::text,'state'],st);
    env := env || jsonb_build_object('campaignMinute',e.target_campaign_minute,'revision',(env->>'revision')::numeric + 1);
    PERFORM public.campaign_atlas_validate(env);
  ELSE env := st;
  END IF;
  UPDATE public.party_shared_state SET state_data = env, updated_at = clock_timestamp()
    WHERE id = r.id AND updated_at IS NOT DISTINCT FROM r.updated_at AND state_data = r.state_data;
  IF NOT FOUND THEN RETURN result || jsonb_build_object('reason','map_conflict'); END IF;
  UPDATE public.party_travel_events SET status = 'firing' WHERE id = e.id;
  RETURN result || jsonb_build_object('paused',true,'stale',false,'alreadyPaused',false);
END $$;
REVOKE ALL ON FUNCTION public.pause_campaign_travel_for_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_campaign_travel_for_event(uuid) TO service_role;
