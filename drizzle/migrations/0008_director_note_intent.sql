ALTER TABLE public.party_director_messages ADD COLUMN IF NOT EXISTS intent text;
ALTER TABLE public.party_director_messages ADD COLUMN IF NOT EXISTS fires_remaining integer NOT NULL DEFAULT 3;
COMMENT ON COLUMN public.party_director_messages.intent IS 'now | soon | slow_burn | canon | steer; NULL = legacy, treated as now';