import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_MS = 60_000;

/**
 * Who has this party open right now (realtime presence), plus a heartbeat that keeps
 * party_members.updated_at fresh while the app is visible, so timestamp-based dots
 * and "Last seen" labels elsewhere stay accurate.
 */
export function usePartyPresence(partyId: string | null | undefined, userId: string | null | undefined) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Realtime presence: instant join/leave.
  useEffect(() => {
    if (!partyId || !userId) {
      setOnlineIds(new Set());
      setReady(false);
      return;
    }

    const channel = supabase.channel(`party-presence-${partyId}`, {
      config: { presence: { key: userId } },
    });

    const track = () => channel.track({ user_id: userId, online_at: new Date().toISOString() });

    channel
      .on('presence', { event: 'sync' }, () => {
        const ids = new Set<string>();
        for (const list of Object.values(channel.presenceState())) {
          for (const p of list as Array<{ user_id?: string }>) {
            if (p.user_id) ids.add(p.user_id);
          }
        }
        setOnlineIds(ids);
        setReady(true);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && document.visibilityState === 'visible') await track();
      });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void track();
      else void channel.untrack();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [partyId, userId]);

  // Heartbeat: bump party_members.updated_at while the app is visible.
  useEffect(() => {
    if (!partyId || !userId) return;
    let stopped = false;
    const beat = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      await (supabase.from('party_members') as any)
        .update({ updated_at: new Date().toISOString() })
        .eq('party_id', partyId)
        .eq('user_id', userId);
    };
    void beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') void beat(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [partyId, userId]);

  return { onlineIds, ready };
}
