import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DirectorEscalation {
  id: string;
  party_id: string;
  user_id: string;
  request_text: string;
  ai_rationale: string | null;
  status: 'pending' | 'approved' | 'denied';
  host_comment: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface UsePartyDirectorEscalationsOptions {
  partyId: string | null;
}

export function usePartyDirectorEscalations({ partyId }: UsePartyDirectorEscalationsOptions) {
  const [escalations, setEscalations] = useState<DirectorEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    setIsLoading(true);

    (supabase as any)
      .from('party_director_escalations')
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: any; error: any }) => {
        if (cancelled) return;
        if (error) {
          console.error('[director-escalations] fetch failed:', error);
        } else {
          setEscalations((data || []) as DirectorEscalation[]);
        }
        setIsLoading(false);
      });

    const channel = supabase
      .channel(`party-director-escalations-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_director_escalations', filter: `party_id=eq.${partyId}` },
        () => {
          (supabase as any)
            .from('party_director_escalations')
            .select('*')
            .eq('party_id', partyId)
            .order('created_at', { ascending: false })
            .then(({ data }: { data: any }) => {
              if (!cancelled && data) setEscalations(data as DirectorEscalation[]);
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  const approve = useCallback(async (escalation: DirectorEscalation, hostUserId: string, comment: string): Promise<boolean> => {
    try {
      const { error: escErr } = await (supabase as any)
        .from('party_director_escalations')
        .update({
          status: 'approved',
          host_comment: comment.trim() || null,
          resolved_by: hostUserId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', escalation.id);
      if (escErr) {
        console.error('[director-escalations] approve update failed:', escErr);
        return false;
      }

      const { error: msgErr } = await (supabase as any)
        .from('party_director_messages')
        .insert({
          party_id: escalation.party_id,
          user_id: escalation.user_id,
          role: 'user',
          category: 'private_action',
          content: escalation.request_text,
          consumed_by_dm: false,
        });
      if (msgErr) {
        console.error('[director-escalations] insert approved private_action failed:', msgErr);
      }

      const systemContent = comment.trim()
        ? `✅ The host approved your request. Note: ${comment.trim()}`
        : '✅ The host approved your request.';
      const { error: sysErr } = await (supabase as any)
        .from('party_director_messages')
        .insert({
          party_id: escalation.party_id,
          user_id: escalation.user_id,
          role: 'system',
          category: null,
          content: systemContent,
          consumed_by_dm: true,
        });
      if (sysErr) {
        console.error('[director-escalations] insert approved system msg failed:', sysErr);
      }

      return true;
    } catch (e) {
      console.error('[director-escalations] approve error:', e);
      return false;
    }
  }, []);

  const deny = useCallback(async (escalation: DirectorEscalation, hostUserId: string, comment: string): Promise<boolean> => {
    try {
      const { error: escErr } = await (supabase as any)
        .from('party_director_escalations')
        .update({
          status: 'denied',
          host_comment: comment.trim() || null,
          resolved_by: hostUserId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', escalation.id);
      if (escErr) {
        console.error('[director-escalations] deny update failed:', escErr);
        return false;
      }

      const systemContent = comment.trim()
        ? `❌ The host declined your request. Note: ${comment.trim()}`
        : '❌ The host declined your request.';
      const { error: sysErr } = await (supabase as any)
        .from('party_director_messages')
        .insert({
          party_id: escalation.party_id,
          user_id: escalation.user_id,
          role: 'system',
          category: null,
          content: systemContent,
          consumed_by_dm: true,
        });
      if (sysErr) {
        console.error('[director-escalations] insert denied system msg failed:', sysErr);
      }

      return true;
    } catch (e) {
      console.error('[director-escalations] deny error:', e);
      return false;
    }
  }, []);

  const pending = escalations.filter(e => e.status === 'pending');

  return {
    escalations,
    pendingEscalations: pending,
    isLoading,
    approve,
    deny,
  };
}
