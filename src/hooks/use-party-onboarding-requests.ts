import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingRequest {
  id: string;
  party_id: string;
  user_id: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  resolved_at: string | null;
}

interface UsePartyOnboardingRequestsOptions {
  partyId: string | null;
}

export function usePartyOnboardingRequests({ partyId }: UsePartyOnboardingRequestsOptions) {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    setIsLoading(true);
    supabase
      .from('party_onboarding_requests')
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[onboarding-requests] fetch failed:', error);
        } else {
          setRequests((data || []) as OnboardingRequest[]);
        }
        setIsLoading(false);
      });

    const channel = supabase
      .channel(`party-onboarding-requests-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_onboarding_requests', filter: `party_id=eq.${partyId}` },
        () => {
          supabase
            .from('party_onboarding_requests')
            .select('*')
            .eq('party_id', partyId)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (!cancelled && data) setRequests(data as OnboardingRequest[]);
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  const submitRequest = useCallback(async (userId: string, reason: string): Promise<boolean> => {

    if (!partyId || !userId) return false;
    try {
      const { error } = await supabase
        .from('party_onboarding_requests')
        .insert({
          party_id: partyId,
          user_id: userId,
          reason: reason.trim() || null,
          status: 'pending',
        });
      if (error) {
        console.error('[onboarding-requests] submit failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[onboarding-requests] submit unexpected error:', e);
      return false;
    }
  }, [partyId]);

  const cancelOwnRequest = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('party_onboarding_requests')
        .delete()
        .eq('id', requestId);
      if (error) {
        console.error('[onboarding-requests] cancel failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[onboarding-requests] cancel unexpected error:', e);
      return false;
    }
  }, []);

  const approveRequest = useCallback(async (request: OnboardingRequest): Promise<boolean> => {
    try {
      const { error: requestErr } = await supabase
        .from('party_onboarding_requests')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (requestErr) {
        console.error('[onboarding-requests] approve update failed:', requestErr);
        return false;
      }

      const { error: memberErr } = await supabase
        .from('party_members')
        .update({
          onboarding_status: 'in_progress',
          onboarding_started_at: new Date().toISOString(),
          onboarding_completed_at: null,
        })
        .eq('party_id', request.party_id)
        .eq('user_id', request.user_id);
      if (memberErr) {
        console.error('[onboarding-requests] member reset failed:', memberErr);
      }

      return true;
    } catch (e) {
      console.error('[onboarding-requests] approve unexpected error:', e);
      return false;
    }
  }, []);

  const denyRequest = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('party_onboarding_requests')
        .update({
          status: 'denied',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) {
        console.error('[onboarding-requests] deny failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[onboarding-requests] deny unexpected error:', e);
      return false;
    }
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const myPendingRequest = (userId: string) =>
    requests.find(r => r.user_id === userId && r.status === 'pending') || null;

  return {
    requests,
    pendingRequests,
    myPendingRequest,
    isLoading,
    submitRequest,
    cancelOwnRequest,
    approveRequest,
    denyRequest,
  };
}
