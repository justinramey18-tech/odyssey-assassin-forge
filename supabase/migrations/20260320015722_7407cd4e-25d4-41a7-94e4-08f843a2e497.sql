ALTER TABLE public.telegram_user_links
ADD COLUMN notify_modes text[] NOT NULL DEFAULT '{party,solo,empyrean}'::text[];