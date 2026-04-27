-- Phase 3b backfill: existing campaigns are treated as already-started so
-- the new lock-out gating doesn't disrupt active games.

UPDATE public.parties
  SET campaign_started = true,
      campaign_started_at = COALESCE(campaign_started_at, NOW())
  WHERE campaign_started = false;

UPDATE public.party_members
  SET onboarding_status = 'complete',
      onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
  WHERE onboarding_status != 'complete';