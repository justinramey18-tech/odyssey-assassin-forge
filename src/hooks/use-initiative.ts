import { useState, useCallback, useEffect, useMemo } from 'react';
import { Enemy } from '@/lib/combat/targetTypes';

const STORAGE_KEY = 'odyssey-initiative';

/**
 * A combatant in the initiative order
 */
export interface InitiativeCombatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
  isActive: boolean; // For enemies that can be defeated
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

// Load from localStorage
function loadState(): InitiativeState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[Initiative] Failed to load:', e);
  }
  return DEFAULT_STATE;
}

// Save to localStorage
function saveState(state: InitiativeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[Initiative] Failed to save:', e);
  }
}

export interface UseInitiativeOptions {
  /** Called when advancing to the player's turn (for resetting action economy) */
  onPlayerTurnStart?: () => void;
  /** Called when a round ends and a new round begins (for ticking down conditions) */
  onRoundAdvance?: (newRound: number) => void;
}

export interface UseInitiativeReturn {
  // State
  playerInitiative: number | null;
  currentTurnId: string | null;
  roundNumber: number;
  combatStarted: boolean;
  
  // Computed - sorted initiative order
  initiativeOrder: InitiativeCombatant[];
  currentCombatant: InitiativeCombatant | null;
  currentTurnIndex: number;
  isPlayerTurn: boolean;
  
  // Actions
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

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Build initiative order from player + enemies
  const initiativeOrder = useMemo(() => {
    const combatants: InitiativeCombatant[] = [];

    // Add player if initiative is set
    if (state.playerInitiative !== null) {
      combatants.push({
        id: 'player',
        name: 'You',
        initiative: state.playerInitiative,
        isPlayer: true,
        isActive: true,
      });
    }

    // Add enemies with initiative set
    enemies.forEach(enemy => {
      if (enemy.initiative !== undefined) {
        combatants.push({
          id: enemy.id,
          name: enemy.name,
          initiative: enemy.initiative,
          isPlayer: false,
          isActive: enemy.currentHP > 0,
        });
      }
    });

    // Sort by initiative (highest first), with player winning ties
    return combatants.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      // Player wins ties
      return a.isPlayer ? -1 : b.isPlayer ? 1 : 0;
    });
  }, [state.playerInitiative, enemies]);

  // Current combatant
  const currentTurnIndex = useMemo(() => {
    if (!state.currentTurnId) return 0;
    const idx = initiativeOrder.findIndex(c => c.id === state.currentTurnId);
    return idx >= 0 ? idx : 0;
  }, [state.currentTurnId, initiativeOrder]);

  const currentCombatant = initiativeOrder[currentTurnIndex] ?? null;
  const isPlayerTurn = currentCombatant?.isPlayer ?? false;

  // Set player initiative
  const setPlayerInitiative = useCallback((value: number | null) => {
    setState(prev => ({ ...prev, playerInitiative: value }));
  }, []);

  // Set round number directly (for Chronicle Sync)
  const setRoundNumber = useCallback((round: number) => {
    setState(prev => ({ ...prev, roundNumber: Math.max(1, round) }));
  }, []);

  // Roll player initiative (d20 + modifier)
  const rollPlayerInitiative = useCallback((modifier: number = 0): number => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    setState(prev => ({ ...prev, playerInitiative: total }));
    return total;
  }, []);

  // Next turn
  const nextTurn = useCallback(() => {
    const activeCombatants = initiativeOrder.filter(c => c.isActive);
    if (activeCombatants.length === 0) return;

    setState(prev => {
      const currentIdx = activeCombatants.findIndex(c => c.id === prev.currentTurnId);
      const nextIdx = (currentIdx + 1) % activeCombatants.length;
      
      // Check if we wrapped around (new round)
      const isNewRound = nextIdx === 0 && currentIdx >= 0;
      const newRoundNumber = isNewRound ? prev.roundNumber + 1 : prev.roundNumber;
      const nextCombatant = activeCombatants[nextIdx];

      // Trigger callbacks after state update
      if (isNewRound) {
        // Use setTimeout to ensure state is updated first
        setTimeout(() => onRoundAdvance?.(newRoundNumber), 0);
      }
      
      // Check if next turn is player's turn
      if (nextCombatant?.isPlayer) {
        setTimeout(() => onPlayerTurnStart?.(), 0);
      }

      return {
        ...prev,
        currentTurnId: nextCombatant?.id ?? null,
        roundNumber: newRoundNumber,
      };
    });
  }, [initiativeOrder, onRoundAdvance, onPlayerTurnStart]);

  // Previous turn
  const prevTurn = useCallback(() => {
    setState(prev => {
      const activeCombatants = initiativeOrder.filter(c => c.isActive);
      if (activeCombatants.length === 0) return prev;

      const currentIdx = activeCombatants.findIndex(c => c.id === prev.currentTurnId);
      const prevIdx = currentIdx <= 0 ? activeCombatants.length - 1 : currentIdx - 1;
      
      // Check if we went back a round
      const prevRound = currentIdx === 0 && prev.roundNumber > 1;

      return {
        ...prev,
        currentTurnId: activeCombatants[prevIdx]?.id ?? null,
        roundNumber: prevRound ? prev.roundNumber - 1 : prev.roundNumber,
      };
    });
  }, [initiativeOrder]);

  // Go to specific turn
  const goToTurn = useCallback((combatantId: string) => {
    setState(prev => ({ ...prev, currentTurnId: combatantId }));
  }, []);

  // Start combat - set to first in order
  const startCombat = useCallback(() => {
    const firstActive = initiativeOrder.find(c => c.isActive);
    setState(prev => ({
      ...prev,
      combatStarted: true,
      currentTurnId: firstActive?.id ?? null,
      roundNumber: 1,
    }));
  }, [initiativeOrder]);

  // End combat - reset everything
  const endCombat = useCallback(() => {
    setState({
      playerInitiative: null,
      currentTurnId: null,
      roundNumber: 1,
      combatStarted: false,
    });
  }, []);

  // Reset to round 1, keep initiative values
  const resetRound = useCallback(() => {
    const firstActive = initiativeOrder.find(c => c.isActive);
    setState(prev => ({
      ...prev,
      roundNumber: 1,
      currentTurnId: firstActive?.id ?? null,
    }));
  }, [initiativeOrder]);

  return {
    // State
    playerInitiative: state.playerInitiative,
    currentTurnId: state.currentTurnId,
    roundNumber: state.roundNumber,
    combatStarted: state.combatStarted,
    
    // Computed
    initiativeOrder,
    currentCombatant,
    currentTurnIndex,
    isPlayerTurn,
    
    // Actions
    setPlayerInitiative,
    setRoundNumber,
    rollPlayerInitiative,
    nextTurn,
    prevTurn,
    goToTurn,
    startCombat,
    endCombat,
    resetRound,
  };
}
