-- NPC allies (D-24): an NPC the party recruited travels and fights with them.
-- party_npcs.ally_since: set while the NPC is in the party (null = not). ally_of: who accepted the offer, or the host who added it.
-- party_fight_combatants.ally: true for an NPC fighting on the party's side. Only NPC rows can be allies.
ALTER TABLE public.party_npcs
  ADD COLUMN IF NOT EXISTS ally_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ally_of uuid NULL;

ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS ally boolean NOT NULL DEFAULT false;

ALTER TABLE public.party_fight_combatants
  DROP CONSTRAINT IF EXISTS party_fight_combatants_ally_npc;

ALTER TABLE public.party_fight_combatants
  ADD CONSTRAINT party_fight_combatants_ally_npc CHECK ((NOT ally) OR kind = 'npc');