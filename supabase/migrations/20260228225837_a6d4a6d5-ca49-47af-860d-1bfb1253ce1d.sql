-- Prevent duplicate prompts per user per round at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_dm_prompts_user_round
  ON public.party_dm_prompts (party_id, user_id, round_id);