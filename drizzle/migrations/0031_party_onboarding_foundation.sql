CREATE TABLE public.party_creation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reserved_save_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','complete','cancelled')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_revision integer NOT NULL DEFAULT 0,
  context_revision integer NOT NULL DEFAULT 0,
  completed_save_id uuid REFERENCES public.character_saves(id) ON DELETE SET NULL,
  completed_member_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (party_id, user_id)
);
GRANT SELECT ON public.party_creation_sessions TO authenticated;
GRANT ALL ON public.party_creation_sessions TO service_role;
ALTER TABLE public.party_creation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own creation session" ON public.party_creation_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER party_creation_sessions_updated_at BEFORE UPDATE ON public.party_creation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.party_creation_contexts (
  party_id uuid PRIMARY KEY REFERENCES public.parties(id) ON DELETE CASCADE,
  source_fingerprint text,
  private_source_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  player_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  starting_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'building' CHECK (status IN ('building','ready','error')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.party_creation_contexts TO service_role;
ALTER TABLE public.party_creation_contexts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER party_creation_contexts_updated_at BEFORE UPDATE ON public.party_creation_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.party_onboarding_rate_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX party_onboarding_rate_events_lookup ON public.party_onboarding_rate_events (user_id, kind, created_at);
GRANT ALL ON public.party_onboarding_rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.party_onboarding_rate_events_id_seq TO service_role;
ALTER TABLE public.party_onboarding_rate_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.onboarding_lock(_user_id uuid, _party_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('odyssey-member-user:' || _user_id::text, 0)); END IF;
  IF _party_id IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('odyssey-member-party:' || _party_id::text, 0)); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_party_member_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE active boolean; n int;
BEGIN
  PERFORM public.onboarding_lock(NEW.user_id, NEW.party_id);
  SELECT p.is_active INTO active FROM public.parties p WHERE p.id = NEW.party_id;
  IF active IS NULL THEN RAISE EXCEPTION 'Party not found' USING ERRCODE='P0002'; END IF;
  IF NOT active THEN RAISE EXCEPTION 'Party is not active' USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM public.party_members m JOIN public.parties p ON p.id = m.party_id
             WHERE m.user_id = NEW.user_id AND p.is_active AND m.party_id <> NEW.party_id) THEN
    RAISE EXCEPTION 'You are already in a party. Leave first.' USING ERRCODE='23505';
  END IF;
  SELECT count(*) INTO n FROM public.party_members m WHERE m.party_id = NEW.party_id;
  IF n >= 6 THEN RAISE EXCEPTION 'Party is full (max 6)' USING ERRCODE='53400'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_party_member_insert BEFORE INSERT ON public.party_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_party_member_insert();

CREATE OR REPLACE FUNCTION public.onboarding_rate_ok(_user_id uuid, _kind text, _max int, _window interval)
RETURNS boolean LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.party_onboarding_rate_events e
    WHERE e.user_id = _user_id AND e.kind = _kind AND e.created_at > now() - _window;
  IF n >= _max THEN RETURN false; END IF;
  INSERT INTO public.party_onboarding_rate_events (user_id, kind) VALUES (_user_id, _kind);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_session_json(_s public.party_creation_sessions, _status text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('status', _status, 'sessionId', _s.id, 'partyId', _s.party_id,
    'reservedSaveId', _s.reserved_save_id, 'sessionStatus', _s.status, 'draft', _s.draft,
    'draftRevision', _s.draft_revision, 'contextRevision', _s.context_revision,
    'completedSaveId', _s.completed_save_id, 'completedAt', _s.completed_at,
    'campaignLabel', (SELECT coalesce(nullif(btrim(c.player_context->>'campaignLabel'),''), 'Party campaign')
                        FROM public.party_creation_contexts c WHERE c.party_id = _s.party_id),
    'playerContext', (SELECT CASE WHEN c.status = 'ready' THEN c.player_context END
                        FROM public.party_creation_contexts c WHERE c.party_id = _s.party_id),
    'startingRules', (SELECT CASE WHEN c.status = 'ready' THEN c.starting_rules END
                        FROM public.party_creation_contexts c WHERE c.party_id = _s.party_id))
$$;

CREATE OR REPLACE FUNCTION public.onboarding_gate(_user_id uuid, _party_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE active boolean; n int;
BEGIN
  SELECT p.is_active INTO active FROM public.parties p WHERE p.id = _party_id;
  IF active IS NULL OR NOT active THEN RETURN 'party_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = _party_id AND m.user_id = _user_id) THEN RETURN 'already_member'; END IF;
  IF EXISTS (SELECT 1 FROM public.party_members m JOIN public.parties p ON p.id = m.party_id
             WHERE m.user_id = _user_id AND p.is_active AND m.party_id <> _party_id) THEN RETURN 'conflict'; END IF;
  SELECT count(*) INTO n FROM public.party_members m WHERE m.party_id = _party_id;
  IF n >= 6 THEN RETURN 'full'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_context_state(_party_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE st text;
BEGIN
  INSERT INTO public.party_creation_contexts (party_id) VALUES (_party_id) ON CONFLICT (party_id) DO NOTHING;
  SELECT c.status INTO st FROM public.party_creation_contexts c WHERE c.party_id = _party_id;
  RETURN st;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_begin(_user_id uuid, _link_code text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE code text := upper(btrim(coalesce(_link_code,''))); pid uuid; gate text; s public.party_creation_sessions; ctx text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
  IF NOT public.onboarding_rate_ok(_user_id, 'begin', 20, interval '10 minutes') THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
  IF code !~ '^[A-Z0-9]{6}$' THEN RETURN jsonb_build_object('status','invalid_code'); END IF;
  SELECT p.id INTO pid FROM public.parties p WHERE p.link_code = code AND p.is_active;
  IF pid IS NULL THEN RETURN jsonb_build_object('status','invalid_code'); END IF;
  PERFORM public.onboarding_lock(_user_id, pid);
  gate := public.onboarding_gate(_user_id, pid);
  IF gate IS NOT NULL THEN RETURN jsonb_build_object('status', gate, 'partyId', CASE WHEN gate = 'already_member' THEN pid END); END IF;
  SELECT * INTO s FROM public.party_creation_sessions x WHERE x.party_id = pid AND x.user_id = _user_id FOR UPDATE;
  IF FOUND AND s.status = 'complete' THEN
    RETURN jsonb_build_object('status','receipt_not_rejoinable','partyId',pid);
  END IF;
  IF NOT FOUND THEN
    IF NOT public.onboarding_rate_ok(_user_id, 'create', 5, interval '1 hour') THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
    INSERT INTO public.party_creation_sessions (party_id, user_id) VALUES (pid, _user_id) RETURNING * INTO s;
  ELSIF s.status = 'cancelled' THEN
    UPDATE public.party_creation_sessions x SET status = 'in_progress' WHERE x.id = s.id RETURNING * INTO s;
  END IF;
  ctx := public.onboarding_context_state(pid);
  RETURN public.onboarding_session_json(s, CASE WHEN ctx = 'ready' THEN 'ready' WHEN ctx = 'error' THEN 'context_error' ELSE 'preparing' END);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_list(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'sessionId', s.id, 'partyId', s.party_id, 'reservedSaveId', s.reserved_save_id, 'sessionStatus', s.status,
      'draftRevision', s.draft_revision, 'contextRevision', s.context_revision,
      'completedSaveId', s.completed_save_id, 'completedAt', s.completed_at, 'updatedAt', s.updated_at,
      'campaignLabel', coalesce(nullif(btrim(c.player_context->>'campaignLabel'),''), 'Party campaign'))
      ORDER BY s.updated_at DESC)
    FROM public.party_creation_sessions s
    JOIN public.parties p ON p.id = s.party_id AND p.is_active
    LEFT JOIN public.party_creation_contexts c ON c.party_id = s.party_id
    WHERE s.user_id = _user_id AND (
      s.status = 'in_progress'
      OR (s.status = 'complete' AND s.completed_save_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.party_members m WHERE m.id = s.completed_member_id AND m.user_id = _user_id AND m.party_id = s.party_id)
          AND EXISTS (SELECT 1 FROM public.character_saves cs WHERE cs.id = s.completed_save_id AND cs.user_id = _user_id)))), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_resume(_user_id uuid, _session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE s public.party_creation_sessions; gate text; ctx text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.party_creation_sessions x WHERE x.id = _session_id AND x.user_id = _user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF s.status = 'complete' THEN RETURN public.onboarding_session_json(s, 'complete'); END IF;
  IF s.status = 'cancelled' THEN RETURN jsonb_build_object('status','cancelled','sessionId',s.id); END IF;
  PERFORM public.onboarding_lock(_user_id, s.party_id);
  gate := public.onboarding_gate(_user_id, s.party_id);
  IF gate IS NOT NULL THEN RETURN jsonb_build_object('status', gate, 'sessionId', s.id, 'partyId', s.party_id); END IF;
  ctx := public.onboarding_context_state(s.party_id);
  RETURN public.onboarding_session_json(s, CASE WHEN ctx = 'ready' THEN 'ready' WHEN ctx = 'error' THEN 'context_error' ELSE 'preparing' END);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_save_draft(_user_id uuid, _session_id uuid, _expected_revision integer, _draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE s public.party_creation_sessions;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
  IF NOT public.onboarding_rate_ok(_user_id, 'draft', 240, interval '10 minutes') THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
  IF jsonb_typeof(_draft) IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status','invalid_draft'); END IF;
  IF octet_length(_draft::text) > 262144 THEN RETURN jsonb_build_object('status','draft_too_large'); END IF;
  UPDATE public.party_creation_sessions x SET draft = _draft, draft_revision = x.draft_revision + 1
    WHERE x.id = _session_id AND x.user_id = _user_id AND x.status = 'in_progress' AND x.draft_revision = _expected_revision
    RETURNING * INTO s;
  IF NOT FOUND THEN
    SELECT * INTO s FROM public.party_creation_sessions x WHERE x.id = _session_id AND x.user_id = _user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
    IF s.status <> 'in_progress' THEN RETURN jsonb_build_object('status','not_editable','sessionStatus',s.status); END IF;
    RETURN jsonb_build_object('status','stale','draftRevision',s.draft_revision);
  END IF;
  RETURN jsonb_build_object('status','saved','sessionId',s.id,'draftRevision',s.draft_revision);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_context_update(_party_id uuid, _expected_revision integer, _source_fingerprint text,
  _manifest jsonb, _player_context jsonb, _starting_rules jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE c public.party_creation_contexts; unresolved int; st text;
BEGIN
  IF _source_fingerprint IS NULL OR btrim(_source_fingerprint) = '' OR char_length(_source_fingerprint) > 200 THEN RAISE EXCEPTION 'Missing source fingerprint' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_manifest) IS DISTINCT FROM 'object' OR jsonb_typeof(_player_context) IS DISTINCT FROM 'object' OR jsonb_typeof(_starting_rules) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Context parts must be objects' USING ERRCODE='22023'; END IF;
  IF octet_length(_manifest::text) + octet_length(_player_context::text) + octet_length(_starting_rules::text) > 1048576 THEN
    RAISE EXCEPTION 'Context over 1 MiB' USING ERRCODE='22023'; END IF;
  IF coalesce(jsonb_typeof(_starting_rules->'unresolved'),'array') <> 'array' THEN RAISE EXCEPTION 'unresolved must be a list' USING ERRCODE='22023'; END IF;
  INSERT INTO public.party_creation_contexts (party_id) VALUES (_party_id) ON CONFLICT (party_id) DO NOTHING;
  SELECT * INTO c FROM public.party_creation_contexts x WHERE x.party_id = _party_id FOR UPDATE;
  IF c.revision <> _expected_revision THEN RETURN jsonb_build_object('status','stale','revision',c.revision); END IF;
  unresolved := jsonb_array_length(coalesce(_starting_rules->'unresolved','[]'::jsonb));
  st := CASE WHEN unresolved > 0 THEN 'error' ELSE 'ready' END;
  UPDATE public.party_creation_contexts x SET source_fingerprint = _source_fingerprint, private_source_manifest = _manifest,
    player_context = _player_context, starting_rules = _starting_rules, revision = x.revision + 1, status = st
    WHERE x.party_id = _party_id RETURNING * INTO c;
  RETURN jsonb_build_object('status', st, 'revision', c.revision);
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_mark_context_stale(_party_id uuid)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $$
  INSERT INTO public.party_creation_contexts (party_id) VALUES (_party_id)
  ON CONFLICT (party_id) DO UPDATE SET status = 'building';
$$;

CREATE OR REPLACE FUNCTION public.onboarding_finite(_v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_typeof(_v) = 'number', false)
$$;

CREATE OR REPLACE FUNCTION public.onboarding_finalize(_user_id uuid, _session_id uuid, _expected_draft_revision integer,
  _expected_context_revision integer, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  s public.party_creation_sessions; c public.party_creation_contexts; p record; gate text;
  ch jsonb; ext jsonb; hp jsonb; lvl numeric; gold numeric; xp numeric; nm text; base text; i int := 1;
  cls text; rules jsonb; status_json jsonb; mid uuid; k text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.party_creation_sessions x WHERE x.id = _session_id AND x.user_id = _user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  PERFORM public.onboarding_lock(_user_id, s.party_id);
  SELECT * INTO s FROM public.party_creation_sessions x WHERE x.id = _session_id FOR UPDATE;

  IF s.status = 'complete' THEN
    IF s.completed_save_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.character_saves cs WHERE cs.id = s.completed_save_id AND cs.user_id = _user_id)
       AND EXISTS (SELECT 1 FROM public.party_members m WHERE m.id = s.completed_member_id AND m.user_id = _user_id AND m.party_id = s.party_id) THEN
      RETURN public.onboarding_session_json(s, 'complete') || jsonb_build_object('memberId', s.completed_member_id, 'replayed', true);
    END IF;
    RETURN jsonb_build_object('status','receipt_invalid','sessionId',s.id,'message','This finished character no longer matches its party seat. Ask the host for help.');
  END IF;
  IF s.status <> 'in_progress' THEN RETURN jsonb_build_object('status','not_editable','sessionStatus',s.status); END IF;
  IF NOT public.onboarding_rate_ok(_user_id, 'finalize', 10, interval '1 hour') THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
  IF s.draft_revision <> _expected_draft_revision THEN RETURN jsonb_build_object('status','stale_draft','draftRevision',s.draft_revision); END IF;

  SELECT x.id, x.is_active, x.campaign_type INTO p FROM public.parties x WHERE x.id = s.party_id FOR NO KEY UPDATE;
  gate := public.onboarding_gate(_user_id, s.party_id);
  IF gate IS NOT NULL THEN RETURN jsonb_build_object('status', gate); END IF;
  SELECT * INTO c FROM public.party_creation_contexts x WHERE x.party_id = s.party_id FOR SHARE;
  IF NOT FOUND OR c.status <> 'ready' THEN RETURN jsonb_build_object('status','preparing'); END IF;
  IF c.revision <> _expected_context_revision THEN RETURN jsonb_build_object('status','stale_context','contextRevision',c.revision); END IF;
  rules := c.starting_rules;
  IF jsonb_array_length(coalesce(rules->'unresolved','[]'::jsonb)) > 0 THEN RETURN jsonb_build_object('status','rules_unresolved'); END IF;

  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR octet_length(_payload::text) > 2097152 THEN RETURN jsonb_build_object('status','invalid_payload','field','payload'); END IF;
  FOREACH k IN ARRAY ARRAY['user_id','userId','id','partyId','party_id','reservedSaveId'] LOOP
    IF _payload ? k THEN RETURN jsonb_build_object('status','invalid_payload','field',k); END IF;
  END LOOP;
  ch := _payload->'character'; ext := coalesce(_payload->'extended','{}'::jsonb);
  IF jsonb_typeof(ch) IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status','invalid_payload','field','character'); END IF;
  IF jsonb_typeof(ext) <> 'object' THEN RETURN jsonb_build_object('status','invalid_payload','field','extended'); END IF;
  IF jsonb_typeof(_payload->'equipment') IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status','invalid_payload','field','equipment'); END IF;
  IF coalesce(jsonb_typeof(_payload->'achievements'),'array') <> 'array' OR coalesce(jsonb_typeof(_payload->'consumables'),'array') <> 'array' THEN
    RETURN jsonb_build_object('status','invalid_payload','field','lists'); END IF;
  IF jsonb_typeof(_payload->'xp') IS DISTINCT FROM 'object' OR jsonb_typeof(_payload->'prestige') IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('status','invalid_payload','field','progress'); END IF;
  IF jsonb_typeof(ch->'abilities') IS DISTINCT FROM 'array' OR jsonb_typeof(ch->'equippedAbilities') IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('status','invalid_payload','field','abilities'); END IF;
  IF ext ? 'scopedLocalStorage' AND jsonb_typeof(ext->'scopedLocalStorage') <> 'object' THEN RETURN jsonb_build_object('status','invalid_payload','field','scopedLocalStorage'); END IF;
  IF ext ? 'homebrewSpellLibrary' AND jsonb_typeof(ext->'homebrewSpellLibrary') <> 'string' THEN RETURN jsonb_build_object('status','invalid_payload','field','homebrewSpellLibrary'); END IF;

  nm := btrim(coalesce(ch->>'name',''));
  IF jsonb_typeof(ch->'name') IS DISTINCT FROM 'string' OR nm = '' OR char_length(nm) > 60 THEN RETURN jsonb_build_object('status','invalid_payload','field','name'); END IF;
  IF NOT public.onboarding_finite(ch->'level') THEN RETURN jsonb_build_object('status','invalid_payload','field','level'); END IF;
  lvl := (ch->>'level')::numeric;
  IF lvl <> trunc(lvl) OR lvl < 1 OR lvl > 20 THEN RETURN jsonb_build_object('status','invalid_payload','field','level'); END IF;
  IF public.onboarding_finite(rules->'startingLevel') AND lvl <> (rules->>'startingLevel')::numeric THEN RETURN jsonb_build_object('status','rule_mismatch','field','level'); END IF;

  hp := ext->'hpState';
  IF jsonb_typeof(hp) IS DISTINCT FROM 'object' OR NOT public.onboarding_finite(hp->'current') OR NOT public.onboarding_finite(hp->'max') THEN
    RETURN jsonb_build_object('status','invalid_payload','field','hp'); END IF;
  IF (hp->>'max')::numeric <= 0 OR (hp->>'current')::numeric < 0 OR (hp->>'current')::numeric > (hp->>'max')::numeric
     OR (hp ? 'temp' AND (NOT public.onboarding_finite(hp->'temp') OR (hp->>'temp')::numeric < 0)) THEN
    RETURN jsonb_build_object('status','invalid_payload','field','hp'); END IF;
  gold := 0;
  IF ext ? 'shopGold' THEN
    IF NOT public.onboarding_finite(ext->'shopGold') OR (ext->>'shopGold')::numeric < 0 THEN RETURN jsonb_build_object('status','invalid_payload','field','gold'); END IF;
    gold := (ext->>'shopGold')::numeric;
  END IF;
  IF public.onboarding_finite(rules->'startingGold') AND gold > (rules->>'startingGold')::numeric THEN RETURN jsonb_build_object('status','rule_mismatch','field','gold'); END IF;
  IF NOT public.onboarding_finite(_payload->'xp'->'currentXP') OR (_payload->'xp'->>'currentXP')::numeric < 0 THEN RETURN jsonb_build_object('status','invalid_payload','field','xp'); END IF;
  xp := (_payload->'xp'->>'currentXP')::numeric;
  FOREACH k IN ARRAY ARRAY['prestigeXP','prestigeLevel','totalPrestigePoints'] LOOP
    IF _payload->'prestige' ? k AND (NOT public.onboarding_finite(_payload->'prestige'->k) OR (_payload->'prestige'->>k)::numeric < 0) THEN
      RETURN jsonb_build_object('status','invalid_payload','field',k); END IF;
  END LOOP;
  cls := ch->>'primaryClass';
  IF cls IS NOT NULL AND cls !~ '^[a-z][a-z_-]{1,39}$' THEN RETURN jsonb_build_object('status','invalid_payload','field','class'); END IF;
  IF jsonb_typeof(rules->'allowedClasses') = 'array' AND (cls IS NULL OR NOT ((rules->'allowedClasses') ? cls)) THEN
    RETURN jsonb_build_object('status','rule_mismatch','field','class'); END IF;
  IF jsonb_typeof(rules->'allowedRaces') = 'array'
     AND NOT ((rules->'allowedRaces') ? coalesce(ext->'characterIdentity'->>'race','')) THEN
    RETURN jsonb_build_object('status','rule_mismatch','field','race'); END IF;

  ext := ext || jsonb_build_object('partyId', s.party_id::text, 'campaignType', coalesce(p.campaign_type,'dnd'));

  base := left(nm, 60);
  WHILE EXISTS (SELECT 1 FROM public.character_saves cs WHERE cs.user_id = _user_id AND cs.save_name = CASE WHEN i = 1 THEN base ELSE base || ' (' || i || ')' END) LOOP
    i := i + 1;
    IF i > 50 THEN RETURN jsonb_build_object('status','name_taken'); END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.character_saves cs WHERE cs.id = s.reserved_save_id) THEN
    RETURN jsonb_build_object('status','receipt_invalid','message','The reserved character slot is already used.');
  END IF;

  INSERT INTO public.character_saves (id, user_id, save_name, character_data, equipment_data, achievements_data,
      consumables_data, prestige_data, xp_data, extended_data)
    VALUES (s.reserved_save_id, _user_id, CASE WHEN i = 1 THEN base ELSE base || ' (' || i || ')' END, ch, _payload->'equipment',
      coalesce(_payload->'achievements','[]'::jsonb), coalesce(_payload->'consumables','[]'::jsonb), _payload->'prestige', _payload->'xp', ext);

  status_json := jsonb_strip_nulls(jsonb_build_object(
    'characterSaveId', s.reserved_save_id, 'level', lvl, 'className', cls,
    'currentHP', (hp->>'current')::numeric, 'maxHP', (hp->>'max')::numeric, 'tempHP', coalesce((hp->>'temp')::numeric, 0),
    'race', ext->'characterIdentity'->>'race', 'portraitIcon', ch->>'portraitIcon', 'gold', gold, 'xp', xp));
  INSERT INTO public.party_members (party_id, user_id, character_name, character_status, onboarding_status, onboarding_started_at, onboarding_completed_at)
    VALUES (s.party_id, _user_id, nm, status_json, 'complete', s.created_at, now()) RETURNING id INTO mid;

  UPDATE public.party_creation_sessions x SET status = 'complete', completed_save_id = s.reserved_save_id, completed_member_id = mid,
    completed_at = now(), context_revision = c.revision WHERE x.id = s.id RETURNING * INTO s;
  RETURN public.onboarding_session_json(s, 'complete') || jsonb_build_object('memberId', mid, 'replayed', false);
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.onboarding_lock(uuid,uuid)','public.guard_party_member_insert()','public.onboarding_rate_ok(uuid,text,integer,interval)',
    'public.onboarding_session_json(public.party_creation_sessions,text)','public.onboarding_gate(uuid,uuid)','public.onboarding_context_state(uuid)',
    'public.onboarding_begin(uuid,text)','public.onboarding_list(uuid)','public.onboarding_resume(uuid,uuid)',
    'public.onboarding_save_draft(uuid,uuid,integer,jsonb)','public.onboarding_context_update(uuid,integer,text,jsonb,jsonb,jsonb)',
    'public.onboarding_mark_context_stale(uuid)','public.onboarding_finite(jsonb)','public.onboarding_finalize(uuid,uuid,integer,integer,jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;