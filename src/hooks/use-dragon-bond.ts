import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  detectRiderDeclaration,
  addMemory,
  DEFAULT_TRUST,
  DEFAULT_BOND,
} from '@/lib/dragonBondState';
import { computeTrustDelta } from '@/lib/bondTrust';
import { isEllieEasterEgg } from '@/lib/easter-eggs';
import { METER_RULES, neglectChargedThrough, neglectWeeks, type MeterChange } from '@/lib/dragon-meters';
import {
  commitDragonChange,
  connectDragonRecord,
  loadSoloDragonState,
  onDragonStateChange,
  updateDragonState,
  type SoloDragonState,
} from '@/lib/dragon-record';

interface UseDragonBondOptions {
  dragonName: string;
  characterName: string;
  onTrustChange?: (delta: number, reason: string) => void;
  onBondChange?: (delta: number, reason: string) => void;
}

/** Neglect is charged for at most this many weeks at once. */
const MAX_NEGLECT_WEEKS = 8;

/**
 * Solo Empyrean dragon bond (DECISIONS D-30). The phone copy shows at once; bond, trust and
 * wounds are saved on the server with a history entry for every change (src/lib/dragon-record.ts).
 */
export function useDragonBond({ dragonName, characterName, onTrustChange, onBondChange }: UseDragonBondOptions) {
  const [bondState, setBondState] = useState<SoloDragonState>(() => {
    const state = loadSoloDragonState();
    // Ellie Easter egg: if the dragon name includes "ellie" and bond state is
    // still at defaults (trust === 10, bond === 15), apply the elevated starting state.
    if (isEllieEasterEgg(dragonName) && state.trust === DEFAULT_TRUST && state.bond === DEFAULT_BOND) {
      return { ...state, trust: 25, mood: 'playful' as const };
    }
    return state;
  });

  const onTrustChangeRef = useRef(onTrustChange);
  const onBondChangeRef = useRef(onBondChange);
  useEffect(() => { onTrustChangeRef.current = onTrustChange; }, [onTrustChange]);
  useEffect(() => { onBondChangeRef.current = onBondChange; }, [onBondChange]);
  const dragonNameRef = useRef(dragonName);
  useEffect(() => { dragonNameRef.current = dragonName; }, [dragonName]);

  // Every change, from here, the bond chat or a server load, shows at once.
  useEffect(() => onDragonStateChange(setBondState), []);

  const reload = useCallback(() => {
    setBondState(loadSoloDragonState());
  }, []);

  /** Apply one meter change, tell the callbacks, and toast a wound opening or healing. */
  const change = useCallback((c: MeterChange, source: string, reason: string, edit?: (s: SoloDragonState) => SoloDragonState) => {
    // No bonded dragon (unbonded, before the Threshing): nothing to change.
    if (!dragonNameRef.current) return null;
    const r = commitDragonChange(c, source, reason, edit);
    if (r.applied.trust) onTrustChangeRef.current?.(r.applied.trust, reason);
    if (r.applied.bond) onBondChangeRef.current?.(r.applied.bond, reason);
    const name = dragonNameRef.current || 'Your dragon';
    if (r.woundOpened) toast(`A wound in the bond: ${reason}`, { icon: '🩸', description: `${name} won't trust as easily until you make amends.` });
    if (r.woundClosed) toast('A wound in the bond has healed', { icon: '💚', description: reason });
    return r;
  }, []);

  /** Full weeks apart cost bond (−1 a week) and, with whispers left unread, trust (−3 a week). */
  const chargeNeglect = useCallback(() => {
    const state = loadSoloDragonState();
    if (!state.lastContactTimestamp) return;
    const weeks = Math.min(MAX_NEGLECT_WEEKS, neglectWeeks(state.lastContactTimestamp, state.neglectChargedThrough, Date.now()));
    if (weeks <= 0) return;
    const through = neglectChargedThrough(state.lastContactTimestamp, state.neglectChargedThrough, weeks);
    const unread = state.unreadDragonMessages.length > 0;
    for (let i = 0; i < weeks; i++) {
      change(
        { bond: METER_RULES.neglectBondPerWeek, trust: unread ? METER_RULES.neglectTrustPerWeek : 0 },
        'neglect',
        unread ? 'A week apart, its whispers unanswered' : 'A week apart',
        i === weeks - 1 ? (s => ({ ...s, neglectChargedThrough: through })) : undefined,
      );
    }
  }, [change]);

  // Load the server record for this dragon (and again after a character switch), then charge
  // any neglect. No dragon (unbonded) means no record.
  const connect = useCallback(async () => {
    const name = dragonNameRef.current;
    // An empty name (unbonded) disconnects, so nothing reaches a fallen dragon's record.
    await connectDragonRecord({ dragonName: name || '', riderName: characterName });
    if (name) chargeNeglect();
  }, [characterName, chargeNeglect]);

  useEffect(() => { void connect(); }, [dragonName, connect]);

  useEffect(() => {
    const handler = () => { reload(); void connect(); };
    window.addEventListener('odyssey-character-loaded', handler);
    return () => window.removeEventListener('odyssey-character-loaded', handler);
  }, [reload, connect]);

  const processExchange = useCallback((playerMessage: string, _dragonResponse: string) => {
    const state = loadSoloDragonState();
    const totalChatExchanges = state.totalChatExchanges + 1;
    const result = computeTrustDelta({ message: playerMessage, totalChatExchanges, bond: state.bond ?? 15 });
    const declaration = detectRiderDeclaration(playerMessage);
    change({ trust: result.trustDelta }, 'chat', result.reason, s => {
      let next: SoloDragonState = {
        ...s,
        totalChatExchanges,
        sessionChatCount: s.sessionChatCount + 1,
        lastContactTimestamp: new Date().toISOString(),
        riderEmotionalLog: [...(s.riderEmotionalLog || []), { tag: result.emotionTag, timestamp: new Date().toISOString() }].slice(-15),
      };
      if (result.trustDelta < 0) next = { ...next, mood: 'distant' as const };
      if (declaration) next = addMemory(next, declaration, 'rider-said') as SoloDragonState;
      return next;
    });
  }, [change]);

  const processCombatBond = useCallback(() => {
    change({ bond: METER_RULES.sharedFight }, 'fight', 'shared danger');
  }, [change]);

  const processBondGrowth = useCallback((reason: string) => {
    change({ bond: METER_RULES.dmBondGrowth }, 'dm', reason);
  }, [change]);

  const processBondStrain = useCallback((reason: string) => {
    change({ trust: METER_RULES.dmBondStrainTrust }, 'dm', reason, s => ({ ...s, mood: 'distant' }));
  }, [change]);

  /** The DM marked amends in the story: one wound closes. */
  const processAmends = useCallback((reason: string) => {
    change({ amends: true }, 'amends', reason);
  }, [change]);

  /** Signet Strain pushed to its limit: the dragon pays for the rider's recklessness. */
  const processRecklessStrain = useCallback(() => {
    change({ bond: METER_RULES.recklessStrainBond }, 'strain', 'Pushed the signet to its limit');
  }, [change]);

  /** Any story message or dragon chat counts as time together (resets the neglect clock). */
  const touchContact = useCallback(() => {
    updateDragonState(s => ({ ...s, lastContactTimestamp: new Date().toISOString() }));
  }, []);

  /** Kept for the screen's open hook: reloads the record and charges neglect. */
  const checkDecay = useCallback(() => {
    void connect();
  }, [connect]);

  const addDragonMessage = useCallback((content: string) => {
    updateDragonState(s => ({ ...s, unreadDragonMessages: [...s.unreadDragonMessages, content] }));
  }, []);

  const markChatOpened = useCallback(() => {
    updateDragonState(s => {
      const now = new Date();
      const lastDate = s.lastContactTimestamp ? new Date(s.lastContactTimestamp).toDateString() : null;
      const isNewSession = lastDate !== now.toDateString();
      return {
        ...s,
        unreadDragonMessages: [],
        lastContactTimestamp: now.toISOString(),
        sessionChatCount: isNewSession ? 0 : s.sessionChatCount,
      };
    });
  }, []);

  /**
   * Quest hub rewards (Dragon & Bond quests): bond and trust from a finished quest, which also
   * counts as amends (one wound closes), or a small trust loss from a failed one.
   */
  const processQuestReward = useCallback((bondDelta: number, trustDelta: number, reason: string) => {
    if (!bondDelta && !trustDelta) return;
    change({ bond: bondDelta, trust: trustDelta, amends: bondDelta > 0 }, 'quest', reason);
  }, [change]);

  const addNarrativeMemory = useCallback((text: string) => {
    updateDragonState(s => addMemory(s, text, 'campaign') as SoloDragonState);
  }, []);

  return {
    bondState,
    processExchange,
    processBondStrain,
    processBondGrowth,
    processCombatBond,
    processQuestReward,
    processAmends,
    processRecklessStrain,
    touchContact,
    addDragonMessage,
    addNarrativeMemory,
    markChatOpened,
    checkDecay,
    reload,
  };
}
