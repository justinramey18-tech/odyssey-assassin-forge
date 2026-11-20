// A solo Empyrean fight on the phone. The server (empyrean-rules, combat.ts) owns the fight and
// its clock; this hook checks in just before anything is due, sends the rider's moves and Counter
// Clash taps, and turns the server's log into the battle screen's text feed and hit flashes.
// It decides nothing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { resolveOddsForContext } from '@/lib/diceOdds';
import {
  callFight, type ClashQuality, type ClashSide, type FightAction, type FightArena, type FightChallenge, type FightLogLine,
  type FightReply, type FightView, type FoeKind, type RulesContext, type RulesInboxEvent,
} from '@/lib/empyrean-rules-client';

export const FIGHT_FEED_STEP_MS = 1200;
const HEARTBEAT_MS = 4000;
const MIN_TICK_MS = 350;

export interface FightStart { foeKind: FoeKind; foeName?: string; count: number; challenge: FightChallenge; lethal: boolean; arena: FightArena }
export type FightMove =
  | { type: 'attack'; targetId: string; weapon?: string }
  | { type: 'signet'; targetId: string; intensity: number; strainRoom: number }
  | { type: 'potion'; dice?: string; name?: string }
  | { type: 'flee' } | { type: 'yield' };
/** `id` is the fighter that was hit or healed; `key` is unique per flash (the stage's StageFlash shape). */
export interface FightFlash { id: string; kind: 'hit' | 'heal'; amount: number; key: string }

export interface SoloFightOptions {
  /** Who is asking (from the rules hook). Null while the engine is off: then there are no fights. */
  getContext: () => RulesContext | null;
  /** The sheet as the fight should see it when it starts. */
  getSheet: () => NonNullable<RulesContext['sheet']>;
  riderName: string;
  /** The server says a fight is open (after a reload): pick it up. */
  resume: boolean;
  /** Results that came with a reply (the fight's end) go through the rules hook's once-only path. */
  onInbox: (inbox: RulesInboxEvent[]) => void;
  /** Strain spent by a signet move, as the server charged it (an older server that keeps no strain). */
  onStrain: (amount: number) => void;
  /** Signet Strain after a move, as the server keeps it. */
  onStrainNow?: (strain: number) => void;
}

export function useSoloFight(opts: SoloFightOptions) {
  const [fight, setFight] = useState<FightView | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<FightLogLine | null>(null);
  const [flashes, setFlashes] = useState<FightFlash[]>([]);
  const optsRef = useRef(opts); optsRef.current = opts;
  const fightRef = useRef<FightView | null>(null); fightRef.current = fight;
  const skewRef = useRef(0);
  const shownRef = useRef(0);
  const queueRef = useRef<FightLogLine[]>([]);
  const tickingRef = useRef(false);
  // Bumped after every check-in attempt so the next one is always scheduled, even when a call
  // failed or the phone was in the background.
  const [pulse, setPulse] = useState(0);
  const serverTime = useCallback(() => Date.now() + skewRef.current, []);

  const take = useCallback((reply: FightReply | null): FightReply | null => {
    if (!reply) return null;
    if (typeof reply.serverNow === 'number') skewRef.current = reply.serverNow - Date.now();
    if (reply.fight !== undefined) {
      const next = reply.fight;
      const prev = fightRef.current;
      if (next && prev && next.id !== prev.id) { shownRef.current = 0; queueRef.current = []; }
      if (next) {
        const fresh = next.log.filter(l => l.n > shownRef.current);
        if (fresh.length) {
          shownRef.current = fresh[fresh.length - 1].n;
          queueRef.current = [...queueRef.current, ...fresh].slice(-8);
          const hits = fresh.flatMap(l => l.flash && l.targetId && l.amount
            ? [{ id: l.targetId, kind: l.flash, amount: l.amount, key: `${next.id}-${l.n}` }] : []);
          if (hits.length) setFlashes(f => [...f, ...hits].slice(-12));
        }
      }
      fightRef.current = next;
      setFight(next);
    }
    if (reply.inbox?.length) optsRef.current.onInbox(reply.inbox);
    return reply;
  }, []);

  const send = useCallback(async (action: FightAction, extra: Record<string, unknown> = {}): Promise<FightReply | null> => {
    const ctx = optsRef.current.getContext();
    if (!ctx) return null;
    return take(await callFight(action, { ...ctx, sheet: optsRef.current.getSheet() }, { label: optsRef.current.riderName, odds: resolveOddsForContext('attack'), ...extra }));
  }, [take]);

  // The text feed: one line at a time; when lines pile up it moves faster.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = queueRef.current.shift();
      setLine(next ?? null);
    }, FIGHT_FEED_STEP_MS);
    return () => window.clearInterval(timer);
  }, []);
  const skipFeed = useCallback(() => { const next = queueRef.current.shift(); if (next) setLine(next); }, []);

  // Check in just before the next thing is due (the server waits for the exact moment), and at
  // least every few seconds so it knows the phone is still here.
  const dueAt = fight?.status === 'active' ? fight.nextDueAt : null;
  const fightId = fight?.id ?? null;
  const active = fight?.status === 'active';
  useEffect(() => {
    if (!active) return;
    const wait = dueAt != null ? Math.min(HEARTBEAT_MS, Math.max(MIN_TICK_MS, dueAt - serverTime() - 300)) : HEARTBEAT_MS;
    const timer = window.setTimeout(async () => {
      if (tickingRef.current) return;
      // In the background nothing is sent; the server holds the fight still for an absent phone.
      if (document.visibilityState !== 'visible') { setPulse(n => n + 1); return; }
      tickingRef.current = true;
      try { await send('fight_tick'); } finally { tickingRef.current = false; setPulse(n => n + 1); }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [active, dueAt, fightId, pulse, send, serverTime]);

  // Back from the background: check in at once.
  useEffect(() => {
    if (!active) return;
    const onShow = () => { if (document.visibilityState === 'visible' && !tickingRef.current) void send('fight_tick'); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [active, send]);

  // After a reload the server still has the fight: pick it up.
  useEffect(() => {
    if (opts.resume && !fightRef.current) void send('fight_tick');
  }, [opts.resume, send]);

  const start = useCallback(async (input: FightStart): Promise<boolean> => {
    setBusy(true);
    try {
      shownRef.current = 0; queueRef.current = []; setLine(null); setFlashes([]);
      const reply = await send('fight_start', { ...input });
      if (!reply) { toast.error('The fight server could not be reached. Try again.'); return false; }
      if (!reply.ok) { toast.error(reply.error || 'The fight could not start.'); return false; }
      return !!reply.fight;
    } finally { setBusy(false); }
  }, [send]);

  const act = useCallback(async (move: FightMove): Promise<boolean> => {
    setBusy(true);
    try {
      const reply = await send('fight_act', { move });
      if (!reply) { toast.error('The fight server could not be reached. Try again.'); return false; }
      if (typeof reply.strainNow === 'number') optsRef.current.onStrainNow?.(reply.strainNow);
      if (!reply.ok) { if (reply.error && reply.error !== 'Not ready yet.') toast.error(reply.error); return false; }
      if (typeof reply.strainNow !== 'number' && reply.strain) optsRef.current.onStrain(reply.strain);
      return true;
    } finally { setBusy(false); }
  }, [send]);

  const clash = useCallback(async (enemyId: string, side: ClashSide, tapAt: number): Promise<{ ok?: boolean; index?: number; quality?: ClashQuality } | null> => {
    const reply = await send('fight_clash', { enemyId, side, tapAt });
    return reply ? { ok: reply.ok, index: reply.index, quality: reply.quality } : null;
  }, [send]);

  const close = useCallback(async () => {
    fightRef.current = null; setFight(null); setLine(null); setFlashes([]); queueRef.current = []; shownRef.current = 0;
    await send('fight_close');
  }, [send]);

  return useMemo(() => ({ fight, busy, line, flashes, serverTime, start, act, clash, close, skipFeed }),
    [fight, busy, line, flashes, serverTime, start, act, clash, close, skipFeed]);
}

export type SoloFightApi = ReturnType<typeof useSoloFight>;