ALTER TABLE public.scheduled_telegram_jobs
  ADD COLUMN IF NOT EXISTS dragon_mood text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dragon_bond integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dragon_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dragon_signet text DEFAULT NULL;