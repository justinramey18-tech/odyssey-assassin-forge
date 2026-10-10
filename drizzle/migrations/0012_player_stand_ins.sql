ALTER TABLE public.party_npcs ADD COLUMN IF NOT EXISTS player_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS party_npcs_one_stand_in_per_player ON public.party_npcs (party_id, player_user_id) WHERE player_user_id IS NOT NULL;
CREATE POLICY "Players can read what their stand-in remembers" ON public.party_npc_memories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_npcs n WHERE n.id = npc_id AND n.player_user_id = auth.uid()));