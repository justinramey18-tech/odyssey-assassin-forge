DELETE FROM public.party_dm_prompts a
USING public.party_dm_prompts b
WHERE a.party_id = b.party_id
  AND a.round_id = b.round_id
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

DELETE FROM public.party_dm_prompts a
USING public.party_dm_prompts b
WHERE a.party_id = b.party_id
  AND a.round_id = b.round_id
  AND a.user_id = b.user_id
  AND a.created_at = b.created_at
  AND a.id < b.id;

ALTER TABLE public.party_dm_prompts
  ADD CONSTRAINT party_dm_prompts_party_round_user_unique
  UNIQUE (party_id, round_id, user_id);