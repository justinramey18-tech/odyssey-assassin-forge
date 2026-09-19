ALTER TABLE public.party_director_messages
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;