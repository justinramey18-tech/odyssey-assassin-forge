ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS minigame jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.party_fight_combatants.minigame IS 'Live NPC Combat v6 mini-games (players): Counter Clash taps on the current chain, perfect-chain count, and the Tug & Slip struggle. Written only by the npc-combat function.';