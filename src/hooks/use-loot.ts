// Loot State Management Hook
// Manages found loot items with Chronicle sync, selling, and combat integration

import { useState, useCallback, useEffect, useMemo } from 'react';
import { LootItem, LootState, ParsedLootItem, SoldLootRecord, lootRarityConfig, LootRarity, LootCategory } from '@/lib/loot/types';
import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'odyssey-loot';

export interface LootSellResult {
  success: boolean;
  goldReceived: number;
  error?: string;
}

export function useLoot() {
  const [state, setState] = useState<LootState>(() => {
    const stored = getScopedItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { items: [], soldHistory: [] };
      }
    }
    return { items: [], soldHistory: [] };
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
        try { setState(JSON.parse(stored)); } catch { setState({ items: [], soldHistory: [] }); }
      } else {
        setState({ items: [], soldHistory: [] });
      }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  // Add loot items (from Chronicle Sync or Random Generator)
  const addLootItems = useCallback((items: LootItem[]) => {
    setState(prev => ({
      ...prev,
      items: [...prev.items, ...items],
    }));
  }, []);

  // Add a single parsed loot item from Chronicle
  const addParsedLoot = useCallback((parsed: ParsedLootItem) => {
    const rarity: LootRarity = (parsed.rarity as LootRarity) || 'common';
    const category: LootCategory = parsed.category || 'miscellaneous';
    
    // Calculate gold value if not provided
    const baseValue = parsed.goldValue ?? Math.floor(10 + Math.random() * 40);
    const goldValue = Math.floor(baseValue * lootRarityConfig[rarity].goldMultiplier);
    
    const lootItem: LootItem = {
      id: `loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: parsed.name,
      category,
      rarity,
      goldValue,
      description: parsed.description || 'A mysterious item found during your adventures.',
      lore: parsed.lore,
      mechanics: parsed.mechanics,
      sourceText: parsed.sourceText,
      acquiredAt: new Date().toISOString(),
      hasDiceMechanics: !!(parsed.mechanics?.diceRoll || parsed.mechanics?.damage),
      aiGenerated: {
        description: !parsed.description,
        lore: !parsed.lore,
        mechanics: !parsed.mechanics,
        goldValue: !parsed.goldValue,
      },
    };

    setState(prev => ({
      ...prev,
      items: [...prev.items, lootItem],
    }));
    
    return lootItem;
  }, []);

  // Delete loot item
  const deleteLootItem = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
    }));
  }, []);

  // Sell loot item (returns gold value)
  const sellLootItem = useCallback((itemId: string): LootSellResult => {
    const item = state.items.find(i => i.id === itemId);
    
    if (!item) {
      return { success: false, goldReceived: 0, error: 'Item not found' };
    }
    
    const goldReceived = item.goldValue;
    
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
      soldHistory: [...prev.soldHistory, {
        itemId: item.id,
        itemName: item.name,
        goldReceived,
        soldAt: new Date().toISOString(),
      }],
    }));
    
    return { success: true, goldReceived };
  }, [state.items]);

  // Get item by ID
  const getLootById = useCallback((itemId: string): LootItem | undefined => {
    return state.items.find(i => i.id === itemId);
  }, [state.items]);

  // Get items with dice mechanics (for Combat Items sync)
  const itemsWithDiceMechanics = useMemo(() => {
    return state.items.filter(item => item.hasDiceMechanics);
  }, [state.items]);

  // Get usable items (category = 'usable')
  const usableItems = useMemo(() => {
    return state.items.filter(item => item.category === 'usable');
  }, [state.items]);

  // Clear all loot
  const clearLoot = useCallback(() => {
    setState(prev => ({ ...prev, items: [] }));
  }, []);

  // Clear sold history
  const clearSoldHistory = useCallback(() => {
    setState(prev => ({ ...prev, soldHistory: [] }));
  }, []);

  // Reset loot (for app reset)
  const resetLoot = useCallback(() => {
    setState({ items: [], soldHistory: [] });
    removeScopedItem(STORAGE_KEY);
  }, []);

  // Total value of all loot
  const totalLootValue = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.goldValue, 0);
  }, [state.items]);

  // Total gold from sales
  const totalGoldFromSales = useMemo(() => {
    return state.soldHistory.reduce((sum, record) => sum + record.goldReceived, 0);
  }, [state.soldHistory]);

  return {
    lootItems: state.items,
    soldHistory: state.soldHistory,
    addLootItems,
    addParsedLoot,
    deleteLootItem,
    sellLootItem,
    getLootById,
    itemsWithDiceMechanics,
    usableItems,
    clearLoot,
    clearSoldHistory,
    resetLoot,
    totalLootValue,
    totalGoldFromSales,
  };
}

export type UseLootReturn = ReturnType<typeof useLoot>;
