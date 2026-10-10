-- Live NPCs v2 (DECISIONS D-22, v2): lasting NPC memory, NPC attitudes toward each
-- character, spell reactions, roll requests and NPC-to-NPC scenes.
-- Memory notes are host-only. A player can read only their own attitude rows.
-- The npc-reply and npc-memory server functions write with the service role.

-- 1. The host can switch spell reactions off per NPC (on by default).
ALTER TABLE public.party_npcs
  ADD COLUMN reacts_to_spells boolean NOT NULL DEFAULT true;

-- 2. What kind of answer a reply record is. A scene's opening line answers no player
--    line, so only scene records may leave prompt_message_id empty.
ALTER TABLE public.party_npc_replies
  ADD COLUMN kind text NOT NULL DEFAULT 'reply';

ALTER TABLE public.party_npc_replies
  ADD CONSTRAINT party_npc_replies_kind_check CHECK (kind IN ('reply', 'spell', 'roll', 'banter'));

ALTER TABLE public.party_npc_replies
  ALTER COLUMN prompt_message_id DROP NOT NULL;

ALTER TABLE public.party_npc_replies
  ADD CONSTRAINT party_npc_replies_prompt_needed CHECK (prompt_message_id IS NOT NULL OR kind = 'banter');

-- 3. What each NPC remembers from earlier scenes. Host and server only.
CREATE TABLE public.party_npc_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL,
  party_id uuid NOT NULL,
  note text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_npc_memories_npc_fk FOREIGN KEY (npc_id, party_id)
    REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE,
  CONSTRAINT party_npc_memories_note_length CHECK (char_length(btrim(note)) BETWEEN 1 AND 300),
  CONSTRAINT party_npc_memories_source_check CHECK (source IN ('ai', 'host'))
);

CREATE INDEX party_npc_memories_npc_idx
  ON public.party_npc_memories (npc_id, created_at DESC);

-- 4. Which NPC lines were already turned into memory, so a retried hand-off
--    never remembers the same scene twice. Server only.
CREATE TABLE public.party_npc_memory_log (
  npc_id uuid NOT NULL,
  party_id uuid NOT NULL,
  line_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npc_id, line_id),
  CONSTRAINT party_npc_memory_log_npc_fk FOREIGN KEY (npc_id, party_id)
    REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE
);

-- 5. How each NPC feels about each seated character: -2 Hostile, -1 Wary,
--    0 Neutral, 1 Friendly, 2 Loyal.
CREATE TABLE public.party_npc_attitudes (
  npc_id uuid NOT NULL,
  party_id uuid NOT NULL,
  user_id uuid NOT NULL,
  character_name text NOT NULL DEFAULT '',
  score smallint NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npc_id, user_id),
  CONSTRAINT party_npc_attitudes_npc_fk FOREIGN KEY (npc_id, party_id)
    REFERENCES public.party_npcs (id, party_id) ON DELETE CASCADE,
  CONSTRAINT party_npc_attitudes_score_range CHECK (score BETWEEN -2 AND 2),
  CONSTRAINT party_npc_attitudes_reason_length CHECK (char_length(reason) <= 300),
  CONSTRAINT party_npc_attitudes_updated_by_check CHECK (updated_by IN ('ai', 'host'))
);

CREATE INDEX party_npc_attitudes_party_idx
  ON public.party_npc_attitudes (party_id);

-- 6. Keep updated_at current (the project's existing helper).
CREATE TRIGGER party_npc_memories_updated_at
  BEFORE UPDATE ON public.party_npc_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER party_npc_attitudes_updated_at
  BEFORE UPDATE ON public.party_npc_attitudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Row level security.
ALTER TABLE public.party_npc_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_npc_memory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_npc_attitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only the host can read NPC memories"
  ON public.party_npc_memories FOR SELECT TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can add NPC memories"
  ON public.party_npc_memories FOR INSERT TO authenticated
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can change NPC memories"
  ON public.party_npc_memories FOR UPDATE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id))
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can delete NPC memories"
  ON public.party_npc_memories FOR DELETE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

-- The memory log has no policies on purpose: only the server (service role) uses it.

CREATE POLICY "Host sees all NPC attitudes, players see their own"
  ON public.party_npc_attitudes FOR SELECT TO authenticated
  USING (
    public.is_party_host(auth.uid(), party_id)
    OR (user_id = auth.uid() AND public.is_party_member(auth.uid(), party_id))
  );

CREATE POLICY "Only the host can add NPC attitudes"
  ON public.party_npc_attitudes FOR INSERT TO authenticated
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can change NPC attitudes"
  ON public.party_npc_attitudes FOR UPDATE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id))
  WITH CHECK (public.is_party_host(auth.uid(), party_id));

CREATE POLICY "Only the host can delete NPC attitudes"
  ON public.party_npc_attitudes FOR DELETE TO authenticated
  USING (public.is_party_host(auth.uid(), party_id));

-- 8. Live updates for attitudes (a player's badge changes as soon as the NPC warms up).
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_npc_attitudes;