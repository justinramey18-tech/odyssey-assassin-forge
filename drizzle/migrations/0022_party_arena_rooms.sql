CREATE TABLE public.arena_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL UNIQUE REFERENCES public.parties(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_rooms TO authenticated;
GRANT ALL ON public.arena_rooms TO service_role;

ALTER TABLE public.arena_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their party arena room"
  ON public.arena_rooms FOR SELECT TO authenticated
  USING (
    party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can open their party arena room"
  ON public.arena_rooms FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = host_user_id
    AND party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update their party arena room"
  ON public.arena_rooms FOR UPDATE TO authenticated
  USING (
    party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Host can delete their party arena room"
  ON public.arena_rooms FOR DELETE TO authenticated
  USING (auth.uid() = host_user_id);

ALTER TABLE public.arena_rooms REPLICA IDENTITY FULL;