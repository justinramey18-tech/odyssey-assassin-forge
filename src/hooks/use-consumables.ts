import { useState, useEffect, useCallback } from 'react';
import { Consumable, InventoryItem } from '@/lib/consumables/types';
import { allConsumables, getConsumableById } from '@/lib/consumables';

const STORAGE_KEY = 'odyssey-consumables-inventory';

interface StoredItem {
  consumableId: string;
  quantity: number;
}

export function useConsumables() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedItems: StoredItem[] = JSON.parse(stored);
        const loadedInventory: InventoryItem[] = [];
        
        for (const item of storedItems) {
          const consumable = getConsumableById(item.consumableId);
          if (consumable && item.quantity > 0) {
            loadedInventory.push({ consumable, quantity: item.quantity });
          }
        }
        
        setInventory(loadedInventory);
      }
    } catch (error) {
      console.error('Failed to load consumables inventory:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever inventory changes
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      const toStore: StoredItem[] = inventory.map(item => ({
        consumableId: item.consumable.id,
        quantity: item.quantity,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
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
