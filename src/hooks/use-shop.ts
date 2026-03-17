// Shop State Management Hook

import { useState, useCallback, useEffect } from 'react';
import { ShopItem, ShopState, PurchaseRecord, ParsedShopItem } from '@/lib/shop/types';
import { convertShopItemToConsumable, convertShopItemToEquipment, isWearableEquipment } from '@/lib/shop/converters';
import { Consumable } from '@/lib/consumables/types';
import { EquipmentItem } from '@/lib/inventory/types';
import { getScopedItem, setScopedItem, removeScopedItem, migrateToScoped } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-shop';

export interface PurchaseResult {
  success: boolean;
  remainingGold?: number;
  error?: string;
  convertedItem?: Consumable | EquipmentItem;
  destinationType?: 'consumable' | 'equipment' | 'miscellaneous';
  itemName?: string;
}

export function useShop() {
  const [state, setState] = useState<ShopState>(() => {
    migrateToScoped(STORAGE_KEY);
    const stored = getScopedItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { currentGold: 0, items: [], purchaseHistory: [] };
      }
    }
    return { currentGold: 0, items: [], purchaseHistory: [] };
  });

  // Persist to localStorage
  useEffect(() => {
    setScopedItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Re-init when character is switched in-memory
  useEffect(() => {
    const handleCharacterLoaded = () => {
      const stored = getScopedItem(STORAGE_KEY);
      if (stored) {
        try { setState(JSON.parse(stored)); } catch { setState({ currentGold: 0, items: [], purchaseHistory: [] }); }
      } else {
        setState({ currentGold: 0, items: [], purchaseHistory: [] });
      }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  // Add gold (from Chronicle Sync)
  const addGold = useCallback((amount: number, source?: string) => {
    setState(prev => ({
      ...prev,
      currentGold: Math.max(0, prev.currentGold + amount),
    }));
  }, []);

  // Spend gold (Chronicle Sync expenses or direct purchases)
  const spendGold = useCallback((amount: number): boolean => {
    if (state.currentGold < amount) return false;
    setState(prev => ({
      ...prev,
      currentGold: prev.currentGold - amount,
    }));
    return true;
  }, [state.currentGold]);

  // Set gold directly (for loading saves)
  const setGold = useCallback((amount: number) => {
    setState(prev => ({ ...prev, currentGold: Math.max(0, amount) }));
  }, []);

  // Check affordability
  const canAfford = useCallback((cost: number): boolean => {
    return state.currentGold >= cost;
  }, [state.currentGold]);

  // 10-minute expiration timer for shop items
  const SHOP_ITEM_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

  // Add items to shop (from Chronicle Sync parsing)
  const addShopItems = useCallback((parsedItems: ParsedShopItem[]) => {
    const now = Date.now();
    const expiresAt = new Date(now + SHOP_ITEM_EXPIRATION_MS).toISOString();
    
    const newItems: ShopItem[] = parsedItems.map(item => ({
      id: `shop-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      itemType: item.itemType,
      category: item.category,
      mechanics: item.mechanics || {},
      rarity: (item.rarity as ShopItem['rarity']) || 'common',
      description: item.description || 'A mysterious item.',
      lore: item.lore || '',
      costGold: item.costGold,
      sourceText: item.sourceText,
      detectedAt: new Date().toISOString(),
      expiresAt,
      aiGenerated: {
        mechanics: !item.mechanics,
        description: !item.description,
        lore: !item.lore,
        rarity: !item.rarity,
      },
    }));

    setState(prev => ({
      ...prev,
      items: [...prev.items, ...newItems],
    }));
  }, []);

  // Remove expired items on mount and periodically
  useEffect(() => {
    const cleanupExpired = () => {
      setState(prev => {
        const now = Date.now();
        const validItems = prev.items.filter(item => {
          const expiryTime = new Date(item.expiresAt).getTime();
          return expiryTime > now;
        });
        
        if (validItems.length !== prev.items.length) {
          return { ...prev, items: validItems };
        }
        return prev;
      });
    };

    // Clean up on mount
    cleanupExpired();

    // Check every 30 seconds for expired items
    const interval = setInterval(cleanupExpired, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get item by ID
  const getItemById = useCallback((itemId: string): ShopItem | undefined => {
    return state.items.find(i => i.id === itemId);
  }, [state.items]);

  /**
   * Purchase item - validates gold, removes from shop, returns converted item
   * Caller is responsible for adding the converted item to the appropriate inventory
   */
  const purchaseItem = useCallback((itemId: string): PurchaseResult => {
    const item = state.items.find(i => i.id === itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found in shop' };
    }
    
    if (state.currentGold < item.costGold) {
      const deficit = item.costGold - state.currentGold;
      return { 
        success: false, 
        error: `Need ${deficit} more gold to purchase this item` 
      };
    }

    const remainingGold = state.currentGold - item.costGold;
    
    // Convert item based on type
    let convertedItem: Consumable | EquipmentItem | undefined;
    let destinationType: 'consumable' | 'equipment' | 'miscellaneous' = 'miscellaneous';
    
    if (item.itemType === 'consumable') {
      convertedItem = convertShopItemToConsumable(item);
      destinationType = 'consumable';
    } else if (item.itemType === 'equipment') {
      // Only convert to equipment if it can be assigned a valid slot
      if (isWearableEquipment(item)) {
        convertedItem = convertShopItemToEquipment(item);
        destinationType = 'equipment';
      } else {
        // Non-wearable "equipment" (e.g. Bag of Holding) → miscellaneous
        destinationType = 'miscellaneous';
      }
    }
    
    // Update state: deduct gold, remove item, add to history
    setState(prev => ({
      ...prev,
      currentGold: remainingGold,
      items: prev.items.filter(i => i.id !== itemId),
      purchaseHistory: [...prev.purchaseHistory, {
        itemId: item.id,
        itemName: item.name,
        cost: item.costGold,
        convertedTo: destinationType,
        purchasedAt: new Date().toISOString(),
      }],
    }));

    return { 
      success: true, 
      remainingGold,
      convertedItem,
      destinationType,
      itemName: item.name,
    };
  }, [state]);

  // Remove item from shop (without purchasing)
  const removeShopItem = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
    }));
  }, []);

  // Clear entire shop
  const clearShop = useCallback(() => {
    setState(prev => ({ ...prev, items: [] }));
  }, []);

  // Clear purchase history
  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, purchaseHistory: [] }));
  }, []);

  // Reset shop (for app reset)
  const resetShop = useCallback(() => {
    setState({ currentGold: 0, items: [], purchaseHistory: [] });
    removeScopedItem(STORAGE_KEY);
  }, []);

  return {
    currentGold: state.currentGold,
    shopItems: state.items,
    purchaseHistory: state.purchaseHistory,
    addGold,
    spendGold,
    setGold,
    canAfford,
    addShopItems,
    getItemById,
    purchaseItem,
    removeShopItem,
    clearShop,
    clearHistory,
    resetShop,
  };
}
