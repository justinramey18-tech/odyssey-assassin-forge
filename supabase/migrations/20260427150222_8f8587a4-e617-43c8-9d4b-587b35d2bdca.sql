-- Phase 1 of party-mode onboarding flow.
-- Pure additive schema. No data is migrated.

-- ─── Add onboarding status columns to party_members ──────────────────────

ALTER TABLE public.party_members
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending', 'in_progress', 'complete'));

ALTER TABLE public.party_members
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz NULL;

ALTER TABLE public.party_members
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

-- ─── Add campaign_started columns to parties ─────────────────────────────

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS campaign_started boolean NOT NULL DEFAULT false;

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS campaign_started_at timestamptz NULL;

-- ─── Create party_onboarding_requests table ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.party_onboarding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  UNIQUE (party_id, user_id, status)
);

ALTER TABLE public.party_onboarding_requests ENABLE ROW LEVEL SECURITY;

-- ─── RLS policies for party_onboarding_requests ──────────────────────────

CREATE POLICY "Members can read onboarding requests"
  ON public.party_onboarding_requests FOR SELECT TO authenticated
  USING (
    party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can create their own onboarding requests"
  ON public.party_onboarding_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND party_id IN (
      SELECT pm.party_id FROM public.party_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Host can resolve onboarding requests"
  ON public.party_onboarding_requests FOR UPDATE TO authenticated
  USING (
    party_id IN (
      SELECT p.id FROM public.parties p WHERE p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    party_id IN (
      SELECT p.id FROM public.parties p WHERE p.created_by = auth.uid()
    )
  );

CREATE POLICY "Players can cancel their own pending requests"
  ON public.party_onboarding_requests FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- ─── Enable realtime for the new table ───────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.party_onboarding_requests;