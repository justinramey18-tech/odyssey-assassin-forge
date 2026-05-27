import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadBondState,
  saveBondState,
  addTrust,
  reduceTrust,
  detectRiderDeclaration,
  addBond,
  addMemory,
  DEFAULT_TRUST,
  DEFAULT_BOND,
  type DragonBondState,
} from '@/lib/dragonBondState';
import { computeTrustDelta } from '@/lib/bondTrust';
import { isEllieEasterEgg } from '@/lib/easter-eggs';

interface UseDragonBondOptions {
  dragonName: string;
  characterName: string;
  onTrustChange?: (delta: number, reason: string) => void;
  onBondChange?: (delta: number, reason: string) => void;
}

const DECAY_DAYS = 7;

export function useDragonBond({ dragonName, characterName, onTrustChange, onBondChange }: UseDragonBondOptions) {
  const [bondState, setBondState] = useState<DragonBondState>(() => {
    const state = loadBondState();
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

  // Persist helper
  const persist = useCallback((next: DragonBondState) => {
    setBondState(next);
    saveBondState(next);
  }, []);

  // Reload from storage
  const reload = useCallback(() => {
    setBondState(loadBondState());
  }, []);

  // Listen for character switches
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('odyssey-character-loaded', handler);
    return () => window.removeEventListener('odyssey-character-loaded', handler);
  }, [reload]);

  const processExchange = useCallback((playerMessage: string, _dragonResponse: string) => {
    setBondState(prev => {
      let state = {
        ...prev,
        totalChatExchanges: prev.totalChatExchanges + 1,
        sessionChatCount: prev.sessionChatCount + 1,
        lastContactTimestamp: new Date().toISOString(),
      };

      const result = computeTrustDelta({
        message: playerMessage,
        totalChatExchanges: state.totalChatExchanges,
        bond: state.bond ?? 15,
      });
      const { trustDelta, reason } = result;

      if (trustDelta > 0) {
        state = addTrust(state, trustDelta);
        onTrustChangeRef.current?.(trustDelta, reason);
      } else if (trustDelta < 0) {
        state = reduceTrust(state, Math.abs(trustDelta));
        onTrustChangeRef.current?.(trustDelta, reason);
        state = { ...state, mood: 'distant' as const };
      }

      const emotionalLog = [...(state.riderEmotionalLog || []), { tag: result.emotionTag, timestamp: new Date().toISOString() }].slice(-15);
      state = { ...state, riderEmotionalLog: emotionalLog };

      // Detect rider declarations and save as rider-said memories
      const declaration = detectRiderDeclaration(playerMessage);
      if (declaration) {
        state = addMemory(state, declaration, 'rider-said');
      }

      saveBondState(state);
      return state;
    });
  }, []);


  const processCombatBond = useCallback(() => {
    setBondState(prev => {
      const state = addBond(prev, 2);
      saveBondState(state);
      onBondChangeRef.current?.(2, 'shared danger');
      return state;
    });
  }, []);

  const processBondGrowth = useCallback((reason: string) => {
    setBondState(prev => {
      const state = addBond(prev, 3);
      saveBondState(state);
      onBondChangeRef.current?.(3, reason);
      return state;
    });
  }, []);

  const processBondStrain = useCallback((reason: string) => {
    setBondState(prev => {
      let state = reduceTrust(prev, 5);
      state = { ...state, mood: 'distant' };
      saveBondState(state);
      onTrustChangeRef.current?.(-5, reason);
      return state;
    });
  }, []);

  const checkDecay = useCallback(() => {
    setBondState(prev => {
      if (!prev.lastContactTimestamp || prev.unreadDragonMessages.length === 0) return prev;

      const lastContact = new Date(prev.lastContactTimestamp);
      const daysSince = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= DECAY_DAYS) {
        const state = reduceTrust(prev, 3);
        saveBondState(state);
        onTrustChangeRef.current?.(-3, 'neglected bond');
        return state;
      }
      return prev;
    });
  }, []);

  const addDragonMessage = useCallback((content: string) => {
    setBondState(prev => {
      const state: DragonBondState = {
        ...prev,
        unreadDragonMessages: [...prev.unreadDragonMessages, content],
      };
      saveBondState(state);
      return state;
    });
  }, []);

  const markChatOpened = useCallback(() => {
    setBondState(prev => {
      const now = new Date();
      const lastDate = prev.lastContactTimestamp ? new Date(prev.lastContactTimestamp).toDateString() : null;
      const isNewSession = lastDate !== now.toDateString();

      const state: DragonBondState = {
        ...prev,
        unreadDragonMessages: [],
        lastContactTimestamp: now.toISOString(),
        sessionChatCount: isNewSession ? 0 : prev.sessionChatCount,
      };
      saveBondState(state);
      return state;
    });
  }, []);

  const addNarrativeMemory = useCallback((text: string) => {
    setBondState(prev => {
      const state = addMemory(prev, text, 'campaign');
      saveBondState(state);
      return state;
    });
  }, []);

  return {
    bondState,
    processExchange,
    processBondStrain,
    processBondGrowth,
    processCombatBond,
    addDragonMessage,
    addNarrativeMemory,
    markChatOpened,
    checkDecay,
    reload,
  };
}
