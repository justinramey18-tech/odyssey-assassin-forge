import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useGameMode } from './use-game-mode';
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { Achievement, itemPrerequisites, achievementCategories } from '@/lib/achievements';
import { toast } from 'sonner';

/**
 * Hook to manage gear locking based on game mode settings.
 * When "Gear Unlock Requirements" is active, items with unlock requirements
 * are inaccessible until feat requirements are met.
 */
export function useGearLock(achievements: Achievement[] = achievementCategories) {
  const { requiresGearUnlocks } = useGameMode();
  const previousUnlockState = useRef<Record<string, boolean>>({});

  // Build current unlock state for all items with prerequisites
  const currentUnlockState = useMemo(() => {
    const state: Record<string, boolean> = {};
    
    Object.entries(itemPrerequisites).forEach(([itemId, prerequisite]) => {
      const achievement = achievements.find(a => a.id === prerequisite.achievementId);
      const isUnlocked = achievement ? achievement.currentValue >= prerequisite.requiredValue : false;
      state[itemId] = isUnlocked;
    });
    
    return state;
  }, [achievements]);

  // Check for newly unlocked items and show notifications
  useEffect(() => {
    if (!requiresGearUnlocks) return;

    const prev = previousUnlockState.current;
    const newlyUnlocked: string[] = [];

    Object.entries(currentUnlockState).forEach(([itemId, isUnlocked]) => {
      // If was locked before and is now unlocked
      if (prev[itemId] === false && isUnlocked === true) {
        newlyUnlocked.push(itemId);
      }
    });

    // Show toast notifications for newly unlocked gear
    newlyUnlocked.forEach(itemId => {
      const prerequisite = itemPrerequisites[itemId];
      if (prerequisite) {
        const achievement = achievements.find(a => a.id === prerequisite.achievementId);
        const itemName = formatItemName(itemId);
        const achievementName = achievement?.name || '';
        
        toast.success(`🔓 New Gear Unlocked: ${itemName}`, {
          description: achievementName ? `via "${achievementName}"` : undefined,
          duration: 5000,
        });
      }
    });

    // Update the previous state
    previousUnlockState.current = { ...currentUnlockState };
  }, [currentUnlockState, requiresGearUnlocks, achievements]);

  // Initialize previous state on mount
  useEffect(() => {
    previousUnlockState.current = { ...currentUnlockState };
  }, []);

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
    progressPercent?: number;
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
    const progressPercent = Math.min(100, (achievement.currentValue / prerequisite.requiredValue) * 100);
    
    return {
      isLocked,
      achievement,
      requiredValue: prerequisite.requiredValue,
      currentValue: achievement.currentValue,
      progressPercent,
    };
  }, [requiresGearUnlocks, achievements]);

  // Check if an item is unlocked (opposite of locked) - useful for showing unlock state
  const isItemUnlocked = useCallback((item: EquipmentItem): boolean => {
    return !isItemLocked(item);
  }, [isItemLocked]);

  // Get unlock info by item ID (without requiring the full item object)
  const getItemLockInfoById = useCallback((itemId: string): {
    isLocked: boolean;
    hasRequirement: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
    progressPercent?: number;
  } => {
    if (!requiresGearUnlocks) {
      return { isLocked: false, hasRequirement: false };
    }

    const prerequisite = itemPrerequisites[itemId];
    if (!prerequisite) {
      return { isLocked: false, hasRequirement: false };
    }

    const achievement = achievements.find(a => a.id === prerequisite.achievementId);
    if (!achievement) {
      return { isLocked: true, hasRequirement: true };
    }

    const isLocked = achievement.currentValue < prerequisite.requiredValue;
    const progressPercent = Math.min(100, (achievement.currentValue / prerequisite.requiredValue) * 100);
    
    return {
      isLocked,
      hasRequirement: true,
      achievement,
      requiredValue: prerequisite.requiredValue,
      currentValue: achievement.currentValue,
      progressPercent,
    };
  }, [requiresGearUnlocks, achievements]);

  // Check if any item in a set is locked
  const isSetLocked = useCallback((setId: string, allItems: EquipmentItem[]): boolean => {
    if (!requiresGearUnlocks) return false;
    
    const setItems = allItems.filter(item => item.setId === setId);
    return setItems.some(item => isItemLocked(item));
  }, [requiresGearUnlocks, isItemLocked]);

  // Get set unlock status
  const getSetUnlockStatus = useCallback((setId: string, allItems: EquipmentItem[]): {
    unlockedCount: number;
    lockedCount: number;
    totalWithRequirements: number;
    allUnlocked: boolean;
  } => {
    if (!requiresGearUnlocks) {
      return { unlockedCount: 0, lockedCount: 0, totalWithRequirements: 0, allUnlocked: true };
    }

    const setItems = allItems.filter(item => item.setId === setId);
    const itemsWithRequirements = setItems.filter(item => itemPrerequisites[item.id]);
    
    let unlockedCount = 0;
    let lockedCount = 0;

    itemsWithRequirements.forEach(item => {
      if (isItemLocked(item)) {
        lockedCount++;
      } else {
        unlockedCount++;
      }
    });

    return {
      unlockedCount,
      lockedCount,
      totalWithRequirements: itemsWithRequirements.length,
      allUnlocked: lockedCount === 0,
    };
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
    isItemUnlocked,
    getItemLockInfo,
    getItemLockInfoById,
    isSetLocked,
    getSetUnlockStatus,
    getLockedEquippedItems,
    filterAccessibleItems,
  };
}

// Helper function to format item ID into readable name
function formatItemName(itemId: string): string {
  return itemId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
