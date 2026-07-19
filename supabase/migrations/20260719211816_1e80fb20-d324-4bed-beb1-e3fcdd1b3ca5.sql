
CREATE TABLE public.party_round_locks (
  party_id uuid NOT NULL,
  round_id uuid NOT NULL,
  holder_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '90 seconds'),
  PRIMARY KEY (party_id, round_id)
);

CREATE INDEX idx_party_round_locks_expires_at ON public.party_round_locks (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_round_locks TO authenticated;
GRANT ALL ON public.party_round_locks TO service_role;

ALTER TABLE public.party_round_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Party members can read round locks"
  ON public.party_round_locks
  FOR SELECT
  TO authenticated
  USING (public.is_party_member(auth.uid(), party_id));

CREATE POLICY "Party members can claim round locks"
  ON public.party_round_locks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    holder_user_id = auth.uid()
    AND public.is_party_member(auth.uid(), party_id)
  );

CREATE POLICY "Holder can update own lock"
  ON public.party_round_locks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_party_member(auth.uid(), party_id)
    AND (holder_user_id = auth.uid() OR expires_at < now())
  )
  WITH CHECK (
    holder_user_id = auth.uid()
    AND public.is_party_member(auth.uid(), party_id)
  );

CREATE POLICY "Holder can delete own lock"
  ON public.party_round_locks
  FOR DELETE
  TO authenticated
  USING (
    public.is_party_member(auth.uid(), party_id)
    AND (holder_user_id = auth.uid() OR expires_at < now())
  );
