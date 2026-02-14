import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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

const SYNC_EVENT = 'odyssey-attack-queue-sync';

function dispatchSync(isSelfUpdate: React.MutableRefObject<boolean>) {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  setTimeout(() => { isSelfUpdate.current = false; }, 50);
}

export interface UseAttackQueueReturn {
  queue: QueuedAttack[];
  defaultTargetId: string | null;
  queueSize: number;
  isQueueFull: boolean;
  isEmpty: boolean;
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
  actionEconomy: {
    actionCount: number;
    bonusActionCount: number;
    warnings: string[];
  };
  sortedQueue: QueuedAttack[];
}

export function useAttackQueue(enemies: Enemy[] = []): UseAttackQueueReturn {
  const [state, setState] = useState<AttackQueueState>(loadAttackQueue);
  const isSelfUpdate = useRef(false);

  // Persist to localStorage on state change
  useEffect(() => {
    saveAttackQueue(state);
  }, [state]);

  // Listen for sync events from other instances
  useEffect(() => {
    const handler = () => {
      if (isSelfUpdate.current) return;
      setState(loadAttackQueue());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const addToQueue = useCallback((
    weapon: WeaponAttack,
    rollType: 'normal' | 'sneak' | 'assassinate',
    targetId: string | null,
    targetName: string | null,
    isOffhand = false
  ): boolean => {
    if (state.attacks.length >= MAX_QUEUE_SIZE) return false;

    const newOrder = state.attacks.length > 0
      ? Math.max(...state.attacks.map(a => a.order)) + 1 : 0;

    const newAttack: QueuedAttack = {
      id: generateQueueId(), weapon, rollType, targetId, targetName,
      order: newOrder, isOffhand, addedAt: Date.now(),
    };

    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, attacks: [...prev.attacks, newAttack] }));
    dispatchSync(isSelfUpdate);
    return true;
  }, [state.attacks.length]);

  const removeFromQueue = useCallback((id: string) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, attacks: prev.attacks.filter(a => a.id !== id) }));
    dispatchSync(isSelfUpdate);
  }, []);

  const reorderAttack = useCallback((id: string, direction: 'up' | 'down') => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, attacks: reorderAttacks(prev.attacks, id, direction) }));
    dispatchSync(isSelfUpdate);
  }, []);

  const setDefaultTarget = useCallback((targetId: string | null) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, defaultTargetId: targetId }));
    dispatchSync(isSelfUpdate);
  }, []);

  const clearQueue = useCallback(() => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, attacks: [] }));
    dispatchSync(isSelfUpdate);
  }, []);

  const updateAttackTarget = useCallback((id: string, targetId: string | null, targetName: string | null) => {
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      attacks: prev.attacks.map(a => a.id === id ? { ...a, targetId, targetName } : a),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const sortedQueue = useMemo(() => [...state.attacks].sort((a, b) => a.order - b.order), [state.attacks]);
  const actionEconomy = useMemo(() => getQueueActionEconomy(state.attacks), [state.attacks]);

  return {
    queue: state.attacks, defaultTargetId: state.defaultTargetId,
    queueSize: state.attacks.length, isQueueFull: state.attacks.length >= MAX_QUEUE_SIZE,
    isEmpty: state.attacks.length === 0,
    addToQueue, removeFromQueue, reorderAttack, setDefaultTarget, clearQueue, updateAttackTarget,
    actionEconomy, sortedQueue,
  };
}
