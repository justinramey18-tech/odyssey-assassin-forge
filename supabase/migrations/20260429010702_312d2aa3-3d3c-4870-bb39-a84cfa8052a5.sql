-- Bulletproof Private Mode: enforce per-player visibility at the database layer
-- on the party DM transcript table.

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS private_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.party_dm_messages
  ADD COLUMN IF NOT EXISTS is_afk_marker boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_parties_private_mode
  ON public.parties (id) WHERE private_mode = true;

CREATE INDEX IF NOT EXISTS idx_party_dm_messages_afk_marker
  ON public.party_dm_messages (party_id, is_afk_marker) WHERE is_afk_marker = true;

CREATE OR REPLACE FUNCTION public.party_is_private(_party_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT private_mode FROM public.parties WHERE id = _party_id), false);
$$;

DROP POLICY IF EXISTS "Party members can read dm messages" ON public.party_dm_messages;

CREATE POLICY "Party members can read dm messages with privacy"
  ON public.party_dm_messages FOR SELECT
  TO authenticated
  USING (
    public.is_party_member(auth.uid(), party_id)
    AND (
      NOT public.party_is_private(party_id)
      OR role = 'assistant'
      OR (role = 'user' AND sender_user_id = auth.uid())
      OR is_afk_marker = true
      OR (team IS NOT NULL AND team LIKE 'whisper:%')
    )
  );