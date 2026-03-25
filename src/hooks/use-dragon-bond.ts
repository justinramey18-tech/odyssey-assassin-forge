import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadBondState,
  saveBondState,
  addTrust,
  reduceTrust,
  detectTrustBreak,
  detectRiderDeclaration,
  classifyRiderEmotion,
  addBond,
  addMemory,
  type DragonBondState,
} from '@/lib/dragonBondState';

interface UseDragonBondOptions {
  dragonName: string;
  characterName: string;
  onTrustChange?: (delta: number, reason: string) => void;
  onBondChange?: (delta: number, reason: string) => void;
}

// Trust-building keyword patterns
const QUESTION_PATTERNS = [
  'how do you feel', 'what do you think', 'are you okay',
  'tell me about', 'what do you remember', 'do you want', 'how are you',
];
const GRATITUDE_PATTERNS = [
  'i trust you', 'thank you', "i'm glad", 'i appreciate',
  'you were right', "i'm sorry",
];
const VULNERABILITY_PATTERNS = [
  "i'm afraid", "i'm scared", "i don't know",
  'i need help', 'i failed', "i'm worried",
];
const AUTONOMY_PATTERNS = [
  'what would you prefer', 'your choice',
  "i won't force you", 'you decide',
];

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

const DECAY_DAYS = 7;
const SESSION_CHAT_CAP = 5;
const MAX_TRUST_PER_EXCHANGE = 4;

export function useDragonBond({ dragonName, characterName, onTrustChange, onBondChange }: UseDragonBondOptions) {
  const [bondState, setBondState] = useState<DragonBondState>(() => loadBondState());

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

      // Base trust (capped by session count)
      let trustDelta = state.sessionChatCount <= SESSION_CHAT_CAP ? 1 : 0;
      let reason = 'conversation';

      // Bonus patterns
      const questionMatch = matchesAny(playerMessage, QUESTION_PATTERNS);
      const gratitudeMatch = matchesAny(playerMessage, GRATITUDE_PATTERNS);
      const vulnerabilityMatch = matchesAny(playerMessage, VULNERABILITY_PATTERNS);
      const autonomyMatch = matchesAny(playerMessage, AUTONOMY_PATTERNS);

      if (questionMatch) {
        trustDelta += 1;
        reason = 'genuine curiosity';
      }
      if (gratitudeMatch) {
        trustDelta += 1;
        reason = 'trust and gratitude';
      }
      if (vulnerabilityMatch) {
        trustDelta += 2;
        reason = 'shared vulnerability';
      }
      if (autonomyMatch) {
        trustDelta += 1;
        reason = 'respecting autonomy';
      }

      // Trust-breaking overrides trust-building
      const trustBreak = detectTrustBreak(playerMessage);
      if (trustBreak.broken) {
        trustDelta = -trustBreak.severity;
        reason = trustBreak.reason;
        state = { ...state, mood: 'distant' as const };
      } else {
        // Cap positive trust
        trustDelta = Math.min(trustDelta, MAX_TRUST_PER_EXCHANGE);
      }

      if (trustDelta > 0) {
        state = addTrust(state, trustDelta);
        onTrustChangeRef.current?.(trustDelta, reason);
      } else if (trustDelta < 0) {
        state = reduceTrust(state, Math.abs(trustDelta));
        onTrustChangeRef.current?.(trustDelta, reason);
      }

      // Classify and log rider emotion
      const emotionTag = classifyRiderEmotion(
        playerMessage,
        trustBreak,
        { question: questionMatch, gratitude: gratitudeMatch, vulnerability: vulnerabilityMatch, autonomy: autonomyMatch },
      );
      const emotionalLog = [...(state.riderEmotionalLog || []), { tag: emotionTag, timestamp: new Date().toISOString() }].slice(-15);
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

  return {
    bondState,
    processExchange,
    processBondStrain,
    processCombatBond,
    addDragonMessage,
    markChatOpened,
    checkDecay,
    reload,
  };
}
