-- NPC Skills 1/7
ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS pending jsonb,
  ADD COLUMN IF NOT EXISTS strike_at timestamptz,
  ADD COLUMN IF NOT EXISTS turn_no integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_turn integer NOT NULL DEFAULT -99,
  ADD COLUMN IF NOT EXISTS ward integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ward_until timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_until timestamptz;

ALTER TABLE public.party_fight_combatants DROP CONSTRAINT IF EXISTS party_fight_combatants_status_check;
ALTER TABLE public.party_fight_combatants ADD CONSTRAINT party_fight_combatants_status_check
  CHECK (status IN ('up', 'down', 'stable', 'dead', 'ko', 'fled'));

ALTER TABLE public.party_npcs DROP CONSTRAINT IF EXISTS party_npcs_combat_state_check;
ALTER TABLE public.party_npcs ADD CONSTRAINT party_npcs_combat_state_check
  CHECK (combat_state IS NULL OR combat_state IN ('ko', 'dead', 'fled'));

ALTER TABLE public.party_fight_events DROP CONSTRAINT IF EXISTS party_fight_events_kind_check;
ALTER TABLE public.party_fight_events ADD CONSTRAINT party_fight_events_kind_check CHECK (kind IN (
  'start', 'join', 'attack', 'spell', 'heal', 'down', 'death_save', 'stabilize', 'death', 'revive', 'defeat_npc',
  'sync', 'pause', 'resume', 'end', 'second_wind', 'potion', 'last_stand',
  'intent', 'mend', 'shield', 'rally', 'pin', 'retreat'));