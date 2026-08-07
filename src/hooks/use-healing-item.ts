import { useCallback } from 'react';
import { toast } from 'sonner';
import type { HealRollResult } from '@/lib/promptAutoRoll';
import { buildHealingPrompt } from '@/lib/consumables/healing';

interface HealingItemDeps {
  characterName: string;
  maxHP: number;
  getCurrentHP: () => number;
  onHPChange?: (change: number, type: 'damage' | 'healing') => void;
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
}

/**
 * Resolves a healing item entirely on the client: consume one, apply the HP,
 * and hand back a short prompt telling the DM it is already done.
 * Returns null when the item could not be consumed (nothing is applied).
 */
export function useHealingItemAction({
  characterName,
  maxHP,
  getCurrentHP,
  onHPChange,
  onUseConsumableByName,
}: HealingItemDeps) {
  return useCallback((itemName: string, roll: HealRollResult): string | null => {
    if (!onUseConsumableByName) {
      toast.error('Items cannot be used from here right now.');
      return null;
    }

    const consumed = onUseConsumableByName(itemName, 1);
    if (!consumed) {
      toast.warning(`${itemName} is not in your inventory.`);
      return null;
    }

    const current = Number(getCurrentHP());
    const max = Number(maxHP);
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeMax = Number.isFinite(max) && max > 0 ? max : safeCurrent;
    const total = Number.isFinite(roll.total) ? Math.max(0, Math.floor(roll.total)) : 0;

    const wasFullHealth = safeCurrent >= safeMax;
    const healed = wasFullHealth ? 0 : Math.min(total, safeMax - safeCurrent);

    if (healed > 0) onHPChange?.(healed, 'healing');

    toast.success(
      wasFullHealth ? `${itemName} used — already at full health.` : `${itemName} restored ${healed} HP.`
    );

    return buildHealingPrompt({
      characterName,
      itemName,
      rolls: roll.rolls,
      bonus: roll.bonus,
      healed,
      newHP: safeCurrent + healed,
      maxHP: safeMax,
      wasFullHealth,
    });
  }, [characterName, maxHP, getCurrentHP, onHPChange, onUseConsumableByName]);
}
