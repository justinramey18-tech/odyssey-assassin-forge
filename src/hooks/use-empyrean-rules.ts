// Solo Empyrean rules engine, phone side: keeps the latest server snapshot, runs actions, and
// applies each waiting result (HP, XP, gold, strain, rests, DM posts written while the app was
// closed) exactly once before confirming it to the server.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { currentRiderKey } from '@/lib/dragon-record';
import {
  callRules, type CheckRisk, type EventLevel, type PassActivity, type RulesAction, type RulesCheck,
  type RulesContext, type RulesInboxEvent, type RulesSnapshot, type StrainReason,
} from '@/lib/empyrean-rules-client';

const APPLIED_KEY = 'empyrean-rules-applied';
const POLL_MS = 60_000;
const POLL_FLIGHT_MS = 20_000;

function loadApplied(): string[] {
  try { const raw = getScopedItem(APPLIED_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; }
  catch { return []; }
}

export interface EmpyreanRulesOptions {
  /** Signed in, a saved campaign, and the feature on. */
  enabled: boolean;
  campaignId: string | null;
  dragonName?: string;
  bonded: boolean;
  getSheet: () => { level?: number; maxHp?: number; hp?: number; riderClass?: string | null };
  getPlace: () => { name?: string; kind?: string } | undefined;
  getCurrentHP: () => number;
  onHPChange: (change: number, type: 'damage' | 'healing') => void;
  onAddXP: (amount: number, source: string) => void;
  onGoldChange: (netChange: number) => void;
  /** The character sheet's own rest (HP, abilities, spell slots). */
  onSheetRest: (type: 'short' | 'long') => void;
  onStrain: (change: number | 'reset') => void;
  /** A DM post the server wrote while the app was closed. Return false if it could not be added yet. */
  onDmPost: (id: string, content: string) => boolean;
  onDragonTrust: (delta: number, reason: string) => void;
  /** The server moved the clock or the journey: reload the map. */
  onMapChanged: () => void;
  /** A fight's result has just been applied to the sheet (the payload says who fell and carries the line for the DM). */
  onFightResult?: (payload: Record<string, any>) => void;
  /** Poll faster while a journey is under way. */
  flying: boolean;
  /** Live clock: the solo screen is showing and nothing else owns the clock (the Map is closed). While true, each check-in lets real time pass in the game. */
  live?: boolean;
  /** The rider's Signet Strain limit right now (sent with every call; the server keeps strain under it). */
  getStrainLimit?: () => number;
  /** The server pushed strain up to the limit (a reckless rise): costs bond once (D-30). */
  onStrainLimit?: (reason: string) => void;
}

export function useEmpyreanRules(opts: EmpyreanRulesOptions) {
  const [snapshot, setSnapshot] = useState<RulesSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const appliedRef = useRef<string[]>(loadApplied());
  const scope = opts.enabled && opts.campaignId ? opts.campaignId : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const applyingRef = useRef(false);
  const snapshotRef = useRef<RulesSnapshot | null>(null);
  snapshotRef.current = snapshot;

  const context = useCallback((): RulesContext | null => {
    const o = optsRef.current;
    if (!o.enabled || !o.campaignId) return null;
    return {
      campaignId: o.campaignId, riderKey: currentRiderKey(), dragonName: o.bonded ? o.dragonName || undefined : undefined,
      bonded: o.bonded, sheet: o.getSheet(), place: o.getPlace(),
      ...(o.getStrainLimit ? { strainLimit: o.getStrainLimit() } : {}),
    };
  }, []);

  const applyOne = useCallback((e: RulesInboxEvent, strainOnServer = false): boolean => {
    const o = optsRef.current;
    const p = e.payload || {};
    if (e.kind === 'strain_limit') { o.onStrainLimit?.(e.reason || 'Signet Strain hit its limit'); return true; }
    if (e.kind === 'dm_post') return typeof p.content === 'string' && p.content.trim() ? o.onDmPost(e.id, p.content) : true;
    // The sheet's handler adds the number it is given: damage goes in negative, healing positive.
    if (e.hp < 0) o.onHPChange(e.hp, 'damage');
    if (e.hp > 0) o.onHPChange(e.hp, 'healing');
    if (e.xp > 0) o.onAddXP(e.xp, e.reason || 'Empyrean');
    if (e.gold !== 0) o.onGoldChange(e.gold);
    if (e.kind === 'rest') o.onSheetRest(p.rest === 'long' ? 'long' : 'short');
    // When the server keeps strain, its number arrives with the snapshot; the changes are not applied again here.
    if (!strainOnServer) {
      if (p.strainReset === true) o.onStrain('reset');
      else if (typeof p.strainDelta === 'number' && p.strainDelta !== 0) o.onStrain(p.strainDelta);
      if (typeof p.strain === 'number' && p.strain > 0) o.onStrain(p.strain);
    }
    if (e.kind === 'dragon_need' && typeof p.trust === 'number') o.onDragonTrust(p.trust, e.reason || "The dragon's needs went unmet");
    if (e.kind === 'quest_payout' || e.kind === 'story_xp' || e.kind === 'story_gold') {
      const bits = [e.xp ? `${e.xp} XP` : '', e.gold > 0 ? `${e.gold} gold` : '', e.gold < 0 ? `${-e.gold} gold spent` : ''].filter(Boolean);
      if (bits.length) toast.success(bits.join(', '), { description: e.reason || undefined });
    }
    if (e.kind === 'dragon_need') toast(e.reason || 'Your dragon is unhappy', { icon: '🐉' });
    // The progression web names itself when it does something.
    if (e.kind === 'regen') toast.success(e.reason || 'Regeneration');
    if (typeof p.wardSoaked === 'number' && p.wardSoaked > 0) toast(`Your Ward absorbed ${p.wardSoaked} damage`);
    if (e.kind === 'fight') {
      if (e.xp > 0) toast.success(`${e.xp} XP`, { description: e.reason || undefined });
      o.onFightResult?.(p);
    }
    return true;
  }, []);

  /** Apply what is waiting, once each, then confirm. A result is marked before it is applied, so a crash can never apply it twice. */
  const applyInbox = useCallback(async (snap: RulesSnapshot, ctx: RulesContext) => {
    if (applyingRef.current || !snap.inbox?.length) return;
    applyingRef.current = true;
    const strainOnServer = typeof snap.strain === 'number';
    try {
      const done: string[] = [];
      let mapTouched = false;
      for (const e of snap.inbox) {
        if (scopeRef.current !== ctx.campaignId) break;
        if (appliedRef.current.includes(e.id)) { done.push(e.id); continue; }
        if (e.kind === 'dm_post') {
          if (!applyOne(e)) continue; // the story is not ready; try again on the next refresh
          mapTouched = true;
        } else {
          appliedRef.current = [...appliedRef.current, e.id].slice(-300);
          setScopedItem(APPLIED_KEY, JSON.stringify(appliedRef.current));
          try { applyOne(e, strainOnServer); } catch (err) { console.error('[empyrean-rules] apply failed', err); }
          done.push(e.id);
          continue;
        }
        appliedRef.current = [...appliedRef.current, e.id].slice(-300);
        setScopedItem(APPLIED_KEY, JSON.stringify(appliedRef.current));
        done.push(e.id);
      }
      if (mapTouched) optsRef.current.onMapChanged();
      if (done.length) {
        const after = await callRules('ack', ctx, { ids: done });
        if (after && scopeRef.current === ctx.campaignId) setSnapshot(after);
      }
    } finally {
      applyingRef.current = false;
    }
  }, [applyOne]);

  const run = useCallback(async (action: RulesAction, extra: Record<string, unknown> = {}, quiet = false): Promise<RulesSnapshot | null> => {
    const ctx = context();
    if (!ctx) return null;
    if (!quiet) setBusy(true);
    try {
      const snap = await callRules(action, ctx, extra);
      if (scopeRef.current !== ctx.campaignId) return null;
      if (!snap) { if (!quiet) toast.error('The game server could not be reached. Try again.'); return null; }
      setSnapshot(snap);
      if (!snap.ok && snap.error && !quiet) toast.error(snap.error);
      void applyInbox(snap, ctx);
      return snap;
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [context, applyInbox]);

  // Live clock: tell the server the solo screen is live; when the server moved the clock, reload the map's copy of it.
  const lastMinuteRef = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const live = optsRef.current.live === true;
    const snap = await run('state', live ? { live: true } : {}, true);
    if (snap) {
      const before = lastMinuteRef.current;
      lastMinuteRef.current = snap.minute;
      if (live && before !== null && !snap.traveling && snap.minute - before >= 1) optsRef.current.onMapChanged();
    }
    return snap;
  }, [run]);

  // Load on open and on campaign change.
  useEffect(() => {
    setSnapshot(null);
    appliedRef.current = loadApplied();
    if (scope) void refresh();
  }, [scope, refresh]);
  // Poll while the screen is visible (faster during a flight), and when the app comes back.
  useEffect(() => {
    if (!scope) return;
    const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(tick, opts.flying ? POLL_FLIGHT_MS : POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [scope, opts.flying, refresh]);

  const timed = useCallback(async (action: 'rest' | 'pass_time', extra: Record<string, unknown>): Promise<boolean> => {
    const snap = await run(action, extra);
    if (!snap?.ok) return false;
    if (snap.summary) toast.success(snap.summary);
    optsRef.current.onMapChanged();
    return true;
  }, [run]);

  const api = useMemo(() => ({
    rest: (kind: 'short' | 'long') => timed('rest', { kind }),
    passTime: (hours: number, activity: PassActivity) => timed('pass_time', { hours, activity }),
    check: async (input: { d20: number; modifier: number; dc: number | null; risk: CheckRisk; label: string }): Promise<RulesCheck | null> => {
      const snap = await run('check', input, true);
      return snap?.ok && snap.check ? snap.check : null;
    },
    signetUsed: (intensity: number) => {
      void run('signet_used', { intensity }, true).then(snap => {
        if (snap?.ok && snap.freeChannel) toast.success('Deep Well: this channel cost no strain');
        if (snap?.ok && snap.blood && snap.blood.hp > 0) toast.warning(`Lifeblood: ${snap.blood.hp} HP paid to push ${snap.blood.points} past your limit`);
      });
    },
    /** Damage the DM narrated asks the Ward first; the server takes it off the Ward it keeps. */
    wardSoak: (amount: number) => { void run('ward_soak', { amount }, true); },
    /** Spend XP on a progression web node. The server decides; true when it was bought. */
    buyNode: async (nodeId: string): Promise<boolean> => {
      const snap = await run('web_buy', { nodeId });
      if (!snap?.ok || snap.bought?.id !== nodeId) return false;
      toast.success(`${snap.bought.name} unlocked`, { description: snap.bought.effect });
      return true;
    },
    /** Move Signet Strain for one of the fixed reasons (the server sets the amount and keeps the number). */
    strain: (reason: StrainReason, extra: { messageId?: string; channeled?: boolean; amount?: number } = {}) => { void run('strain', { reason, ...extra }, true); },
    /** A Prodigy's Battle Brief: the binding line for the DM, or null (the server said why). */
    battleBrief: async (): Promise<{ line: string; left: number } | null> => {
      const snap = await run('battle_brief');
      return snap?.ok && snap.brief ? snap.brief : null;
    },
    /** A finished quest's XP and gold (once per quest on the server; the reward arrives through the inbox). */
    questPayout: async (p: { questKey: string; challenge: string; title: string; xp: number; gold: number }): Promise<'paid' | 'off' | 'refused' | 'unconfirmed'> => {
      if (!context()) return 'off';
      const snap = await run('quest_payout', { questKey: p.questKey, challenge: p.challenge, title: p.title, xp: p.xp, gold: p.gold }, true);
      return !snap ? 'unconfirmed' : snap.ok ? 'paid' : 'refused';
    },
    storyReward: (kind: 'xp' | 'gold', amount: number, source: string) => { void run('story_reward', { kind, amount, source }, true); },
    setEvents: (level: EventLevel) => run('set_events', { level }),
    eventDone: () => { void run('event_done', {}, true); },
    /** The DM's reply covered more than the moment: the server moves the clock (4 hours at most, once per turn). True when time moved. */
    storyTime: async (minutes: number, turnId: string): Promise<boolean> => {
      const snap = await run('story_time', { minutes, messageId: turnId }, true);
      if (!snap?.ok || !snap.summary) return false;
      toast(snap.summary, { icon: '🕰️' });
      lastMinuteRef.current = snap.minute;
      optsRef.current.onMapChanged();
      return true;
    },
    travel: async (action: 'launch' | 'sync' | 'cancel', extra: Record<string, unknown> = {}): Promise<boolean> =>
      !!(await run(`travel_${action}` as RulesAction, extra, true))?.ok,
    refresh,
    /** Who is asking, for calls made outside this hook (the fight hook). Null while the engine is off. */
    context,
    /** Apply results that arrived with another reply (a fight's end) through the same once-only path. */
    absorbInbox: (inbox: RulesInboxEvent[]) => {
      const ctx = context();
      const cur = snapshotRef.current;
      if (ctx && cur && inbox.length) void applyInbox({ ...cur, inbox }, ctx);
    },
  }), [run, timed, refresh, context, applyInbox]);

  const active = !!scope && !!snapshot;
  /** Signet Strain as the server keeps it; null while the engine is off or the server is older. */
  const serverStrain = active && typeof snapshot?.strain === 'number' ? snapshot.strain : null;
  /** The progression web; null while the engine is off or the server is older. */
  const web = active && snapshot?.web ? snapshot.web : null;
  /** The progression web's Ward (null: none) and the price of blood (0: no Lifeblood). */
  const ward = active && snapshot?.ward && snapshot.ward.max > 0 ? snapshot.ward : null;
  const bloodPrice = active ? Math.max(0, Math.trunc(Number(snapshot?.bloodPrice)) || 0) : 0;
  return { ...api, snapshot, busy, active, serverStrain, web, ward, bloodPrice };
}

export type EmpyreanRulesApi = ReturnType<typeof useEmpyreanRules>;
