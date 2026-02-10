
-- Fix: Restrict parties SELECT to only members and creators (not all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can read parties" ON public.parties;

-- Only party members and the creator can read party data
CREATE POLICY "Members and creator can read parties"
ON public.parties
FOR SELECT
USING (
  auth.uid() = created_by
  OR public.is_party_member(auth.uid(), id)
);
