ALTER TABLE public.party_director_escalations
  ADD COLUMN IF NOT EXISTS intent text;

COMMENT ON COLUMN public.party_director_escalations.intent IS 'Player-picked timing (now, soon, slow_burn, canon, steer) carried from the escalated director note; nullable for rows created before this column existed.';