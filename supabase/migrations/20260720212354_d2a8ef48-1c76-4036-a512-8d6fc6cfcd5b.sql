
CREATE TABLE public.crossover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.linked_universes(id) ON DELETE CASCADE,
  from_member uuid NOT NULL REFERENCES public.universe_members(id) ON DELETE CASCADE,
  to_member uuid NOT NULL REFERENCES public.universe_members(id) ON DELETE CASCADE,
  scene_premise text,
  status text NOT NULL DEFAULT 'pending',
  narration_a text,
  narration_b text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_crossover_requests_universe ON public.crossover_requests(universe_id);
CREATE INDEX idx_crossover_requests_from ON public.crossover_requests(from_member);
CREATE INDEX idx_crossover_requests_to ON public.crossover_requests(to_member);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crossover_requests TO authenticated;
GRANT ALL ON public.crossover_requests TO service_role;

ALTER TABLE public.crossover_requests ENABLE ROW LEVEL SECURITY;

-- Members of the same universe can read crossover requests in that universe.
CREATE POLICY "Universe members can view crossovers"
ON public.crossover_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.universe_members m
    WHERE m.universe_id = crossover_requests.universe_id
      AND m.user_id = auth.uid()
  )
);

-- Callers can INSERT only when from_member is their own membership row.
CREATE POLICY "Members can create crossovers as themselves"
ON public.crossover_requests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.universe_members m
    WHERE m.id = crossover_requests.from_member
      AND m.user_id = auth.uid()
      AND m.universe_id = crossover_requests.universe_id
  )
);

-- Callers can UPDATE when they are either the from_member or the to_member.
CREATE POLICY "Members can update their own crossovers"
ON public.crossover_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.universe_members m
    WHERE (m.id = crossover_requests.from_member OR m.id = crossover_requests.to_member)
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.universe_members m
    WHERE (m.id = crossover_requests.from_member OR m.id = crossover_requests.to_member)
      AND m.user_id = auth.uid()
  )
);
