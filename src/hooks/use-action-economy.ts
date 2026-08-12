// Thin React binding over the singleton in lib/combat/economyStore.
//
// COMPATIBILITY CONTRACT: every member of UseActionEconomyReturn that existed
// before this rewrite still exists, with the same name, signature and meaning.
// Index.tsx and PromptDrawerProvider need no changes. New members are additive.
//
// The behavioural change is that two components calling this hook now share one
// state instead of two independent copies of it.

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ActionEconomy, TurnAction } from '@/lib/combat/combatTypes';
import * as store from '@/lib/combat/economyStore';
import type { ActionCost } from '@/lib/combat/economyStore';

export type { ActionCost };

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

  // Rest handlers (called from Index.tsx)
  onShortRest: () => void;
  onLongRest: () => void;

  // --- Added in Volume 3 ---
  /** Start of turn: restores action, bonus action, movement AND reaction. */
  beginTurn: () => void;
  /** End of turn: restores action, bonus action and movement. Keeps the reaction spent. */
  endTurn: () => void;
  /** Spend one slot. Returns false when it was already spent - warn, do not block. */
  spend: (cost: ActionCost, description?: string) => boolean;
  /** Whether a given slot is currently spent. 'free' is always false. */
  isUsed: (cost: ActionCost) => boolean;
  /** True when nothing has been spent yet this turn. */
  isTurnUntouched: boolean;
}

export function useActionEconomy(): UseActionEconomyReturn {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const economy = snapshot.economy;
  // The store holds this readonly; the public type is mutable, so hand out a copy.
  const turnActions = useMemo(() => [...snapshot.turnActions], [snapshot.turnActions]);

  const setEconomy = useCallback((next: ActionEconomy) => store.setEconomy(next), []);

  const useAction = useCallback(() => store.setUsed('action', true), []);
  const useBonus = useCallback(() => store.setUsed('bonus', true), []);
  const useReaction = useCallback(() => store.setUsed('reaction', true), []);
  const restoreAction = useCallback(() => store.setUsed('action', false), []);
  const restoreBonus = useCallback(() => store.setUsed('bonus', false), []);
  const restoreReaction = useCallback(() => store.setUsed('reaction', false), []);

  const updateMovement = useCallback((used: number) => store.updateMovement(used), []);
  const setMaxMovement = useCallback((max: number) => store.setMaxMovement(max), []);

  const addTurnAction = useCallback((action: TurnAction) => store.addTurnAction(action), []);
  const removeTurnAction = useCallback((index: number) => store.removeTurnAction(index), []);

  const resetTurn = useCallback(() => store.resetTurn(), []);
  const beginTurn = useCallback(() => store.beginTurn(), []);
  const endTurn = useCallback(() => store.endTurn(), []);

  const spend = useCallback((cost: ActionCost, description?: string) => store.spend(cost, description), []);
  const isUsed = useCallback((cost: ActionCost) => store.isUsed(cost), []);

  // A rest ends combat, so the whole turn resets including the reaction.
  const onShortRest = useCallback(() => store.beginTurn(), []);
  const onLongRest = useCallback(() => store.beginTurn(), []);

  const isTurnUntouched =
    !economy.actionUsed && !economy.bonusActionUsed && !economy.reactionUsed && economy.movementUsed === 0;

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
    beginTurn,
    endTurn,
    spend,
    isUsed,
    isTurnUntouched,
  };
}
