ALTER TABLE public.party_creation_contexts
  ADD COLUMN IF NOT EXISTS build_lease_id uuid,
  ADD COLUMN IF NOT EXISTS build_lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS build_fingerprint text,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Coalesces concurrent rebuilds per party; abandoned leases expire.
CREATE OR REPLACE FUNCTION public.onboarding_context_acquire(_party_id uuid, _fingerprint text, _force boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE c public.party_creation_contexts; lease uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.party_creation_contexts (party_id) VALUES (_party_id) ON CONFLICT (party_id) DO NOTHING;
  SELECT * INTO c FROM public.party_creation_contexts x WHERE x.party_id = _party_id FOR UPDATE;
  IF NOT coalesce(_force,false) AND c.status IN ('ready','error') AND c.source_fingerprint = _fingerprint THEN
    RETURN jsonb_build_object('acquired', false, 'fresh', true, 'revision', c.revision, 'status', c.status);
  END IF;
  IF c.build_lease_id IS NOT NULL AND c.build_lease_until > now() THEN
    RETURN jsonb_build_object('acquired', false, 'fresh', false, 'revision', c.revision, 'status', 'building');
  END IF;
  UPDATE public.party_creation_contexts x SET build_lease_id = lease, build_lease_until = now() + interval '3 minutes',
    build_fingerprint = _fingerprint, status = 'building', last_error = NULL WHERE x.party_id = _party_id;
  RETURN jsonb_build_object('acquired', true, 'leaseId', lease, 'revision', c.revision);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_context_complete(_party_id uuid, _lease_id uuid, _expected_revision integer,
  _source_fingerprint text, _manifest jsonb, _player_context jsonb, _starting_rules jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE c public.party_creation_contexts; r jsonb;
BEGIN
  SELECT * INTO c FROM public.party_creation_contexts x WHERE x.party_id = _party_id FOR UPDATE;
  IF NOT FOUND OR c.build_lease_id IS DISTINCT FROM _lease_id OR c.build_fingerprint IS DISTINCT FROM _source_fingerprint THEN
    RETURN jsonb_build_object('status','lease_lost');
  END IF;
  r := public.onboarding_context_update(_party_id, _expected_revision, _source_fingerprint, _manifest, _player_context, _starting_rules);
  UPDATE public.party_creation_contexts x SET build_lease_id = NULL, build_lease_until = NULL WHERE x.party_id = _party_id;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_context_fail(_party_id uuid, _lease_id uuid, _error text)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $$
  UPDATE public.party_creation_contexts x SET build_lease_id = NULL, build_lease_until = NULL,
    status = 'error', source_fingerprint = NULL, last_error = left(coalesce(_error,'Preparation failed'), 300)
  WHERE x.party_id = _party_id AND x.build_lease_id = _lease_id;
$$;

REVOKE ALL ON FUNCTION public.onboarding_context_acquire(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.onboarding_context_complete(uuid,uuid,integer,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.onboarding_context_fail(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_context_acquire(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.onboarding_context_complete(uuid,uuid,integer,text,jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.onboarding_context_fail(uuid,uuid,text) TO service_role;
REVOKE ALL ON public.party_creation_contexts FROM anon, authenticated;