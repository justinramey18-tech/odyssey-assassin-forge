
-- Create security definer function to check if current user is a co-host of a given owner
CREATE OR REPLACE FUNCTION public.is_co_host_of(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM party_shared_state pss
    JOIN parties p ON p.id = pss.party_id
    WHERE pss.state_type = 'co_hosts'
    AND p.created_by = _owner_id
    AND p.is_active = true
    AND pss.state_data->'userIds' ? auth.uid()::text
  )
$$;

-- Add RLS policies on gm_guides for co-host access
CREATE POLICY "Co-hosts can view host guides"
ON public.gm_guides FOR SELECT
TO authenticated
USING (public.is_co_host_of(user_id));

CREATE POLICY "Co-hosts can update host guides"
ON public.gm_guides FOR UPDATE
TO authenticated
USING (public.is_co_host_of(user_id));

CREATE POLICY "Co-hosts can insert guides for host"
ON public.gm_guides FOR INSERT
TO authenticated
WITH CHECK (public.is_co_host_of(user_id));

CREATE POLICY "Co-hosts can delete host guides"
ON public.gm_guides FOR DELETE
TO authenticated
USING (public.is_co_host_of(user_id));
