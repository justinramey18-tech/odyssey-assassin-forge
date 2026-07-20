ALTER TABLE public.crossover_requests
  ADD COLUMN IF NOT EXISTS live_beat_a text,
  ADD COLUMN IF NOT EXISTS live_beat_a_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_beat_b text,
  ADD COLUMN IF NOT EXISTS live_beat_b_at timestamptz;