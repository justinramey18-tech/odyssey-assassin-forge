ALTER TABLE public.party_travel_events DROP CONSTRAINT travel_event_shape;
ALTER TABLE public.party_travel_events ADD CONSTRAINT travel_event_shape CHECK (
  (has_event AND status <> 'no_event' AND event_type IS NOT NULL AND event_premise IS NOT NULL
    AND target_leg_index IS NOT NULL AND target_route_id IS NOT NULL AND target_route_progress IS NOT NULL
    AND target_reversed IS NOT NULL AND target_overall_fraction IS NOT NULL)
  OR (NOT has_event AND status IN ('no_event','cancelled') AND event_type IS NULL AND event_premise IS NULL
    AND target_leg_index IS NULL AND target_route_id IS NULL AND target_route_progress IS NULL
    AND target_reversed IS NULL AND target_overall_fraction IS NULL AND target_tranche_fraction IS NULL
    AND target_campaign_minute IS NULL AND expected_tranche_started_at IS NULL
    AND scheduled_at IS NULL AND qstash_message_id IS NULL)
);
CREATE FUNCTION public.commit_private_travel_plan(_party_id uuid, _host_id uuid, _expected_map jsonb, _plan jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE current_map jsonb; host_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('travel-plan:' || _party_id::text, 0));
  PERFORM id FROM public.party_travel_events WHERE party_id = _party_id AND status IN ('planned','scheduled','firing','no_event') FOR UPDATE;
  SELECT created_by INTO host_id FROM public.parties WHERE id = _party_id;
  IF host_id IS DISTINCT FROM _host_id THEN RETURN false; END IF;
  SELECT state_data INTO current_map FROM public.party_shared_state
    WHERE party_id = _party_id AND user_id = host_id AND state_type = 'campaign_map' FOR UPDATE;
  IF NOT FOUND OR current_map IS DISTINCT FROM _expected_map THEN RETURN false; END IF;
  UPDATE public.party_travel_events SET status = 'cancelled'
    WHERE party_id = _party_id AND status IN ('planned','scheduled','firing','no_event');
  INSERT INTO public.party_travel_events(party_id,created_by,map_id,destination_location_id,journey_plan_hash,has_event,status,
    event_type,event_premise,target_leg_index,target_route_id,target_route_progress,target_reversed,target_overall_fraction)
  VALUES (_party_id,_host_id,(_plan->>'map_id')::uuid,_plan->>'destination_location_id',_plan->>'journey_plan_hash',
    (_plan->>'has_event')::boolean,_plan->>'status',_plan->>'event_type',_plan->>'event_premise',
    (_plan->>'target_leg_index')::integer,_plan->>'target_route_id',(_plan->>'target_route_progress')::double precision,
    (_plan->>'target_reversed')::boolean,(_plan->>'target_overall_fraction')::double precision);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.commit_private_travel_plan(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_private_travel_plan(uuid,uuid,jsonb,jsonb) TO service_role;
