
-- Telegram bot polling state (singleton)
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Incoming Telegram messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);

-- Link Odyssey users to Telegram chat IDs
CREATE TABLE public.telegram_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  username text,
  linked_at timestamptz DEFAULT now(),
  notify_ready_up boolean NOT NULL DEFAULT true,
  notify_timer boolean NOT NULL DEFAULT true,
  notify_combat boolean NOT NULL DEFAULT true,
  notify_dragon boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(chat_id)
);

-- Pending link codes
CREATE TABLE public.telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- telegram_user_links: users manage their own
CREATE POLICY "Users can view own telegram link"
  ON public.telegram_user_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own telegram link"
  ON public.telegram_user_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own telegram link"
  ON public.telegram_user_links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- telegram_link_codes: users manage their own
CREATE POLICY "Users can view own link codes"
  ON public.telegram_link_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own link codes"
  ON public.telegram_link_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own link codes"
  ON public.telegram_link_codes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
