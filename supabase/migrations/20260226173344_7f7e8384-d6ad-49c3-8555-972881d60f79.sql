ALTER TABLE public.party_push_subscriptions
  ADD CONSTRAINT party_push_subscriptions_user_endpoint_unique
  UNIQUE (user_id, endpoint);