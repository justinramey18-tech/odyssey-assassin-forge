
CREATE TABLE public.party_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  platform text,
  user_agent text,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.party_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own subscriptions"
  ON public.party_push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.party_push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.party_push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.party_push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user_id ON public.party_push_subscriptions(user_id);
CREATE INDEX idx_push_subs_enabled ON public.party_push_subscriptions(notifications_enabled) WHERE notifications_enabled = true;
