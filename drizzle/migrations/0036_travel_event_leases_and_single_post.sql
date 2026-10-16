ALTER TABLE public.party_travel_events ADD COLUMN firing_lease_id uuid;
ALTER TABLE public.party_travel_events ADD COLUMN firing_lease_until timestamptz;
CREATE FUNCTION public.claim_travel_event_attempt(_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_catalog AS $$
DECLARE e public.party_travel_events%ROWTYPE; lease uuid;
BEGIN
 SELECT * INTO e FROM public.party_travel_events WHERE id=_event_id FOR UPDATE;
 IF NOT FOUND OR e.status<>'firing' OR e.dm_message_id IS NOT NULL THEN RETURN jsonb_build_object('claimed',false); END IF;
 IF e.firing_lease_until > clock_timestamp() THEN RETURN jsonb_build_object('claimed',false,'busy',true); END IF;
 lease:=gen_random_uuid();
 UPDATE public.party_travel_events SET firing_lease_id=lease,firing_lease_until=clock_timestamp()+interval '3 minutes',attempt_count=attempt_count+1 WHERE id=e.id;
 RETURN jsonb_build_object('claimed',true,'leaseId',lease,'attempt',e.attempt_count+1);
END $$;
CREATE FUNCTION public.complete_travel_event_post(_event_id uuid,_lease_id uuid,_content text,_failed boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_catalog AS $$
DECLARE e public.party_travel_events%ROWTYPE; post_id uuid;
BEGIN
 SELECT * INTO e FROM public.party_travel_events WHERE id=_event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF e.dm_message_id IS NOT NULL THEN RETURN e.dm_message_id; END IF;
 IF e.status<>'firing' OR e.firing_lease_id IS DISTINCT FROM _lease_id OR e.firing_lease_until < clock_timestamp() OR length(trim(_content))=0 THEN RETURN NULL; END IF;
 INSERT INTO public.party_dm_messages(party_id,role,content,sender_user_id,sender_name)
 VALUES(e.party_id,'assistant',left(trim(_content),30000),NULL,'DM') RETURNING id INTO post_id;
 UPDATE public.party_travel_events SET dm_message_id=post_id,status=CASE WHEN _failed THEN 'failed' ELSE 'posted' END,
 last_error=CASE WHEN _failed THEN 'Narration unavailable after retries' ELSE NULL END,firing_lease_id=NULL,firing_lease_until=NULL WHERE id=e.id;
 RETURN post_id;
END $$;
CREATE FUNCTION public.sync_private_travel_event(_event_id uuid,_expected_updated_at timestamptz,_expected_map jsonb,_patch jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_catalog AS $$
DECLARE e public.party_travel_events%ROWTYPE; st jsonb;
BEGIN
 SELECT * INTO e FROM public.party_travel_events WHERE id=_event_id FOR UPDATE;
 IF NOT FOUND OR e.updated_at IS DISTINCT FROM _expected_updated_at OR e.status NOT IN ('planned','scheduled','no_event') THEN RETURN false; END IF;
 SELECT state_data INTO st FROM public.party_shared_state WHERE party_id=e.party_id AND user_id=e.created_by AND state_type='campaign_map' FOR UPDATE;
 IF st IS DISTINCT FROM _expected_map THEN RETURN false; END IF;
 IF _patch->>'status' NOT IN ('planned','scheduled','cancelled') THEN RETURN false; END IF;
 UPDATE public.party_travel_events SET status=_patch->>'status',target_tranche_fraction=(_patch->>'target_tranche_fraction')::double precision,
 target_campaign_minute=(_patch->>'target_campaign_minute')::double precision,expected_tranche_started_at=(_patch->>'expected_tranche_started_at')::bigint,
 scheduled_at=(_patch->>'scheduled_at')::timestamptz,qstash_message_id=NULL,
 target_route_progress=coalesce((_patch->>'target_route_progress')::double precision,e.target_route_progress) WHERE id=e.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_travel_event_attempt(uuid),public.complete_travel_event_post(uuid,uuid,text,boolean),public.sync_private_travel_event(uuid,timestamptz,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_travel_event_attempt(uuid),public.complete_travel_event_post(uuid,uuid,text,boolean),public.sync_private_travel_event(uuid,timestamptz,jsonb,jsonb) TO service_role;
