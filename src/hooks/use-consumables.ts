import { useState, useEffect, useCallback } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { Consumable, InventoryItem } from '@/lib/consumables/types';
import { allConsumables, getConsumableById } from '@/lib/consumables';

const STORAGE_KEY = 'odyssey-consumables-inventory';

interface StoredItem {
  consumableId: string;
  quantity: number;
  // Store full consumable data for custom/shop items not in the static registry
  customConsumable?: Consumable;
}

export function useConsumables() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from scoped localStorage on mount
  const loadFromStorage = useCallback(() => {
    try {
      const stored = getScopedItem(STORAGE_KEY);
      if (stored) {
        const storedItems: StoredItem[] = JSON.parse(stored);
        const loadedInventory: InventoryItem[] = [];
        
        for (const item of storedItems) {
          const consumable = getConsumableById(item.consumableId) || item.customConsumable;
          if (consumable && item.quantity > 0) {
            loadedInventory.push({ consumable, quantity: item.quantity });
          }
        }
        
        setInventory(loadedInventory);
      } else {
        setInventory([]);
      }
    } catch (error) {
      console.error('Failed to load consumables inventory:', error);
    }
    setIsLoaded(true);
  }, []);

  // Load on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Re-init when character is switched in-memory
  useEffect(() => {
    const handleCharacterLoaded = () => loadFromStorage();
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, [loadFromStorage]);

  // Save to localStorage whenever inventory changes
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      const toStore: StoredItem[] = inventory.map(item => {
        const isInRegistry = !!getConsumableById(item.consumable.id);
        return {
          consumableId: item.consumable.id,
          quantity: item.quantity,
          // Only store full object for custom items not in the static registry
          ...(isInRegistry ? {} : { customConsumable: item.consumable }),
        };
      });
      setScopedItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save consumables inventory:', error);
    }
  }, [inventory, isLoaded]);

  const addItem = useCallback((consumable: Consumable, quantity: number = 1) => {
    setInventory(prev => {
      const existing = prev.find(item => item.consumable.id === consumable.id);
      if (existing) {
        return prev.map(item =>
          item.consumable.id === consumable.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { consumable, quantity }];
    });
  }, []);

  const useItem = useCallback((consumableId: string, quantity: number = 1): boolean => {
    let success = false;
    
    setInventory(prev => {
      const existing = prev.find(item => item.consumable.id === consumableId);
      if (!existing || existing.quantity < quantity) {
        return prev;
      }
      
      success = true;
      const newQuantity = existing.quantity - quantity;
      
      if (newQuantity <= 0) {
        return prev.filter(item => item.consumable.id !== consumableId);
      }
      
      return prev.map(item =>
        item.consumable.id === consumableId
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
    
    return success;
  }, []);

  const removeItem = useCallback((consumableId: string) => {
    setInventory(prev => prev.filter(item => item.consumable.id !== consumableId));
  }, []);

  const setItemQuantity = useCallback((consumableId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(consumableId);
      return;
    }
    
    setInventory(prev => {
      const existing = prev.find(item => item.consumable.id === consumableId);
      if (!existing) {
        const consumable = getConsumableById(consumableId);
        if (consumable) {
          return [...prev, { consumable, quantity }];
        }
        return prev;
      }
      
      return prev.map(item =>
        item.consumable.id === consumableId
          ? { ...item, quantity }
          : item
      );
    });
  }, [removeItem]);

  const clearInventory = useCallback(() => {
    setInventory([]);
  }, []);

  const getItemCount = useCallback((consumableId: string): number => {
    const item = inventory.find(i => i.consumable.id === consumableId);
    return item?.quantity || 0;
  }, [inventory]);

  const getTotalItems = useCallback((): number => {
    return inventory.reduce((sum, item) => sum + item.quantity, 0);
  }, [inventory]);

  const getItemsByType = useCallback((type: 'potion' | 'poison' | 'scroll'): InventoryItem[] => {
    return inventory.filter(item => item.consumable.type === type);
  }, [inventory]);

  return {
    inventory,
    isLoaded,
    addItem,
    useItem,
    removeItem,
    setItemQuantity,
    clearInventory,
    getItemCount,
    getTotalItems,
    getItemsByType,
    allConsumables,
  };
}