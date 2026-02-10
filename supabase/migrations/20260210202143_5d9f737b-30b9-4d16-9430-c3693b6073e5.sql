
-- Create parties table
CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read parties (needed for join-by-code lookup)
CREATE POLICY "Authenticated users can read parties"
  ON public.parties FOR SELECT TO authenticated
  USING (true);

-- Only authenticated users can create parties
CREATE POLICY "Authenticated users can create parties"
  ON public.parties FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only creator can update (disband)
CREATE POLICY "Creator can update own party"
  ON public.parties FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Create party_members table
CREATE TABLE public.party_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text NOT NULL DEFAULT 'Adventurer',
  character_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);

ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;

-- Members can read all members in their party
CREATE POLICY "Members can read party members"
  ON public.party_members FOR SELECT TO authenticated
  USING (
    party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Authenticated users can join a party
CREATE POLICY "Users can join parties"
  ON public.party_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Members can only update their own row
CREATE POLICY "Members can update own status"
  ON public.party_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Members can leave (delete own row)
CREATE POLICY "Members can leave party"
  ON public.party_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create party_actions table
CREATE TABLE public.party_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false
);

ALTER TABLE public.party_actions ENABLE ROW LEVEL SECURITY;

-- Party members can insert actions
CREATE POLICY "Members can send actions"
  ON public.party_actions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Target user can read actions sent to them
CREATE POLICY "Target can read actions"
  ON public.party_actions FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id);

-- Target user can mark actions as applied
CREATE POLICY "Target can update actions"
  ON public.party_actions FOR UPDATE TO authenticated
  USING (auth.uid() = target_user_id);

-- Trigger for updated_at on party_members
CREATE TRIGGER update_party_members_updated_at
  BEFORE UPDATE ON public.party_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime on party_members and party_actions
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_actions;
