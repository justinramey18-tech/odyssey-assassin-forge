
-- 1. party_shared_state: lightweight key-value broadcast channel
CREATE TABLE public.party_shared_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  state_type text NOT NULL,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id, state_type)
);

ALTER TABLE public.party_shared_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read party shared state"
  ON public.party_shared_state FOR SELECT
  USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can insert own shared state"
  ON public.party_shared_state FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can update own shared state"
  ON public.party_shared_state FOR UPDATE
  USING (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can delete own shared state"
  ON public.party_shared_state FOR DELETE
  USING (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

CREATE TRIGGER update_party_shared_state_updated_at
  BEFORE UPDATE ON public.party_shared_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. party_dice_rolls: shared dice roll broadcasts
CREATE TABLE public.party_dice_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  roller_name text NOT NULL DEFAULT 'Adventurer',
  roll_label text NOT NULL DEFAULT 'Roll',
  roll_expression text NOT NULL,
  roll_result integer NOT NULL,
  roll_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.party_dice_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read party dice rolls"
  ON public.party_dice_rolls FOR SELECT
  USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can insert own dice rolls"
  ON public.party_dice_rolls FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_party_member(auth.uid(), party_id));

-- 3. party_loot_queue: shared loot pool with claim system
CREATE TABLE public.party_loot_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  added_by_user_id uuid NOT NULL,
  added_by_name text NOT NULL DEFAULT 'Adventurer',
  item_name text NOT NULL,
  item_description text,
  rarity text NOT NULL DEFAULT 'common',
  gold_value integer NOT NULL DEFAULT 0,
  claimed_by_user_id uuid,
  claimed_by_name text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.party_loot_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read party loot"
  ON public.party_loot_queue FOR SELECT
  USING (is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can add loot to party"
  ON public.party_loot_queue FOR INSERT
  WITH CHECK (auth.uid() = added_by_user_id AND is_party_member(auth.uid(), party_id));

CREATE POLICY "Members can claim unclaimed loot"
  ON public.party_loot_queue FOR UPDATE
  USING (is_party_member(auth.uid(), party_id) AND claimed_by_user_id IS NULL);

-- Enable Realtime for all 3 tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_shared_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_dice_rolls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_loot_queue;
