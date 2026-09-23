import { useCallback, useSyncExternalStore } from 'react';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';



const HEARTBEAT_MS = 60_000;



export interface PartyPresence {

  onlineIds: Set<string>;

  ready: boolean;

}



const EMPTY: PartyPresence = { onlineIds: new Set(), ready: false };



interface Entry {

  refs: number;

  snapshot: PartyPresence;

  listeners: Set<() => void>;

  channel: RealtimeChannel;

  interval: number;

  onVisibility: () => void;

}



/**

 * One presence channel + one heartbeat per party/user, shared by every screen that

 * asks for it (HomeScreen and the Party DM screen are mounted at the same time, and

 * two channels on the same topic would fight). Reference-counted: torn down when the

 * last user unmounts.

 */

const entries = new Map<string, Entry>();



function acquire(partyId: string, userId: string): Entry {

  const key = `${partyId}:${userId}`;

  const existing = entries.get(key);

  if (existing) {

    existing.refs += 1;

    return existing;

  }



  const channel = supabase.channel(`party-presence-${partyId}`, {

    config: { presence: { key: userId } },

  });



  const entry: Entry = {

    refs: 1,

    snapshot: EMPTY,

    listeners: new Set(),

    channel,

    interval: 0,

    onVisibility: () => {},

  };



  const emit = (next: PartyPresence) => {

    entry.snapshot = next;

    entry.listeners.forEach(l => l());

  };



  const track = () => channel.track({ user_id: userId, online_at: new Date().toISOString() });



  const beat = async () => {

    if (document.visibilityState !== 'visible') return;

    await (supabase.from('party_members') as any)

      .update({ updated_at: new Date().toISOString() })

      .eq('party_id', partyId)

      .eq('user_id', userId);

  };



  channel

    .on('presence', { event: 'sync' }, () => {

      const ids = new Set<string>();

      for (const list of Object.values(channel.presenceState())) {

        for (const p of list as Array<{ user_id?: string }>) {

          if (p.user_id) ids.add(p.user_id);

        }

      }

      emit({ onlineIds: ids, ready: true });

    })

    .subscribe(async (status) => {

      if (status === 'SUBSCRIBED' && document.visibilityState === 'visible') await track();

    });



  entry.onVisibility = () => {

    if (document.visibilityState === 'visible') {

      void track();

      void beat();

    } else {

      void channel.untrack();

    }

  };

  document.addEventListener('visibilitychange', entry.onVisibility);



  void beat();

  entry.interval = window.setInterval(() => { void beat(); }, HEARTBEAT_MS);



  entries.set(key, entry);

  return entry;

}



function release(partyId: string, userId: string) {

  const key = `${partyId}:${userId}`;

  const entry = entries.get(key);

  if (!entry) return;

  entry.refs -= 1;

  if (entry.refs > 0) return;

  window.clearInterval(entry.interval);

  document.removeEventListener('visibilitychange', entry.onVisibility);

  void entry.channel.untrack();

  supabase.removeChannel(entry.channel);

  entries.delete(key);

}



/**

 * Who has this party open right now (realtime presence), plus a heartbeat that keeps

 * party_members.updated_at fresh while the app is visible, so timestamp-based dots

 * and "Last seen" labels stay accurate. Safe to call from several screens at once.

 */

export function usePartyPresence(partyId: string | null | undefined, userId: string | null | undefined): PartyPresence {

  const key = partyId && userId ? `${partyId}:${userId}` : null;



  const subscribe = useCallback((onChange: () => void) => {

    if (!partyId || !userId) return () => {};

    const entry = acquire(partyId, userId);

    entry.listeners.add(onChange);

    onChange();

    return () => {

      entry.listeners.delete(onChange);

      release(partyId, userId);

    };

  }, [partyId, userId]);



  const getSnapshot = useCallback(

    () => (key ? entries.get(key)?.snapshot ?? EMPTY : EMPTY),

    [key],

  );



  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

}
