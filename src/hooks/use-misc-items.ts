import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { MiscItem } from '@/lib/miscItems/types';

const STORAGE_KEY = 'odyssey-misc-items';

export function useMiscItems() {
  const [items, setItems] = useState<MiscItem[]>(() => {
    try {
      const saved = getScopedItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('[MiscItems] Failed to load:', e);
    }
    return [];
  });

  // Persist on change
  useEffect(() => {
    try {
      setScopedItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('[MiscItems] Failed to save:', e);
    }
  }, [items]);

  // Re-init on character switch
  useEffect(() => {
    const handleCharacterLoaded = () => {
      try {
        const saved = getScopedItem(STORAGE_KEY);
        setItems(saved ? JSON.parse(saved) : []);
      } catch { setItems([]); }
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
  }, []);

  const addItem = useCallback((item: Omit<MiscItem, 'id' | 'addedAt'>) => {
    // Check if item with same name exists, increment quantity
    setItems(prev => {
      const existing = prev.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        return prev.map(i => 
          i.id === existing.id 
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { 
        ...item, 
        id: uuidv4(), 
        quantity: item.quantity || 1,
        addedAt: new Date().toISOString() 
      }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const adjustQuantity = useCallback((id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = Math.max(0, i.quantity + delta);
      return newQty === 0 ? i : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    miscItems: items,
    addMiscItem: addItem,
    removeMiscItem: removeItem,
    adjustMiscQuantity: adjustQuantity,
    updateMiscNotes: updateNotes,
    clearMiscItems: clearAll,
  };
}
