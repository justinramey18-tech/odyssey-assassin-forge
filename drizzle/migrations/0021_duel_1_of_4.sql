-- Live NPC Combat v7 (Duel), 1/4
-- 1. The Duel bar (players): 0-100, filled by damage dealt and taken, emptied when a duel starts.
ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS duel_charge real NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.party_fight_combatants.duel_charge IS 'Live NPC Combat v7: the Duel bar (0-100). Written only by the npc-combat function.';

-- 2. One new event kind: 'duel'. Every existing kind stays.
ALTER TABLE public.party_fight_events DROP CONSTRAINT IF EXISTS party_fight_events_kind_check;
ALTER TABLE public.party_fight_events
  ADD CONSTRAINT party_fight_events_kind_check CHECK (kind IN (
    'start', 'join', 'attack', 'spell', 'heal', 'down', 'death_save', 'stabilize', 'death', 'revive', 'defeat_npc',
    'sync', 'pause', 'resume', 'end', 'second_wind', 'potion', 'last_stand', 'intent', 'mend', 'shield', 'rally',
    'pin', 'retreat', 'huddle', 'scale', 'duel'
  ));