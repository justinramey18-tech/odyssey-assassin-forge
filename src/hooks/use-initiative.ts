import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Enemy } from '@/lib/combat/targetTypes';

const STORAGE_KEY = 'odyssey-initiative';
const SYNC_EVENT = 'odyssey-initiative-sync';

export interface InitiativeCombatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
  isActive: boolean;
}

interface InitiativeState {
  playerInitiative: number | null;
  currentTurnId: string | null;
  roundNumber: number;
  combatStarted: boolean;
}

const DEFAULT_STATE: InitiativeState = {
  playerInitiative: null,
  currentTurnId: null,
  roundNumber: 1,
  combatStarted: false,
};

function loadState(): InitiativeState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_STATE, ...JSON.parse(stored) };
  } catch (e) {
    console.error('[Initiative] Failed to load:', e);
  }
  return DEFAULT_STATE;
}

function saveState(state: InitiativeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[Initiative] Failed to save:', e);
  }
}

function dispatchSync(isSelfUpdate: React.MutableRefObject<boolean>) {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  setTimeout(() => { isSelfUpdate.current = false; }, 50);
}

export interface UseInitiativeOptions {
  onPlayerTurnStart?: () => void;
  onRoundAdvance?: (newRound: number) => void;
}

export interface UseInitiativeReturn {
  playerInitiative: number | null;
  currentTurnId: string | null;
  roundNumber: number;
  combatStarted: boolean;
  initiativeOrder: InitiativeCombatant[];
  currentCombatant: InitiativeCombatant | null;
  currentTurnIndex: number;
  isPlayerTurn: boolean;
  setPlayerInitiative: (value: number | null) => void;
  setRoundNumber: (round: number) => void;
  rollPlayerInitiative: (modifier?: number) => number;
  nextTurn: () => void;
  prevTurn: () => void;
  goToTurn: (combatantId: string) => void;
  startCombat: () => void;
  endCombat: () => void;
  resetRound: () => void;
}

export function useInitiative(
  enemies: Enemy[],
  options: UseInitiativeOptions = {}
): UseInitiativeReturn {
  const { onPlayerTurnStart, onRoundAdvance } = options;
  const [state, setState] = useState<InitiativeState>(loadState);
  const isSelfUpdate = useRef(false);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Listen for sync events from other instances
  useEffect(() => {
    const handler = () => {
      if (isSelfUpdate.current) return;
      setState(loadState());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  // Build initiative order from player + enemies
  const initiativeOrder = useMemo(() => {
    const combatants: InitiativeCombatant[] = [];
    if (state.playerInitiative !== null) {
      combatants.push({ id: 'player', name: 'You', initiative: state.playerInitiative, isPlayer: true, isActive: true });
    }
    enemies.forEach(enemy => {
      if (enemy.initiative !== undefined) {
        combatants.push({ id: enemy.id, name: enemy.name, initiative: enemy.initiative, isPlayer: false, isActive: enemy.currentHP > 0 });
      }
    });
    return combatants.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      return a.isPlayer ? -1 : b.isPlayer ? 1 : 0;
    });
  }, [state.playerInitiative, enemies]);

  const currentTurnIndex = useMemo(() => {
    if (!state.currentTurnId) return 0;
    const idx = initiativeOrder.findIndex(c => c.id === state.currentTurnId);
    return idx >= 0 ? idx : 0;
  }, [state.currentTurnId, initiativeOrder]);

  const currentCombatant = initiativeOrder[currentTurnIndex] ?? null;
  const isPlayerTurn = currentCombatant?.isPlayer ?? false;

  const setPlayerInitiative = useCallback((value: number | null) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, playerInitiative: value }));
    dispatchSync(isSelfUpdate);
  }, []);

  const setRoundNumber = useCallback((round: number) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, roundNumber: Math.max(1, round) }));
    dispatchSync(isSelfUpdate);
  }, []);

  const rollPlayerInitiative = useCallback((modifier: number = 0): number => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, playerInitiative: total }));
    dispatchSync(isSelfUpdate);
    return total;
  }, []);

  const nextTurn = useCallback(() => {
    const activeCombatants = initiativeOrder.filter(c => c.isActive);
    if (activeCombatants.length === 0) return;

    isSelfUpdate.current = true;
    setState(prev => {
      const currentIdx = activeCombatants.findIndex(c => c.id === prev.currentTurnId);
      const nextIdx = (currentIdx + 1) % activeCombatants.length;
      const isNewRound = nextIdx === 0 && currentIdx >= 0;
      const newRoundNumber = isNewRound ? prev.roundNumber + 1 : prev.roundNumber;
      const nextCombatant = activeCombatants[nextIdx];

      if (isNewRound) setTimeout(() => onRoundAdvance?.(newRoundNumber), 0);
      if (nextCombatant?.isPlayer) setTimeout(() => onPlayerTurnStart?.(), 0);

      return { ...prev, currentTurnId: nextCombatant?.id ?? null, roundNumber: newRoundNumber };
    });
    dispatchSync(isSelfUpdate);
  }, [initiativeOrder, onRoundAdvance, onPlayerTurnStart]);

  const prevTurn = useCallback(() => {
    isSelfUpdate.current = true;
    setState(prev => {
      const activeCombatants = initiativeOrder.filter(c => c.isActive);
      if (activeCombatants.length === 0) return prev;
      const currentIdx = activeCombatants.findIndex(c => c.id === prev.currentTurnId);
      const prevIdx = currentIdx <= 0 ? activeCombatants.length - 1 : currentIdx - 1;
      const prevRound = currentIdx === 0 && prev.roundNumber > 1;
      return { ...prev, currentTurnId: activeCombatants[prevIdx]?.id ?? null, roundNumber: prevRound ? prev.roundNumber - 1 : prev.roundNumber };
    });
    dispatchSync(isSelfUpdate);
  }, [initiativeOrder]);

  const goToTurn = useCallback((combatantId: string) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, currentTurnId: combatantId }));
    dispatchSync(isSelfUpdate);
  }, []);

  const startCombat = useCallback(() => {
    const firstActive = initiativeOrder.find(c => c.isActive);
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, combatStarted: true, currentTurnId: firstActive?.id ?? null, roundNumber: 1 }));
    dispatchSync(isSelfUpdate);
  }, [initiativeOrder]);

  const endCombat = useCallback(() => {
    isSelfUpdate.current = true;
    setState({ playerInitiative: null, currentTurnId: null, roundNumber: 1, combatStarted: false });
    dispatchSync(isSelfUpdate);
  }, []);

  const resetRound = useCallback(() => {
    const firstActive = initiativeOrder.find(c => c.isActive);
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, roundNumber: 1, currentTurnId: firstActive?.id ?? null }));
    dispatchSync(isSelfUpdate);
  }, [initiativeOrder]);

  return {
    playerInitiative: state.playerInitiative, currentTurnId: state.currentTurnId,
    roundNumber: state.roundNumber, combatStarted: state.combatStarted,
    initiativeOrder, currentCombatant, currentTurnIndex, isPlayerTurn,
    setPlayerInitiative, setRoundNumber, rollPlayerInitiative,
    nextTurn, prevTurn, goToTurn, startCombat, endCombat, resetRound,
  };
}
