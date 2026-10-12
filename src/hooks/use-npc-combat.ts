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
  const [now, setNow] = useState(() => Date.now());

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

  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void reload(); }, 300);
  }, [reload]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fights', filter }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fight_combatants', filter }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_fight_events', filter }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_character_deaths', filter }, scheduleReload)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleReload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, partyId, reload, scheduleReload]);

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
  useEffect(() => {
    if (!needsClock || !visible || !fightId) return;
    const ping = () => { supabase.functions.invoke('npc-combat', { body: { action: 'ping', fightId } }).catch(() => {}); };
    ping();
    const timer = setInterval(ping, PING_MS);
    return () => clearInterval(timer);
  }, [needsClock, visible, fightId]);

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
    if (readyAt <= Date.now()) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= readyAt) clearInterval(timer);
    }, 1000);
    setNow(Date.now());
    return () => clearInterval(timer);
  }, [readyAt]);

  const call = useCallback(async (body: Record<string, unknown>, fallback: string): Promise<any | null> => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('npc-combat', { body });
      if (error) {
        const { message } = await readableFunctionError(error, fallback);
        toast.error(message);
        return null;
      }
      void reload();
      return data ?? {};
    } catch {
      toast.error(fallback);
      return null;
    } finally {
      setBusy(false);
    }
  }, [reload]);

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

  const castFromCard = useCallback((targetId: string, card: ActionCard, finish?: Finish) =>
    fightId ? call({ action: 'cast_card', fightId, targetId, card, finish }, 'The spell did not land. Try again.') : Promise.resolve(null),
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
