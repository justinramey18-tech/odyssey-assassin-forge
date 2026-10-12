-- Live NPC Combat v2, 1/6

-- 1. NPC skill timers: when each skill can be used again, uses per fight, last pinned player.
ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS cooldowns jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Pauses: who paused (host or a player's huddle), when a huddle ends, and who already used their huddle.
ALTER TABLE public.party_fights
  ADD COLUMN IF NOT EXISTS pause_kind text,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS huddles_used jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.party_fights DROP CONSTRAINT IF EXISTS party_fights_pause_kind_check;
ALTER TABLE public.party_fights
  ADD CONSTRAINT party_fights_pause_kind_check CHECK (pause_kind IS NULL OR pause_kind IN ('host', 'huddle'));

-- 3. Two new event kinds: 'huddle' and 'scale'. Every existing kind stays.
ALTER TABLE public.party_fight_events DROP CONSTRAINT IF EXISTS party_fight_events_kind_check;
ALTER TABLE public.party_fight_events
  ADD CONSTRAINT party_fight_events_kind_check CHECK (kind IN (
    'start', 'join', 'attack', 'spell', 'heal', 'down', 'death_save', 'stabilize', 'death', 'revive', 'defeat_npc',
    'sync', 'pause', 'resume', 'end', 'second_wind', 'potion', 'last_stand', 'intent', 'mend', 'shield', 'rally',
    'pin', 'retreat', 'huddle', 'scale'
  ));