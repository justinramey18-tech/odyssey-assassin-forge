import { useState, useCallback, useEffect } from 'react';
import { ActionEconomy, TurnAction } from '@/lib/combat/combatTypes';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-action-economy';
const TURN_ACTIONS_KEY = 'odyssey-turn-actions';

// Default action economy state
const DEFAULT_ECONOMY: ActionEconomy = {
  actionUsed: false,
  bonusActionUsed: false,
  reactionUsed: false,
  movementUsed: 0,
  maxMovement: 30,
};

// Load from localStorage (character-scoped)
function loadEconomy(): ActionEconomy {
  try {
    const stored = getScopedItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_ECONOMY, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[ActionEconomy] Failed to load:', e);
  }
  return DEFAULT_ECONOMY;
}

function loadTurnActions(): TurnAction[] {
  try {
    const stored = getScopedItem(TURN_ACTIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[ActionEconomy] Failed to load turn actions:', e);
  }
  return [];
}

// Save to localStorage (character-scoped)
function saveEconomy(economy: ActionEconomy): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(economy));
  } catch (e) {
    console.error('[ActionEconomy] Failed to save:', e);
  }
}

function saveTurnActions(actions: TurnAction[]): void {
  try {
    setScopedItem(TURN_ACTIONS_KEY, JSON.stringify(actions));
  } catch (e) {
    console.error('[ActionEconomy] Failed to save turn actions:', e);
  }
}

export interface UseActionEconomyReturn {
  // State
  economy: ActionEconomy;
  turnActions: TurnAction[];
  
  // Setters
  setEconomy: (economy: ActionEconomy) => void;
  
  // Convenience toggles
  useAction: () => void;
  useBonus: () => void;
  useReaction: () => void;
  restoreAction: () => void;
  restoreBonus: () => void;
  restoreReaction: () => void;
  
  // Movement
  updateMovement: (used: number) => void;
  setMaxMovement: (max: number) => void;
  
  // Turn actions
  addTurnAction: (action: TurnAction) => void;
  removeTurnAction: (index: number) => void;
  
  // Reset (for new turn or rest)
  resetTurn: () => void;
  
  // Rest handlers (to be called from Index.tsx)
  onShortRest: () => void;
  onLongRest: () => void;
}

export function useActionEconomy(): UseActionEconomyReturn {
  const [economy, setEconomyState] = useState<ActionEconomy>(loadEconomy);
  const [turnActions, setTurnActionsState] = useState<TurnAction[]>(loadTurnActions);

  // Re-init when character is switched
  useEffect(() => {
    const handleCharacterLoaded = () => {
      setEconomyState(loadEconomy());
      setTurnActionsState(loadTurnActions());
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  // Persist economy changes
  useEffect(() => {
    saveEconomy(economy);
  }, [economy]);

  // Persist turn actions changes
  useEffect(() => {
    saveTurnActions(turnActions);
  }, [turnActions]);

  // Wrapper to update and persist
  const setEconomy = useCallback((newEconomy: ActionEconomy) => {
    setEconomyState(newEconomy);
  }, []);

  // Convenience toggles
  const useAction = useCallback(() => {
    setEconomyState(prev => ({ ...prev, actionUsed: true }));
  }, []);

  const useBonus = useCallback(() => {
    setEconomyState(prev => ({ ...prev, bonusActionUsed: true }));
  }, []);

  const useReaction = useCallback(() => {
    setEconomyState(prev => ({ ...prev, reactionUsed: true }));
  }, []);

  const restoreAction = useCallback(() => {
    setEconomyState(prev => ({ ...prev, actionUsed: false }));
  }, []);

  const restoreBonus = useCallback(() => {
    setEconomyState(prev => ({ ...prev, bonusActionUsed: false }));
  }, []);

  const restoreReaction = useCallback(() => {
    setEconomyState(prev => ({ ...prev, reactionUsed: false }));
  }, []);

  // Movement
  const updateMovement = useCallback((used: number) => {
    setEconomyState(prev => ({ 
      ...prev, 
      movementUsed: Math.max(0, Math.min(used, prev.maxMovement)) 
    }));
  }, []);

  const setMaxMovement = useCallback((max: number) => {
    setEconomyState(prev => ({ ...prev, maxMovement: max }));
  }, []);

  // Turn actions
  const addTurnAction = useCallback((action: TurnAction) => {
    setTurnActionsState(prev => {
      // Replace same type action
      const filtered = prev.filter(a => a.type !== action.type);
      return [...filtered, action];
    });
    
    // Also update economy based on action type
    if (action.type === 'action') {
      setEconomyState(prev => ({ ...prev, actionUsed: true }));
    } else if (action.type === 'bonus') {
      setEconomyState(prev => ({ ...prev, bonusActionUsed: true }));
    } else if (action.type === 'reaction') {
      setEconomyState(prev => ({ ...prev, reactionUsed: true }));
    }
  }, []);

  const removeTurnAction = useCallback((index: number) => {
    setTurnActionsState(prev => {
      const action = prev[index];
      const newActions = prev.filter((_, i) => i !== index);
      
      // Restore economy for removed action
      if (action) {
        if (action.type === 'action') {
          setEconomyState(p => ({ ...p, actionUsed: false }));
        } else if (action.type === 'bonus') {
          setEconomyState(p => ({ ...p, bonusActionUsed: false }));
        } else if (action.type === 'reaction') {
          setEconomyState(p => ({ ...p, reactionUsed: false }));
        }
      }
      
      return newActions;
    });
  }, []);

  // Reset turn (new round)
  const resetTurn = useCallback(() => {
    setEconomyState({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      maxMovement: economy.maxMovement,
    });
    setTurnActionsState([]);
  }, [economy.maxMovement]);

  // Rest handlers - fully reset action economy
  const onShortRest = useCallback(() => {
    // Short rest resets action economy (combat would have ended)
    resetTurn();
  }, [resetTurn]);

  const onLongRest = useCallback(() => {
    // Long rest resets action economy
    resetTurn();
  }, [resetTurn]);

  return {
    economy,
    turnActions,
    setEconomy,
    useAction,
    useBonus,
    useReaction,
    restoreAction,
    restoreBonus,
    restoreReaction,
    updateMovement,
    setMaxMovement,
    addTurnAction,
    removeTurnAction,
    resetTurn,
    onShortRest,
    onLongRest,
  };
}
