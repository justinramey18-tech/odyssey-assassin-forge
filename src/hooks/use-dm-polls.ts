import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface DmPollOption {
  label: string;
  voters: Array<{ userId: string; name: string }>;
}

export interface DmPoll {
  pollId: string;
  question: string;
  options: DmPollOption[];
  creatorUserId: string;
  creatorName: string;
  closed: boolean;
  createdAt: string;
}

export function useDmPolls(partyId: string | null) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<DmPoll[]>([]);

  useEffect(() => {
    if (!partyId) return;
    (async () => {
      const { data } = await (supabase.from('party_shared_state') as any)
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', 'dm_poll');
      if (data) {
        setPolls(data.map((row: any) => row.state_data as DmPoll).sort((a: DmPoll, b: DmPoll) => a.createdAt.localeCompare(b.createdAt)));
      }
    })();
  }, [partyId]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`dm-polls-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row || row.state_type !== 'dm_poll') return;
        if (payload.eventType === 'DELETE') {
          const oldData = row.state_data as DmPoll;
          if (oldData?.pollId) {
            setPolls(prev => prev.filter(p => p.pollId !== oldData.pollId));
          }
          return;
        }
        const poll = row.state_data as DmPoll;
        setPolls(prev => {
          const idx = prev.findIndex(p => p.pollId === poll.pollId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = poll;
            return next;
          }
          return [...prev, poll].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const createPoll = useCallback(async (question: string, options: string[], creatorName: string) => {
    if (!partyId || !user) return;
    const poll: DmPoll = {
      pollId: crypto.randomUUID(),
      question,
      options: options.map(label => ({ label, voters: [] })),
      creatorUserId: user.id,
      creatorName,
      closed: false,
      createdAt: new Date().toISOString(),
    };
    await (supabase.from('party_shared_state') as any).insert({
      party_id: partyId,
      user_id: user.id,
      state_type: 'dm_poll',
      state_data: poll,
    });
  }, [partyId, user]);

  const castVote = useCallback(async (pollId: string, optionLabel: string, voterName: string) => {
    if (!partyId || !user) return;
    const { data: rows } = await (supabase.from('party_shared_state') as any)
      .select('state_data, user_id')
      .eq('party_id', partyId)
      .eq('state_type', 'dm_poll');
    const row = rows?.find((r: any) => (r.state_data as DmPoll).pollId === pollId);
    if (!row) return;
    const fresh = row.state_data as DmPoll;
    if (fresh.closed) return;
    if (fresh.options.some(o => o.voters.some(v => v.userId === user.id))) return;
    const updated: DmPoll = {
      ...fresh,
      options: fresh.options.map(o => ({
        ...o,
        voters: o.label === optionLabel ? [...o.voters, { userId: user.id, name: voterName }] : o.voters,
      })),
    };
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updated })
      .eq('party_id', partyId)
      .eq('user_id', row.user_id)
      .eq('state_type', 'dm_poll');
  }, [partyId, user]);

  const closePoll = useCallback(async (pollId: string) => {
    if (!partyId || !user) return;
    const { data: rows } = await (supabase.from('party_shared_state') as any)
      .select('state_data, user_id')
      .eq('party_id', partyId)
      .eq('state_type', 'dm_poll');
    const row = rows?.find((r: any) => (r.state_data as DmPoll).pollId === pollId);
    if (!row) return;
    const fresh = row.state_data as DmPoll;
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: { ...fresh, closed: true } })
      .eq('party_id', partyId)
      .eq('user_id', row.user_id)
      .eq('state_type', 'dm_poll');
  }, [partyId, user]);

  return { polls, createPoll, castVote, closePoll };
}