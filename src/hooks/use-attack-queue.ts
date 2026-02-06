import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  QueuedAttack,
  AttackQueueState,
  loadAttackQueue,
  saveAttackQueue,
  generateQueueId,
  getQueueActionEconomy,
  reorderAttacks,
  MAX_QUEUE_SIZE,
} from '@/lib/combat/attackQueue';
import { WeaponAttack } from '@/lib/combat/combatTypes';
import { Enemy } from '@/lib/combat/targetTypes';

export interface UseAttackQueueReturn {
  // State
  queue: QueuedAttack[];
  defaultTargetId: string | null;
  
  // Queue size
  queueSize: number;
  isQueueFull: boolean;
  isEmpty: boolean;
  
  // Actions
  addToQueue: (
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null,
    isOffhand?: boolean
  ) => boolean;
  removeFromQueue: (id: string) => void;
  reorderAttack: (id: string, direction: 'up' | 'down') => void;
  setDefaultTarget: (targetId: string | null) => void;
  clearQueue: () => void;
  updateAttackTarget: (id: string, targetId: string | null, targetName: string | null) => void;
  
  // Action economy
  actionEconomy: {
    actionCount: number;
    bonusActionCount: number;
    warnings: string[];
  };
  
  // Get attacks sorted by order
  sortedQueue: QueuedAttack[];
}

export function useAttackQueue(enemies: Enemy[] = []): UseAttackQueueReturn {
  const [state, setState] = useState<AttackQueueState>(loadAttackQueue);

  // Persist to localStorage on state change
  useEffect(() => {
    saveAttackQueue(state);
  }, [state]);

  // Add attack to queue
  const addToQueue = useCallback((
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null,
    isOffhand = false
  ): boolean => {
    if (state.attacks.length >= MAX_QUEUE_SIZE) {
      return false;
    }

    const newOrder = state.attacks.length > 0
      ? Math.max(...state.attacks.map(a => a.order)) + 1
      : 0;

    const newAttack: QueuedAttack = {
      id: generateQueueId(),
      weapon,
      rollType,
      targetId,
      targetName,
      order: newOrder,
      isOffhand,
      addedAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      attacks: [...prev.attacks, newAttack],
    }));

    return true;
  }, [state.attacks.length]);

  // Remove attack from queue
  const removeFromQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      attacks: prev.attacks.filter(a => a.id !== id),
    }));
  }, []);

  // Reorder attack
  const reorderAttack = useCallback((id: string, direction: 'up' | 'down') => {
    setState(prev => ({
      ...prev,
      attacks: reorderAttacks(prev.attacks, id, direction),
    }));
  }, []);

  // Set default target for new attacks
  const setDefaultTarget = useCallback((targetId: string | null) => {
    setState(prev => ({
      ...prev,
      defaultTargetId: targetId,
    }));
  }, []);

  // Clear all queued attacks
  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      attacks: [],
    }));
  }, []);

  // Update target for a specific attack
  const updateAttackTarget = useCallback((
    id: string,
    targetId: string | null,
    targetName: string | null
  ) => {
    setState(prev => ({
      ...prev,
      attacks: prev.attacks.map(a =>
        a.id === id ? { ...a, targetId, targetName } : a
      ),
    }));
  }, []);

  // Compute sorted queue
  const sortedQueue = useMemo(() =>
    [...state.attacks].sort((a, b) => a.order - b.order),
    [state.attacks]
  );

  // Compute action economy
  const actionEconomy = useMemo(() =>
    getQueueActionEconomy(state.attacks),
    [state.attacks]
  );

  return {
    // State
    queue: state.attacks,
    defaultTargetId: state.defaultTargetId,
    
    // Queue size
    queueSize: state.attacks.length,
    isQueueFull: state.attacks.length >= MAX_QUEUE_SIZE,
    isEmpty: state.attacks.length === 0,
    
    // Actions
    addToQueue,
    removeFromQueue,
    reorderAttack,
    setDefaultTarget,
    clearQueue,
    updateAttackTarget,
    
    // Action economy
    actionEconomy,
    
    // Sorted queue
    sortedQueue,
  };
}
