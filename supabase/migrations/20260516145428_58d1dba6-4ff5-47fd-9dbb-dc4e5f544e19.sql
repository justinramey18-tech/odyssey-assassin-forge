CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.account_recovery (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.account_recovery ENABLE ROW LEVEL SECURITY;

-- Users can see whether they have a recovery code on file (metadata only is fine; hash is not useful to attackers without the plaintext, but we keep it private anyway via policy)
CREATE POLICY "Users can view own recovery row"
  ON public.account_recovery FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates happen via service role from edge functions; no client policies for write.
