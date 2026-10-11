-- Live NPC Combat 1/8

-- 1. The host's combat stat block for each NPC, and whether it was knocked out or killed.
ALTER TABLE public.party_npcs
  ADD COLUMN IF NOT EXISTS combat_stats jsonb,
  ADD COLUMN IF NOT EXISTS combat_state text;
ALTER TABLE public.party_npcs DROP CONSTRAINT IF EXISTS party_npcs_combat_state_check;
ALTER TABLE public.party_npcs
  ADD CONSTRAINT party_npcs_combat_state_check CHECK (combat_state IS NULL OR combat_state IN ('ko', 'dead'));

-- 2. One fight per party at a time.
CREATE TABLE public.party_fights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('victory', 'defeat', 'host_ended')),
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX party_fights_one_open_per_party ON public.party_fights (party_id) WHERE status <> 'ended';
CREATE INDEX party_fights_party_started ON public.party_fights (party_id, started_at DESC);

-- 3. Everyone in a fight: NPCs and players. The server is the only writer.
CREATE TABLE public.party_fight_combatants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES public.party_fights(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('npc', 'player')),
  npc_id uuid REFERENCES public.party_npcs(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  hp integer NOT NULL CHECK (hp >= 0),
  max_hp integer NOT NULL CHECK (max_hp >= 1),
  ac integer NOT NULL,
  status text NOT NULL DEFAULT 'up' CHECK (status IN ('up', 'down', 'stable', 'dead', 'ko')),
  death_successes integer NOT NULL DEFAULT 0 CHECK (death_successes BETWEEN 0 AND 3),
  death_failures integer NOT NULL DEFAULT 0 CHECK (death_failures BETWEEN 0 AND 3),
  next_action_at timestamptz,
  next_save_at timestamptz,
  action_seq integer NOT NULL DEFAULT 0,
  threat jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  last_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'npc' AND npc_id IS NOT NULL AND user_id IS NULL) OR (kind = 'player' AND user_id IS NOT NULL AND npc_id IS NULL))
);
CREATE UNIQUE INDEX party_fight_combatants_one_npc ON public.party_fight_combatants (fight_id, npc_id) WHERE npc_id IS NOT NULL;
CREATE UNIQUE INDEX party_fight_combatants_one_player ON public.party_fight_combatants (fight_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX party_fight_combatants_party ON public.party_fight_combatants (party_id);

-- 4. Every attack, heal and save. Rows with target_user_id are that player's HP inbox.
CREATE TABLE public.party_fight_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES public.party_fights(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('start', 'join', 'attack', 'spell', 'heal', 'down', 'death_save', 'stabilize', 'death', 'revive', 'defeat_npc', 'sync', 'pause', 'resume', 'end')),
  actor_name text NOT NULL DEFAULT '',
  target_name text NOT NULL DEFAULT '',
  target_user_id uuid,
  hp_delta integer NOT NULL DEFAULT 0,
  d20 integer,
  total integer,
  detail text NOT NULL DEFAULT '',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX party_fight_events_fight ON public.party_fight_events (fight_id, created_at);
CREATE INDEX party_fight_events_inbox ON public.party_fight_events (target_user_id, created_at) WHERE hp_delta <> 0 AND applied_at IS NULL;

-- 5. Characters who died in a fight. Never deletes anything; the host can revive.
CREATE TABLE public.party_character_deaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text NOT NULL,
  fight_id uuid REFERENCES public.party_fights(id) ON DELETE SET NULL,
  died_at timestamptz NOT NULL DEFAULT now(),
  revived_at timestamptz,
  revived_by uuid
);
CREATE INDEX party_character_deaths_party ON public.party_character_deaths (party_id, user_id);

-- 6. updated_at
CREATE TRIGGER party_fights_updated_at BEFORE UPDATE ON public.party_fights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER party_fight_combatants_updated_at BEFORE UPDATE ON public.party_fight_combatants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Party members (and the host) can read. Nobody writes from a phone: only the server function does.
ALTER TABLE public.party_fights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_fight_combatants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_fight_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_character_deaths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party can see fights" ON public.party_fights FOR SELECT
  USING (public.is_party_member(auth.uid(), party_id) OR public.is_party_host(auth.uid(), party_id));
CREATE POLICY "Party can see fighters" ON public.party_fight_combatants FOR SELECT
  USING (public.is_party_member(auth.uid(), party_id) OR public.is_party_host(auth.uid(), party_id));
CREATE POLICY "Party can see fight events" ON public.party_fight_events FOR SELECT
  USING (public.is_party_member(auth.uid(), party_id) OR public.is_party_host(auth.uid(), party_id));
CREATE POLICY "Party can see the fallen" ON public.party_character_deaths FOR SELECT
  USING (public.is_party_member(auth.uid(), party_id) OR public.is_party_host(auth.uid(), party_id));

-- 8. Live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_fights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_fight_combatants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_fight_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_character_deaths;

-- 9. Access: phones read only, the server function writes.
GRANT SELECT ON public.party_fights, public.party_fight_combatants, public.party_fight_events, public.party_character_deaths TO authenticated;
GRANT ALL ON public.party_fights, public.party_fight_combatants, public.party_fight_events, public.party_character_deaths TO service_role;