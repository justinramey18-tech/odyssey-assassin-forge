import { useMemo, useCallback } from 'react';
import { useGameMode } from './use-game-mode';
import { EquipmentItem, EquipmentSlotType, CharacterEquipment } from '@/lib/inventory/types';
import { Achievement, itemPrerequisites, achievementCategories } from '@/lib/achievements';

/**
 * Hook to manage gear locking based on game mode settings.
 * When "Gear Unlock Requirements" is active, items with unlock requirements
 * are inaccessible until feat requirements are met.
 */
export function useGearLock(achievements: Achievement[] = achievementCategories) {
  const { requiresGearUnlocks } = useGameMode();

  // Check if a specific item is locked
  const isItemLocked = useCallback((item: EquipmentItem): boolean => {
    if (!requiresGearUnlocks) return false; // Infinity Pool mode or rule disabled
    
    const prerequisite = itemPrerequisites[item.id];
    if (!prerequisite) return false; // No prerequisite = always accessible
    
    const achievement = achievements.find(a => a.id === prerequisite.achievementId);
    if (!achievement) return true; // Achievement not found = locked
    
    return achievement.currentValue < prerequisite.requiredValue;
  }, [requiresGearUnlocks, achievements]);

  // Get lock info for an item (for displaying unlock requirements)
  const getItemLockInfo = useCallback((item: EquipmentItem): {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  } => {
    if (!requiresGearUnlocks) {
      return { isLocked: false };
    }

    const prerequisite = itemPrerequisites[item.id];
    if (!prerequisite) {
      return { isLocked: false };
    }

    const achievement = achievements.find(a => a.id === prerequisite.achievementId);
    if (!achievement) {
      return { isLocked: true };
    }

    const isLocked = achievement.currentValue < prerequisite.requiredValue;
    
    return {
      isLocked,
      achievement,
      requiredValue: prerequisite.requiredValue,
      currentValue: achievement.currentValue,
    };
  }, [requiresGearUnlocks, achievements]);

  // Check if any item in a set is locked
  const isSetLocked = useCallback((setId: string, allItems: EquipmentItem[]): boolean => {
    if (!requiresGearUnlocks) return false;
    
    const setItems = allItems.filter(item => item.setId === setId);
    return setItems.some(item => isItemLocked(item));
  }, [requiresGearUnlocks, isItemLocked]);

  // Get all locked items from currently equipped slots
  const getLockedEquippedItems = useCallback((
    slots: Record<EquipmentSlotType, EquipmentItem | null>
  ): { slotType: EquipmentSlotType; item: EquipmentItem }[] => {
    if (!requiresGearUnlocks) return [];

    const lockedItems: { slotType: EquipmentSlotType; item: EquipmentItem }[] = [];
    
    (Object.keys(slots) as EquipmentSlotType[]).forEach(slotType => {
      const item = slots[slotType];
      if (item && isItemLocked(item)) {
        lockedItems.push({ slotType, item });
      }
    });
    
    return lockedItems;
  }, [requiresGearUnlocks, isItemLocked]);

  // Filter inventory to exclude locked items
  const filterAccessibleItems = useCallback((items: EquipmentItem[]): EquipmentItem[] => {
    if (!requiresGearUnlocks) return items;
    return items.filter(item => !isItemLocked(item));
  }, [requiresGearUnlocks, isItemLocked]);

  return {
    requiresGearUnlocks,
    isItemLocked,
    getItemLockInfo,
    isSetLocked,
    getLockedEquippedItems,
    filterAccessibleItems,
  };
}
