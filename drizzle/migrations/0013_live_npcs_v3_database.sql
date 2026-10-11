-- Live NPCs v3 (DECISIONS D-22, v3): NPCs that feel like real people.
-- Structured guide fields (host only), a mood everyone can see, when each NPC came on
-- stage (it only knows what it heard since), kinds of memory (events, unfinished
-- business, facts about itself), and per-character knowledge (name learned, last seen).

-- 1. Structured guide fields. Same rules as the guide: host and server only.
ALTER TABLE public.party_npc_guides
  ADD COLUMN wants text NOT NULL DEFAULT '',
  ADD COLUMN levers text NOT NULL DEFAULT '',
  ADD COLUMN hard_lines text NOT NULL DEFAULT '',
  ADD COLUMN mood_range text NOT NULL DEFAULT '',
  ADD COLUMN grudge_style text NOT NULL DEFAULT 'normal';

ALTER TABLE public.party_npc_guides
  ADD CONSTRAINT party_npc_guides_fields_length CHECK (
    char_length(wants) <= 2000 AND char_length(levers) <= 2000
    AND char_length(hard_lines) <= 2000 AND char_length(mood_range) <= 500);

ALTER TABLE public.party_npc_guides
  ADD CONSTRAINT party_npc_guides_grudge_style_check CHECK (grudge_style IN ('forgiving', 'normal', 'grudge'));

-- 2. The NPC's current mood (players see it as an emoji) and when it came on stage.
ALTER TABLE public.party_npcs
  ADD COLUMN mood text NOT NULL DEFAULT 'calm',
  ADD COLUMN on_stage_since timestamptz;

ALTER TABLE public.party_npcs
  ADD CONSTRAINT party_npcs_mood_check CHECK (mood IN ('calm', 'amused', 'pleased', 'suspicious', 'annoyed', 'angry', 'scared', 'sad'));

-- on_stage_since is kept by the database: set when an NPC goes on stage, cleared when it
-- leaves. A phone can't change it.
CREATE OR REPLACE FUNCTION public.party_npcs_stage_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.on_stage AND (TG_OP = 'INSERT' OR NOT OLD.on_stage) THEN
    NEW.on_stage_since := now();
  ELSIF NOT NEW.on_stage THEN
    NEW.on_stage_since := NULL;
  ELSE
    NEW.on_stage_since := OLD.on_stage_since;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER party_npcs_stage_time
  BEFORE INSERT OR UPDATE ON public.party_npcs
  FOR EACH ROW EXECUTE FUNCTION public.party_npcs_stage_time();

-- 3. The mood an NPC line was said in. Only NPC lines carry one.
ALTER TABLE public.party_round_chat ADD COLUMN npc_mood text;

ALTER TABLE public.party_round_chat
  ADD CONSTRAINT party_round_chat_npc_mood_check CHECK (
    npc_mood IS NULL OR (npc_id IS NOT NULL AND npc_mood IN ('calm', 'amused', 'pleased', 'suspicious', 'annoyed', 'angry', 'scared', 'sad')));

-- The guard from Live NPCs v1, now also protecting an NPC line's mood.
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
       OR NEW.party_id IS DISTINCT FROM OLD.party_id
       OR NEW.npc_mood IS DISTINCT FROM OLD.npc_mood)) THEN
    IF NOT public.is_party_host(auth.uid(), OLD.party_id) THEN
      RAISE EXCEPTION 'Only the host can change what an NPC said' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Kinds of memory: what happened, unfinished business, and facts the NPC said about itself.
ALTER TABLE public.party_npc_memories
  ADD COLUMN kind text NOT NULL DEFAULT 'event';

ALTER TABLE public.party_npc_memories
  ADD CONSTRAINT party_npc_memories_kind_check CHECK (kind IN ('event', 'thread', 'self'));

-- 5. What each NPC knows about each character: their name, and when they last spoke.
ALTER TABLE public.party_npc_attitudes
  ADD COLUMN knows_name boolean NOT NULL DEFAULT false,
  ADD COLUMN last_seen_at timestamptz;
