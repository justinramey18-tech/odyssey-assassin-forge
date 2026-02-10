
-- Create security definer function to check party membership
CREATE OR REPLACE FUNCTION public.is_party_member(_user_id uuid, _party_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_members
    WHERE user_id = _user_id AND party_id = _party_id
  )
$$;

-- Drop the recursive policy
DROP POLICY "Members can read party members" ON public.party_members;

-- Recreate with security definer function
CREATE POLICY "Members can read party members"
  ON public.party_members FOR SELECT TO authenticated
  USING (public.is_party_member(auth.uid(), party_id));

-- Also fix party_actions INSERT policy that has same issue
DROP POLICY "Members can send actions" ON public.party_actions;

CREATE POLICY "Members can send actions"
  ON public.party_actions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND public.is_party_member(auth.uid(), party_id)
  );
