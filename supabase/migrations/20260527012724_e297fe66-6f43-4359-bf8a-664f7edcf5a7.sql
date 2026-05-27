ALTER TABLE public.telegram_user_links
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint;

ALTER TABLE public.telegram_user_links
  DROP CONSTRAINT IF EXISTS telegram_user_links_chat_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_user_links_sender
  ON public.telegram_user_links (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_user_links_chat
  ON public.telegram_user_links (chat_id);