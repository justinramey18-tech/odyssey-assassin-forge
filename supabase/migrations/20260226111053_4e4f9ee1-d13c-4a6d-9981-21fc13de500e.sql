DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_push_subscriptions_endpoint_key'
  ) THEN
    ALTER TABLE public.party_push_subscriptions ADD CONSTRAINT party_push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.party_push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.party_push_subscriptions;
DROP POLICY IF EXISTS "Users can select own subscriptions" ON public.party_push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.party_push_subscriptions;

CREATE POLICY "Users can delete own subscriptions" ON public.party_push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.party_push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own subscriptions" ON public.party_push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.party_push_subscriptions FOR UPDATE USING (auth.uid() = user_id);