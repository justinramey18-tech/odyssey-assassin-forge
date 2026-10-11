-- Live NPC Combat v3 1/5: each NPC's current pace in a fight, in milliseconds (null = its Speed preset)
ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS act_every_ms integer;
ALTER TABLE public.party_fight_combatants DROP CONSTRAINT IF EXISTS party_fight_combatants_act_every_ms_check;
ALTER TABLE public.party_fight_combatants
  ADD CONSTRAINT party_fight_combatants_act_every_ms_check CHECK (act_every_ms IS NULL OR act_every_ms BETWEEN 1000 AND 600000);