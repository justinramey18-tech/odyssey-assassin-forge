CREATE TABLE public.universe_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.linked_universes(id) ON DELETE CASCADE,
  member_a uuid NOT NULL REFERENCES public.universe_members(id) ON DELETE CASCADE,
  member_b uuid NOT NULL REFERENCES public.universe_members(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'acquaintance',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (universe_id, member_a, member_b),
  CHECK (member_a <> member_b)
);

CREATE INDEX universe_relationships_universe_idx ON public.universe_relationships(universe_id);
CREATE INDEX universe_relationships_member_a_idx ON public.universe_relationships(member_a);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_relationships TO authenticated;
GRANT ALL ON public.universe_relationships TO service_role;

ALTER TABLE public.universe_relationships ENABLE ROW LEVEL SECURITY;

-- Members of a universe can read all relationships within it
CREATE POLICY "Universe members can read relationships"
ON public.universe_relationships
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.universe_members um
    WHERE um.universe_id = universe_relationships.universe_id
      AND um.user_id = auth.uid()
  )
);

-- A rider can insert/update/delete only their own outgoing relationships
CREATE POLICY "Members can insert own outgoing relationships"
ON public.universe_relationships
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.universe_members um
    WHERE um.id = universe_relationships.member_a
      AND um.user_id = auth.uid()
      AND um.universe_id = universe_relationships.universe_id
  )
);

CREATE POLICY "Members can update own outgoing relationships"
ON public.universe_relationships
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.universe_members um
    WHERE um.id = universe_relationships.member_a
      AND um.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.universe_members um
    WHERE um.id = universe_relationships.member_a
      AND um.user_id = auth.uid()
  )
);

CREATE POLICY "Members can delete own outgoing relationships"
ON public.universe_relationships
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.universe_members um
    WHERE um.id = universe_relationships.member_a
      AND um.user_id = auth.uid()
  )
);

CREATE TRIGGER update_universe_relationships_updated_at
BEFORE UPDATE ON public.universe_relationships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();