CREATE TABLE IF NOT EXISTS public.telegram_yo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_yo_history_chat_created
  ON public.telegram_yo_history (chat_id, created_at DESC);

ALTER TABLE public.telegram_yo_history ENABLE ROW LEVEL SECURITY;