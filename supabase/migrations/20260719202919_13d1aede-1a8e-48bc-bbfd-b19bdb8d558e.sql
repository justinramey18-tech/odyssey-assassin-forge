-- Remove blank "(no action)" prompt rows when the SAME user has a non-blank prompt in the SAME round.
DELETE FROM public.party_dm_prompts blank
USING public.party_dm_prompts real
WHERE blank.party_id = real.party_id
  AND blank.round_id = real.round_id
  AND blank.user_id = real.user_id
  AND blank.id <> real.id
  AND (blank.prompt IS NULL OR btrim(blank.prompt) = '')
  AND real.prompt IS NOT NULL AND btrim(real.prompt) <> '';

-- Then remove any remaining exact duplicates (same user/round), keeping newest.
DELETE FROM public.party_dm_prompts a
USING public.party_dm_prompts b
WHERE a.party_id = b.party_id AND a.round_id = b.round_id AND a.user_id = b.user_id
  AND a.created_at < b.created_at;