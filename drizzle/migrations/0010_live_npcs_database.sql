-- Live NPCs at the table (DECISIONS D-22).
-- Players talk to AI-voiced NPCs in the Live Table. The host keeps an NPC roster;
-- each NPC's guide and secrets are readable only by the host and the npc-reply
-- server function. NPC lines are ordinary Live Table rows marked with npc_id.

-- 1. Is this user the party's original host?
CREATE OR REPLACE FUNCTION public.is_party_host(_user_id uuid, _party_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parties
    WHERE id = _party_id AND created_by = _user_id
  )
$$;

-- 2. The NPC roster. Members may read it (names, portraits, who is on stage).
--    Only the host may change it. Guides and secrets live in party_npc_guides.
CREATE TABLE public.party_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  name text NOT NULL,
  portrait_url text,
  model text NOT NULL DEFAULT 'venice/qwen-3-6-plus',
  on_stage boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_npcs_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  CONSTRAINT party_npcs_archived_off_stage CHECK (NOT (archived AND on_stage)),
  CONSTRAINT party_npcs_id_party_unique UNIQUE (id, party_id)
);

CREATE UNIQUE INDEX party_npcs_party_name_unique
  ON public.party_npcs (party_id, lower(btrim(name)))
  WHERE NOT archived;

-- 3. Each NPC's guide and secrets. Host only; the server reads them with the service role.
CREATE TABLE public.party_npc_guides (
  npc_id uuid PRIMARY KEY,
  party_id uuid NOT NULL,
  guide text NOT NULL DEFAULT '',
  secrets text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_npc_guides_npc_fk FOREIGN KEY (npc_id, party_id)
    REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE,
  CONSTRAINT party_npc_guides_guide_length CHECK (char_length(guide) <= 20000),
  CONSTRAINT party_npc_guides_secrets_length CHECK (char_length(secrets) <= 10000)
);

-- 4. Live Table lines spoken by an NPC. The NPC must belong to the same party as the line.
ALTER TABLE public.party_round_chat ADD COLUMN npc_id uuid;

ALTER TABLE public.party_round_chat
  ADD CONSTRAINT party_round_chat_npc_fk FOREIGN KEY (npc_id, party_id)
  REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE;

CREATE INDEX party_round_chat_npc_idx
  ON public.party_round_chat (npc_id)
  WHERE npc_id IS NOT NULL;

-- 5. One record per NPC reply: which model answered, whether it fell back and why.
--    The unique key stops a line from being answered twice by the same NPC.
CREATE TABLE public.party_npc_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL,
  npc_id uuid NOT NULL,
  prompt_message_id uuid NOT NULL REFERENCES public.party_round_chat(id) ON DELETE CASCADE,
  reply_message_id uuid REFERENCES public.party_round_chat(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL,
  model_requested text NOT NULL,
  model_used text,
  fell_back boolean NOT NULL DEFAULT false,
  fallback_reason text,
  error text,
  latency_ms integer,
  cost_usd numeric(10, 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_npc_replies_npc_fk FOREIGN KEY (npc_id, party_id)
    REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE,
  CONSTRAINT party_npc_replies_one_per_line UNIQUE (prompt_message_id, npc_id)
);

CREATE INDEX party_npc_replies_party_idx
  ON public.party_npc_replies (party_id, created_at DESC);

-- 6. Keep updated_at current (the project's existing helper).
CREATE TRIGGER party_npcs_updated_at
  BEFORE UPDATE ON public.party_npcs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER party_npc_guides_updated_at
  BEFORE UPDATE ON public.party_npc_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER party_npc_replies_updated_at
  BEFORE UPDATE ON public.party_npc_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Row level security.
ALTER TABLE public.party_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_npc_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_npc_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can see the NPC roster"
  ON public.party_npcs FOR SELECT TO authenticated
  USING (public.is_party_member(auth.uid(), party_id) OR public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Host can add NPCs"
  ON public.party_npcs FOR INSERT TO authenticated
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Host can change NPCs"
  ON public.party_npcs FOR UPDATE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id))
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Host can delete NPCs"
  ON public.party_npcs FOR DELETE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can read NPC guides"
  ON public.party_npc_guides FOR SELECT TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can add NPC guides"
  ON public.party_npc_guides FOR INSERT TO authenticated
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can change NPC guides"
  ON public.party_npc_guides FOR UPDATE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id))
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can delete NPC guides"
  ON public.party_npc_guides FOR DELETE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

-- Reply records: the host may read them; only the server (service role) writes them.
CREATE POLICY "Host can read NPC reply records"
  ON public.party_npc_replies FOR SELECT TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

-- 8. Live Table posting: anyone may still post their own lines,
--    but only the host may post a line as an NPC (puppet mode).
DROP POLICY "Members can post their own round chat" ON public.party_round_chat;

CREATE POLICY "Members can post their own round chat"
  ON public.party_round_chat FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_party_member(auth.uid(), party_id)
    AND (npc_id IS NULL OR public.is_party_host(auth.uid(), party_id))
  );

-- 9. Members may still seal and unseal any line, but only the host (or the server)
--    may mark a line as an NPC's or change what an NPC said.
CREATE OR REPLACE FUNCTION public.guard_party_round_chat_npc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The server (service role) and direct database access (no signed-in user) are not limited here.
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.npc_id IS DISTINCT FROM OLD.npc_id
     OR (OLD.npc_id IS NOT NULL AND (
          NEW.content IS DISTINCT FROM OLD.content
       OR NEW.character_name IS DISTINCT FROM OLD.character_name
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.in_character IS DISTINCT FROM OLD.in_character
       OR NEW.party_id IS DISTINCT FROM OLD.party_id)) THEN
    IF NOT public.is_party_host(auth.uid(), OLD.party_id) THEN
      RAISE EXCEPTION 'Only the host can change what an NPC said' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_party_round_chat_npc
  BEFORE UPDATE ON public.party_round_chat
  FOR EACH ROW EXECUTE FUNCTION public.guard_party_round_chat_npc();

-- 10. Live updates for the roster (who is on stage).
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_npcs;