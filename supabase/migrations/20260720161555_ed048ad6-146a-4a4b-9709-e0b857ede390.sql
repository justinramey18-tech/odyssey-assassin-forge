
CREATE TABLE public.linked_universes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_code text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT 'Shared Universe',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  max_members int NOT NULL DEFAULT 8
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linked_universes TO authenticated;
GRANT ALL ON public.linked_universes TO service_role;

ALTER TABLE public.linked_universes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read universes"
  ON public.linked_universes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can create universes"
  ON public.linked_universes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update their universe"
  ON public.linked_universes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE TABLE public.universe_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.linked_universes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.ai_dm_campaigns(id) ON DELETE CASCADE,
  character_name text NOT NULL DEFAULT 'Rider',
  story_digest text,
  digest_updated_at timestamptz,
  character_card jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'full',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (universe_id, campaign_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_members TO authenticated;
GRANT ALL ON public.universe_members TO service_role;

ALTER TABLE public.universe_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read universe members"
  ON public.universe_members FOR SELECT
  TO authenticated
  USING (
    universe_id IN (
      SELECT universe_id FROM public.universe_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add their own membership"
  ON public.universe_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own membership"
  ON public.universe_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own membership"
  ON public.universe_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.universe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.linked_universes(id) ON DELETE CASCADE,
  created_by_member uuid REFERENCES public.universe_members(id) ON DELETE SET NULL,
  event_text text NOT NULL,
  event_type text NOT NULL DEFAULT 'story',
  importance int NOT NULL DEFAULT 1,
  is_canon boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_universe_events_lookup ON public.universe_events (universe_id, is_canon, importance DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_events TO authenticated;
GRANT ALL ON public.universe_events TO service_role;

ALTER TABLE public.universe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read universe events"
  ON public.universe_events FOR SELECT
  TO authenticated
  USING (
    universe_id IN (
      SELECT universe_id FROM public.universe_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can add universe events"
  ON public.universe_events FOR INSERT
  TO authenticated
  WITH CHECK (
    universe_id IN (
      SELECT universe_id FROM public.universe_members WHERE user_id = auth.uid()
    )
  );
