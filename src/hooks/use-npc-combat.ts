// Live NPC Combat: one phone's view of the party's current fight.
// Phones only read the fight tables; every change goes through the npc-combat function.
// The HP inbox puts each hit or heal aimed at this player on their sheet exactly once.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { readableFunctionError } from '@/lib/live-npcs';
import { castSpellByName } from '@/lib/magic/castBus';
import type { ActionCard } from '@/lib/roundChatActionCard';

type Tables = Database['public']['Tables'];
export type FightRow = Tables['party_fights']['Row'];
export type FighterRow = Tables['party_fight_combatants']['Row'];
export type FightEventRow = Tables['party_fight_events']['Row'];
export type FallenRow = Tables['party_character_deaths']['Row'];

type Finish = 'knockout' | 'kill';

export interface UseNpcCombatOptions {
  partyId: string | null;
  currentUserId: string | null;
  isHost: boolean;
  sheetHp: number | null;
  onHPChange?: (change: number, type: 'damage' | 'healing') => void;
}

const ENDED_GRACE_MS = 3 * 60_000;
const PING_MS = 5_000;
/** Speed: check in this long before an NPC turn, wind-up, death save or huddle end is due; the server waits for the exact moment. */
const EARLY_PING_MS = 500;
/** Speed: if nothing changed this long after it was due, check in once more (a lost check-in, or a phone clock far off). */
const RETRY_PING_MS = 1_200;
/** Speed: live changes update the screen at once; a full reload follows this long after a burst, as a safety net. */
const SAFETY_RELOAD_MS = 2_000;
/** Speed: a full reload at least this often while a fight is open, in case a live message was missed. */
const RESYNC_MS = 30_000;
const EVENTS_KEPT = 60;
/** Speed: actions that roll dice, so the fight bar can show dice tumbling while the server answers. */
const ROLL_ACTIONS = new Set(['open', 'attack', 'cast', 'cast_card', 'second_wind', 'stabilize', 'give_potion']);
const SYNC_WAIT_MS = 3_000;
const ACTION_COOLDOWN_MS = 8_000;
const APPLIED_KEEP = 300;

const appliedKey = (fightId: string, userId: string) => `odyssey-fight-applied-${fightId}-${userId}`;

function readApplied(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeApplied(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-APPLIED_KEEP)));
  } catch { /* storage full or blocked */ }
}

/** A fight still worth following: open, recently ended, or a defeat with someone still down. */
function isCurrentFight(fight: FightRow | null, fighters: FighterRow[]): boolean {
  if (!fight) return false;
  if (fight.status === 'active' || fight.status === 'paused') return true;
  const endedAt = fight.ended_at ? Date.parse(fight.ended_at) : NaN;
  if (Number.isFinite(endedAt) && Date.now() - endedAt < ENDED_GRACE_MS) return true;
  return fight.outcome === 'defeat' && fighters.some(f => f.kind === 'player' && f.status === 'down');
}

/** A fighter's Resolve right now: the saved value plus what has filled since, kept between 0 and 100. */
export function resolveOf(
  f: { resolve?: number | null; resolve_at?: string | null; resolve_rate?: number | null } | null | undefined,
  nowMs: number,
): number {
  if (!f) return 0;
  const at = f.resolve_at ? Date.parse(f.resolve_at) : NaN;
  const secs = Number.isFinite(at) ? Math.max(0, (nowMs - at) / 1000) : 0;
  const base = Number.isFinite(f.resolve) ? Number(f.resolve) : 0;
  const rate = Number.isFinite(f.resolve_rate) ? Number(f.resolve_rate) : 1;
  return Math.min(100, Math.max(0, base + rate * secs));
}

export function useNpcCombat({ partyId, currentUserId, isHost, sheetHp, onHPChange }: UseNpcCombatOptions) {
  const [fight, setFight] = useState<FightRow | null>(null);
  const [fighters, setFighters] = useState<FighterRow[]>([]);
  const [events, setEvents] = useState<FightEventRow[]>([]);
  const [fallen, setFallen] = useState<FallenRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Speed: the server's clock. Phones' clocks can be seconds off, which would make countdowns end early or late.
  // Each check-in returns serverNow; the reply with the shortest round trip gives the best estimate of the gap.
  const clockOffsetRef = useRef(0);
  const bestRoundTripRef = useRef(Number.POSITIVE_INFINITY);
  const [clockOffset, setClockOffset] = useState(0);
  const serverTime = useCallback(() => Date.now() + clockOffsetRef.current, []);
  const noteServerTime = useCallback((sentAt: number, data: unknown) => {
    const serverNow = Number((data as { serverNow?: unknown } | null)?.serverNow);
    const receivedAt = Date.now();
    const roundTrip = receivedAt - sentAt;
    if (!Number.isFinite(serverNow) || roundTrip < 0 || roundTrip > 3_000 || roundTrip > bestRoundTripRef.current) return;
    bestRoundTripRef.current = roundTrip;
    const offset = Math.round(serverNow - (sentAt + receivedAt) / 2);
    if (Math.abs(offset - clockOffsetRef.current) < 30) return;
    clockOffsetRef.current = offset;
    setClockOffset(offset);
  }, []);
  /** "I'm here": runs the fight clock on the server, and measures the server's clock on the way back. */
  const checkIn = useCallback((id: string) => {
    const sentAt = Date.now();
    supabase.functions.invoke('npc-combat', { body: { action: 'ping', fightId: id } })
      .then(({ data }) => noteServerTime(sentAt, data))
      .catch(() => {});
  }, [noteServerTime]);

  const enabled = !!partyId && !!currentUserId;
  const reloadSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRef = useRef<Set<string>>(new Set());
  const lastAppliedAtRef = useRef(0);
  const lastSyncAtRef = useRef(0);
  const onHPChangeRef = useRef(onHPChange);
  onHPChangeRef.current = onHPChange;

  const reload = useCallback(async () => {
    if (!partyId || !currentUserId) return;
    const seq = ++reloadSeq.current;
    const [{ data: fightRows }, { data: fallenRows }] = await Promise.all([
      supabase.from('party_fights').select('*').eq('party_id', partyId).order('started_at', { ascending: false }).limit(1),
      supabase.from('party_character_deaths').select('*').eq('party_id', partyId).is('revived_at', null),
    ]);
    const newest = (fightRows?.[0] as FightRow | undefined) ?? null;
    let nextFighters: FighterRow[] = [];
    let nextEvents: FightEventRow[] = [];
    if (newest) {
      const [{ data: fighterRows }, { data: eventRows }] = await Promise.all([
        supabase.from('party_fight_combatants').select('*').eq('fight_id', newest.id),
        supabase.from('party_fight_events').select('*').eq('fight_id', newest.id).order('created_at', { ascending: false }).limit(60),
      ]);
      nextFighters = (fighterRows as FighterRow[] | null) ?? [];
      nextEvents = ((eventRows as FightEventRow[] | null) ?? []).slice().reverse();
    }
    if (seq !== reloadSeq.current) return;
    const current = isCurrentFight(newest, nextFighters);
    setFight(current ? newest : null);
    setFighters(current ? nextFighters : []);
    setEvents(current ? nextEvents : []);
    setFallen((fallenRows as FallenRow[] | null) ?? []);
  }, [partyId, currentUserId]);

  const scheduleReload = useCallback((delay = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void reload(); }, delay);
  }, [reload]);

  // Speed: apply each live change to the screen the moment it arrives, then a quiet full reload as a safety net.
  const fightIdRef = useRef<string | null>(null);
  type Change = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Record<string, unknown>; old: Record<string, unknown> };
  const onFighterChange = useCallback((c: Change) => {
    const row = c.new as unknown as FighterRow;
    const oldId = (c.old as { id?: string }).id;
    if (c.eventType === 'DELETE') {
      if (oldId) setFighters(prev => prev.filter(f => f.id !== oldId));
    } else if (row?.id && row.fight_id === fightIdRef.current) {
      setFighters(prev => {
        const i = prev.findIndex(f => f.id === row.id);
        if (i === -1) return [...prev, row];
        const next = prev.slice();
        next[i] = { ...prev[i], ...row };
        return next;
      });
    }
    scheduleReload(SAFETY_RELOAD_MS);
  }, [scheduleReload]);
  const onEventChange = useCallback((c: Change) => {
    const row = c.new as unknown as FightEventRow;
    if (c.eventType !== 'DELETE' && row?.id && row.fight_id === fightIdRef.current) {
      setEvents(prev => {
        const i = prev.findIndex(e => e.id === row.id);
        if (i !== -1) {
          const next = prev.slice();
          next[i] = { ...prev[i], ...row };
          return next;
        }
        const next = [...prev, row].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
        return next.length > EVENTS_KEPT ? next.slice(next.length - EVENTS_KEPT) : next;
      });
    }
    scheduleReload(SAFETY_RELOAD_MS);
  }, [scheduleReload]);
  const onFightChange = useCallback((c: Change) => {
    const row = c.new as unknown as FightRow;
    // The same fight changed (paused, resumed, ended): show it now. A new fight: load it properly.
    if (c.eventType === 'UPDATE' && row?.id && row.id === fightIdRef.current) {
      setFight(prev => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
      scheduleReload(SAFETY_RELOAD_MS);
    } else {
      scheduleReload();
    }
  }, [scheduleReload]);

  // Speed: whether live updates are flowing (a "Reconnecting…" chip shows when they aren't).
  const [connection, setConnection] = useState<'live' | 'reconnecting'>('live');
  const wasDownRef = useRef(false);

  // NPC lines in the Live Table: when each NPC (by npc_id) last spoke, so the fight bar can show "typing…" until the line arrives.
  const [lastLineAt, setLastLineAt] = useState<Record<string, number>>({});

  // Load, live changes, and coming back to the page.
  useEffect(() => {
    if (!enabled || !partyId) {
      setFight(null); setFighters([]); setEvents([]); setFallen([]);
      return;
    }
    void reload();
    const filter = `party_id=eq.${partyId}`;
    const channel = supabase
      .channel(`npc-combat-${partyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fights', filter }, p => onFightChange(p as unknown as Change))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fight_combatants', filter }, p => onFighterChange(p as unknown as Change))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fight_events', filter }, p => onEventChange(p as unknown as Change))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_character_deaths', filter }, () => scheduleReload())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_round_chat', filter }, p => {
        const row = (p as unknown as Change).new as { npc_id?: string | null; created_at?: string };
        const npcId = row?.npc_id;
        if (npcId) {
          const at = row.created_at ? Date.parse(row.created_at) : NaN;
          setLastLineAt(prev => ({ ...prev, [npcId]: Number.isFinite(at) ? at : serverTime() }));
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          // Back after a drop: catch up on anything missed.
          if (wasDownRef.current) { wasDownRef.current = false; scheduleReload(); }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDownRef.current = true;
          setConnection('reconnecting');
        }
      });
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleReload(); };
    const onOffline = () => { wasDownRef.current = true; setConnection('reconnecting'); };
    const onOnline = () => { setConnection('live'); scheduleReload(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    // Speed: wake the fight function up now, so the first attack doesn't wait for it to start.
    const warmSentAt = Date.now();
    supabase.functions.invoke('npc-combat', { body: { action: 'warm' } })
      .then(({ data }) => noteServerTime(warmSentAt, data))
      .catch(() => {});
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, partyId, reload, scheduleReload, onFightChange, onFighterChange, onEventChange, noteServerTime, serverTime]);

  const myFighter = useMemo(
    () => fighters.find(f => f.user_id === currentUserId) ?? null,
    [fighters, currentUserId],
  );
  const iHaveFallen = useMemo(
    () => !!currentUserId && fallen.some(f => f.user_id === currentUserId),
    [fallen, currentUserId],
  );
  const isEnded = fight?.status === 'ended';
  const needsClock = !!fight && (!isEnded
    || (fight.outcome === 'defeat' && fighters.some(f => f.kind === 'player' && f.status === 'down')));

  // The fight clock: NPC turns and death saves move forward while a phone is watching.
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const fightId = fight?.id ?? null;
  fightIdRef.current = fightId;
  useEffect(() => {
    if (!needsClock || !visible || !fightId) return;
    const ping = () => checkIn(fightId);
    ping();
    const timer = setInterval(ping, PING_MS);
    return () => clearInterval(timer);
  }, [needsClock, visible, fightId, checkIn]);

  // Speed: also check in just before the next thing is due (an NPC turn or wind-up, a death save, a huddle's end).
  // The server waits for the exact moment, so NPC hits land as the countdown reaches zero.
  const nextDueAt = useMemo(() => {
    if (!fight || fight.status === 'ended') return NaN;
    const times: number[] = [];
    const at = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN);
    const pause = fight as unknown as { pause_kind?: string | null; paused_until?: string | null };
    if (fight.status === 'paused') {
      if (pause.pause_kind === 'huddle') times.push(at(pause.paused_until));
    } else {
      for (const f of fighters) {
        if (f.kind === 'npc' && f.status === 'up') {
          const pending = (f as unknown as { pending?: unknown }).pending;
          times.push(at(pending ? (f as unknown as { strike_at?: unknown }).strike_at : f.next_action_at));
        } else if (f.kind === 'player' && f.status === 'down') {
          times.push(at(f.next_save_at));
        }
      }
    }
    const valid = times.filter(t => Number.isFinite(t));
    return valid.length ? Math.min(...valid) : NaN;
  }, [fight, fighters]);
  useEffect(() => {
    if (!needsClock || !visible || !fightId || !Number.isFinite(nextDueAt)) return;
    const untilDue = nextDueAt - serverTime();
    if (untilDue > PING_MS + 1000) return; // the regular check-in gets there first
    const early = setTimeout(() => checkIn(fightId), Math.max(0, untilDue - EARLY_PING_MS));
    // Still not moved on a little after it was due (this effect re-runs when it does): check in once more.
    const retry = setTimeout(() => checkIn(fightId), Math.max(0, untilDue + RETRY_PING_MS));
    return () => { clearTimeout(early); clearTimeout(retry); };
  }, [needsClock, visible, fightId, nextDueAt, serverTime, checkIn]);

  // Speed: a quiet full reload every 30 s while a fight is open, in case a live message was missed.
  useEffect(() => {
    if (!fightId || isEnded || !visible) return;
    const timer = setInterval(() => { void reload(); }, RESYNC_MS);
    return () => clearInterval(timer);
  }, [fightId, isEnded, visible, reload]);

  // HP inbox: each hit or heal aimed at me lands on my sheet exactly once.
  const inbox = useMemo(
    () => events.filter(e => e.target_user_id === currentUserId && e.hp_delta !== 0 && !e.applied_at),
    [events, currentUserId],
  );
  useEffect(() => {
    const apply = onHPChangeRef.current;
    if (!apply || !currentUserId || inbox.length === 0) return;
    const appliedIds: string[] = [];
    for (const ev of inbox) {
      const key = appliedKey(ev.fight_id, currentUserId);
      if (applyingRef.current.has(ev.id)) continue;
      const list = readApplied(key);
      if (list.includes(ev.id)) { applyingRef.current.add(ev.id); continue; }
      const delta = Number(ev.hp_delta);
      if (!Number.isFinite(delta) || delta === 0) continue;
      applyingRef.current.add(ev.id);
      list.push(ev.id);
      writeApplied(key, list);
      apply(delta, delta < 0 ? 'damage' : 'healing');
      appliedIds.push(ev.id);
    }
    if (appliedIds.length > 0) {
      lastAppliedAtRef.current = Date.now();
      supabase.functions.invoke('npc-combat', { body: { action: 'ack', eventIds: appliedIds } }).catch(() => {});
    }
  }, [inbox, currentUserId]);

  // Sheet HP sync: healing outside the fight (potion, rest, story) reaches the referee.
  const hasPendingInbox = !!onHPChange && inbox.some(e => !applyingRef.current.has(e.id));
  const canSync = !!fightId && !isEnded && !!myFighter && myFighter.status !== 'dead' && !hasPendingInbox
    && typeof sheetHp === 'number' && Number.isFinite(sheetHp) && sheetHp !== myFighter.hp;
  useEffect(() => {
    if (!canSync || !fightId || typeof sheetHp !== 'number') return;
    const timer = setTimeout(() => {
      const t = Date.now();
      if (t - lastSyncAtRef.current < SYNC_WAIT_MS) return;
      if (t - lastAppliedAtRef.current < SYNC_WAIT_MS) return;
      lastSyncAtRef.current = t;
      supabase.functions.invoke('npc-combat', { body: { action: 'sync_hp', fightId, hp: sheetHp } }).catch(() => {});
    }, SYNC_WAIT_MS);
    return () => clearTimeout(timer);
  }, [canSync, fightId, sheetHp]);

  // Combat v2: pauses and huddles. While paused, the fight's clock stands still at paused_at.
  const pauseInfo = fight as unknown as { paused_at?: string | null; pause_kind?: string | null; paused_until?: string | null; huddles_used?: Record<string, unknown> | null } | null;
  const isPausedNow = fight?.status === 'paused';
  const pauseKind: 'host' | 'huddle' | null = isPausedNow ? (pauseInfo?.pause_kind === 'huddle' ? 'huddle' : 'host') : null;
  const pausedAtMs = isPausedNow && pauseInfo?.paused_at ? Date.parse(pauseInfo.paused_at) : NaN;
  const huddleUntilMs = pauseKind === 'huddle' && pauseInfo?.paused_until ? Date.parse(pauseInfo.paused_until) : NaN;
  const myHuddleUsed = !!currentUserId && !!pauseInfo?.huddles_used?.[currentUserId];
  const fightClock = Number.isFinite(pausedAtMs) ? pausedAtMs : now;

  // Cooldown between my actions (frozen while the fight is paused).
  const lastActionAt = myFighter?.last_action_at ? Date.parse(myFighter.last_action_at) : NaN;
  const readyAt = Number.isFinite(lastActionAt) ? lastActionAt + ACTION_COOLDOWN_MS : 0;
  const cooldownLeft = readyAt > fightClock ? Math.ceil((readyAt - fightClock) / 1000) : 0;
  useEffect(() => {
    if (readyAt <= serverTime()) return;
    const timer = setInterval(() => {
      const t = serverTime();
      setNow(t);
      if (t >= readyAt) clearInterval(timer);
    }, 1000);
    setNow(serverTime());
    return () => clearInterval(timer);
  }, [readyAt, serverTime]);

  const call = useCallback(async (body: Record<string, unknown>, fallback: string): Promise<any | null> => {
    setBusy(true);
    setRolling(ROLL_ACTIONS.has(String(body.action)));
    try {
      const { data, error } = await supabase.functions.invoke('npc-combat', { body });
      if (error) {
        const { message } = await readableFunctionError(error, fallback);
        toast.error(message);
        return null;
      }
      scheduleReload(SAFETY_RELOAD_MS);
      return data ?? {};
    } catch {
      toast.error(fallback);
      return null;
    } finally {
      setBusy(false);
      setRolling(false);
    }
  }, [scheduleReload]);

  const openFight = useCallback((npcId: string, opts?: { weaponName?: string; finish?: Finish }) => {
    if (!partyId) return Promise.resolve(null);
    return call({ action: 'open', partyId, npcId, weaponName: opts?.weaponName, finish: opts?.finish }, 'The fight could not start. Try again.');
  }, [call, partyId]);

  const attack = useCallback((targetId: string, opts?: { weaponName?: string; finish?: Finish }) => {
    if (!fightId) return Promise.resolve(null);
    return call({ action: 'attack', fightId, targetId, weaponName: opts?.weaponName, finish: opts?.finish }, 'The attack did not go through. Try again.');
  }, [call, fightId]);

  const cast = useCallback(async (targetId: string, spell: { name: string; level: number }, intent: 'damage' | 'heal', finish?: Finish) => {
    if (!fightId) return null;
    const outcome = castSpellByName({ name: spell.name, level: spell.level });
    if (!outcome.ok && outcome.reason === 'no-slots') {
      toast.error(`No spell slots left for ${spell.name}.`);
      return null;
    }
    return call({ action: 'cast', fightId, targetId, spellName: spell.name, spellLevel: spell.level, intent, finish }, 'The spell did not go through. Try again.');
  }, [call, fightId]);

  // extraTargetIds: more targets for an area spell card (card.area), up to 3 in all.
  const castFromCard = useCallback((targetId: string, card: ActionCard, finish?: Finish, extraTargetIds?: string[]) =>
    fightId ? call({ action: 'cast_card', fightId, targetId, targetIds: extraTargetIds?.length ? extraTargetIds : undefined, card, finish }, 'The spell did not land. Try again.') : Promise.resolve(null),
  [call, fightId]);

  const secondWind = useCallback((targetId?: string) =>
    fightId ? call({ action: 'second_wind', fightId, targetId }, 'Second Wind did not go through. Try again.') : Promise.resolve(null),
  [call, fightId]);

  const drinkPotion = useCallback(async (itemName: string) => {
    if (!fightId) return null;
    try {
      const { data } = await supabase.functions.invoke('npc-combat', { body: { action: 'potion', fightId, itemName } });
      if (data?.resolve > 0) toast.success(`+${data.resolve} Resolve`);
      void reload();
      return data ?? null;
    } catch {
      return null;
    }
  }, [fightId, reload]);

  // Mini-games (v6). Taps are quiet (no busy lock, no rolling card, no toast) so they never block other buttons.
  const quiet = useCallback(async (body: Record<string, unknown>): Promise<any | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('npc-combat', { body });
      if (error) return null;
      return data ?? null;
    } catch {
      return null;
    }
  }, []);
  // Counter Clash: one tap on the ring. tapAt is the tap moment on the server's clock (whole ms), so slow connections aren't punished.
  const clash = useCallback((npcFighterId: string, side: 'left' | 'top' | 'right', tapAt: number) =>
    fightId ? quiet({ action: 'clash', fightId, npcId: npcFighterId, side, tapAt: Math.round(tapAt) }) : Promise.resolve(null),
  [quiet, fightId]);
  // Tug & Slip: one tap on Heave while pinned. Sent one after another in tap order, so the referee counts them in order.
  const heaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const heave = useCallback((tapAt: number) => {
    if (!fightId) return Promise.resolve(null);
    const run = heaveQueueRef.current.then(() => quiet({ action: 'heave', fightId, tapAt: Math.round(tapAt) }));
    heaveQueueRef.current = run.catch(() => null);
    return run.then(r => {
      if (r?.free) scheduleReload(300);
      return r;
    });
  }, [quiet, fightId, scheduleReload]);

  const stabilize = useCallback((targetId: string) => {
    if (!fightId) return Promise.resolve(null);
    return call({ action: 'stabilize', fightId, targetId }, 'Could not stabilize them. Try again.');
  }, [call, fightId]);

  // Pour one of my healing potions into an ally. The server rolls the healing; the caller removes the potion after success.
  const givePotion = useCallback((targetId: string, itemName: string) => {
    if (!fightId) return Promise.resolve(null);
    return call({ action: 'give_potion', fightId, targetId, itemName }, 'The potion did not reach them. Try again.');
  }, [call, fightId]);

  const hostCall = useCallback((body: Record<string, unknown>, fallback: string) => {
    if (!isHost) return Promise.resolve(null);
    return call(body, fallback);
  }, [call, isHost]);

  const pause = useCallback(() => fightId ? hostCall({ action: 'pause', fightId }, 'The fight could not be paused.') : Promise.resolve(null), [hostCall, fightId]);
  // Combat v2: any player can freeze the fight for 20 s to plan, once per fight.
  const huddle = useCallback(() => fightId ? call({ action: 'huddle', fightId }, 'The huddle could not start. Try again.') : Promise.resolve(null), [call, fightId]);
  const resume = useCallback(() => fightId ? hostCall({ action: 'resume', fightId }, 'The fight could not be resumed.') : Promise.resolve(null), [hostCall, fightId]);
  const endFight = useCallback(() => fightId ? hostCall({ action: 'end', fightId }, 'The fight could not be ended.') : Promise.resolve(null), [hostCall, fightId]);
  const addNpc = useCallback((npcId: string) => fightId ? hostCall({ action: 'add_npc', fightId, npcId }, 'That NPC could not join the fight.') : Promise.resolve(null), [hostCall, fightId]);
  const revivePlayer = useCallback((userId: string) => partyId ? hostCall({ action: 'revive', partyId, userId }, 'They could not be revived.') : Promise.resolve(null), [hostCall, partyId]);
  const reviveNpc = useCallback((npcId: string) => partyId ? hostCall({ action: 'revive', partyId, npcId }, 'The NPC could not be revived.') : Promise.resolve(null), [hostCall, partyId]);

  return {
    fight,
    fighters,
    events,
    fallen,
    myFighter,
    iHaveFallen,
    isActive: fight?.status === 'active',
    isPaused: fight?.status === 'paused',
    isEnded,
    busy,
    rolling,
    clockOffset,
    connection,
    lastLineAt,
    cooldownLeft,
    pauseKind,
    pausedAtMs,
    huddleUntilMs,
    myHuddleUsed,
    huddle,
    openFight,
    attack,
    cast,
    castFromCard,
    secondWind,
    clash,
    heave,
    serverTime,
    drinkPotion,
    stabilize,
    givePotion,
    pause,
    resume,
    endFight,
    addNpc,
    revivePlayer,
    reviveNpc,
  };
}

export type NpcCombatApi = ReturnType<typeof useNpcCombat>;
