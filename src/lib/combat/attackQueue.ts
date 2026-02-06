// Attack Queue Types and Utilities
// Manages queueing of multiple attacks with target assignment

import { WeaponAttack } from './combatTypes';
import { DiceRoll } from '@/lib/diceRoller';
import { TargetPromptInfo } from './targetTypes';

export interface QueuedAttack {
  id: string;
  weapon: WeaponAttack;
  rollType: 'normal' | 'sneak' | 'assassinate';
  targetId: string | null;
  targetName: string | null;
  order: number;
  isOffhand?: boolean;
  addedAt: number;
}

export interface ExecutedAttack extends QueuedAttack {
  roll: DiceRoll;
  damageBreakdown: string;
  attackBonus: number;
  targetInfo?: TargetPromptInfo | null;
}

export interface AttackQueueState {
  attacks: QueuedAttack[];
  defaultTargetId: string | null;
}

export const ATTACK_QUEUE_STORAGE_KEY = 'odyssey-attack-queue';
export const MAX_QUEUE_SIZE = 10;

/**
 * Generate a unique ID for queued attacks
 */
export function generateQueueId(): string {
  return `atk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Load attack queue from localStorage
 */
export function loadAttackQueue(): AttackQueueState {
  try {
    const stored = localStorage.getItem(ATTACK_QUEUE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        attacks: Array.isArray(parsed.attacks) ? parsed.attacks : [],
        defaultTargetId: parsed.defaultTargetId ?? null,
      };
    }
  } catch (error) {
    console.warn('Failed to load attack queue from localStorage:', error);
  }
  return { attacks: [], defaultTargetId: null };
}

/**
 * Save attack queue to localStorage
 */
export function saveAttackQueue(state: AttackQueueState): void {
  try {
    localStorage.setItem(ATTACK_QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save attack queue to localStorage:', error);
  }
}

/**
 * Get action economy breakdown for queue
 */
export function getQueueActionEconomy(attacks: QueuedAttack[]): {
  actionCount: number;
  bonusActionCount: number;
  warnings: string[];
} {
  let actionCount = 0;
  let bonusActionCount = 0;
  const warnings: string[] = [];
  
  for (const attack of attacks) {
    if (attack.isOffhand) {
      bonusActionCount++;
    } else {
      actionCount++;
    }
  }
  
  // D&D 5e warnings
  if (actionCount > 2) {
    warnings.push('More than 2 action attacks - requires Extra Attack (2) or Action Surge');
  } else if (actionCount > 1) {
    warnings.push('2 action attacks - requires Extra Attack feature');
  }
  
  if (bonusActionCount > 1) {
    warnings.push('Only 1 bonus action per turn');
  }
  
  return { actionCount, bonusActionCount, warnings };
}

/**
 * Reorder attacks by moving one up or down
 */
export function reorderAttacks(
  attacks: QueuedAttack[],
  attackId: string,
  direction: 'up' | 'down'
): QueuedAttack[] {
  const sorted = [...attacks].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex(a => a.id === attackId);
  
  if (index === -1) return attacks;
  if (direction === 'up' && index === 0) return attacks;
  if (direction === 'down' && index === sorted.length - 1) return attacks;
  
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  
  // Swap orders
  const tempOrder = sorted[index].order;
  sorted[index] = { ...sorted[index], order: sorted[swapIndex].order };
  sorted[swapIndex] = { ...sorted[swapIndex], order: tempOrder };
  
  return sorted;
}
