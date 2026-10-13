// Party Sparring link: one live channel per party, no database rows.
// The host's phone runs the fight and shares it; members mirror it and send
// their actions to the host. Nothing here touches campaign data.
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SparringPlayer { userId: string; name: string; maxHp: number; ac: number; level: number; atk: number }
export interface SparringInvite { sessionId: string; hostId: string; hostName: string; at: number }

type Handler = (payload: Record<string, unknown>) => void;

export interface SparringNet {
  role: 'host' | 'member';
  me: string;
  sessionId: string;
  send: (event: string, payload: Record<string, unknown>) => void;
  on: (event: string, fn: Handler) => () => void;
}

export interface SparringLink {
  /** Latest host invite seen (members only), expires after a few quiet seconds. */
  invite: SparringInvite | null;
  /** Build the session link for one role. */
  makeNet: (role: 'host' | 'member', sessionId: string) => SparringNet | null;
}

const INVITE_TTL_MS = 9000;

/** Clamp a player's numbers from the network. */
export function cleanPlayer(raw: unknown): SparringPlayer | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const userId = typeof r.userId === 'string' ? r.userId.slice(0, 64) : '';
  const maxHp = Number(r.maxHp), ac = Number(r.ac), level = Number(r.level), atk = Number(r.atk);
  if (!userId || ![maxHp, ac, level, atk].every(Number.isFinite)) return null;
  return {
    userId,
    name: (typeof r.name === 'string' && r.name.trim() ? r.name : 'Adventurer').slice(0, 40),
    maxHp: Math.min(999, Math.max(1, Math.round(maxHp))),
    ac: Math.min(30, Math.max(5, Math.round(ac))),
    level: Math.min(20, Math.max(1, Math.round(level))),
    atk: Math.min(15, Math.max(-5, Math.round(atk))),
  };
}

export function useSparringLink(partyId: string | null | undefined, userId: string | null | undefined): SparringLink {
  const handlers = useRef(new Map<string, Set<Handler>>());
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [invite, setInvite] = useState<SparringInvite | null>(null);

  useEffect(() => {
    if (!partyId || !userId) return;
    const ch = supabase.channel(`sparring-${partyId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: '*' }, (msg) => {
      const event = String(msg.event ?? '');
      const payload = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {}) as Record<string, unknown>;
      if (event === 'invite' && typeof payload.sessionId === 'string' && typeof payload.hostId === 'string') {
        setInvite({ sessionId: payload.sessionId, hostId: payload.hostId, hostName: String(payload.hostName ?? 'The host').slice(0, 40), at: Date.now() });
      }
      if (event === 'end') setInvite(null);
      handlers.current.get(event)?.forEach((fn) => fn(payload));
    }).subscribe();
    chanRef.current = ch;
    return () => { chanRef.current = null; void supabase.removeChannel(ch); };
  }, [partyId, userId]);

  // Invites go stale if the host stops pinging.
  useEffect(() => {
    if (!invite) return;
    const t = setTimeout(() => setInvite((i) => (i && Date.now() - i.at >= INVITE_TTL_MS ? null : i)), INVITE_TTL_MS + 100);
    return () => clearTimeout(t);
  }, [invite]);

  const makeNet = useMemo(() => (role: 'host' | 'member', sessionId: string): SparringNet | null => {
    if (!partyId || !userId) return null;
    return {
      role, me: userId, sessionId,
      send: (event, payload) => { void chanRef.current?.send({ type: 'broadcast', event, payload: { ...payload, sessionId } }); },
      on: (event, fn) => {
        const wrapped: Handler = (p) => { if (p.sessionId === sessionId) fn(p); };
        const set = handlers.current.get(event) ?? new Set<Handler>();
        set.add(wrapped); handlers.current.set(event, set);
        return () => { set.delete(wrapped); };
      },
    };
  }, [partyId, userId]);

  return { invite, makeNet };
}
