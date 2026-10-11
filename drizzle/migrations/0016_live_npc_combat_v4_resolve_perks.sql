-- Live NPC Combat v4 1/6: Resolve, Second Wind and perks

-- 1. Each player's Resolve bar and Second Wind in a fight.
ALTER TABLE public.party_fight_combatants
  ADD COLUMN IF NOT EXISTS resolve real,
  ADD COLUMN IF NOT EXISTS resolve_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolve_rate real,
  ADD COLUMN IF NOT EXISTS perks text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS second_wind text,
  ADD COLUMN IF NOT EXISTS last_stand_used boolean NOT NULL DEFAULT false;

-- 2. New fight event kinds.
ALTER TABLE public.party_fight_events DROP CONSTRAINT IF EXISTS party_fight_events_kind_check;
ALTER TABLE public.party_fight_events ADD CONSTRAINT party_fight_events_kind_check CHECK (kind IN (
  'start', 'join', 'attack', 'spell', 'heal', 'down', 'death_save', 'stabilize', 'death', 'revive', 'defeat_npc',
  'sync', 'pause', 'resume', 'end', 'second_wind', 'potion', 'last_stand'));

-- 3. Perks each character owns and has equipped. Only the server writes; a player reads their own.
CREATE TABLE IF NOT EXISTS public.character_perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_name text NOT NULL,
  owned text[] NOT NULL DEFAULT '{}',
  equipped text[] NOT NULL DEFAULT '{}',
  slots integer NOT NULL DEFAULT 2 CHECK (slots BETWEEN 2 AND 3),
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, character_name)
);
GRANT SELECT ON public.character_perks TO authenticated;
GRANT ALL ON public.character_perks TO service_role;
DROP TRIGGER IF EXISTS character_perks_updated_at ON public.character_perks;
CREATE TRIGGER character_perks_updated_at BEFORE UPDATE ON public.character_perks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.character_perks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can see their own perks" ON public.character_perks;
CREATE POLICY "Players can see their own perks" ON public.character_perks FOR SELECT
  USING (user_id = auth.uid());