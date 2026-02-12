import { useState, useCallback, useEffect } from 'react';
import {
  HomebrewGearItem,
  loadHomebrewGear,
  saveHomebrewGear,
} from '@/lib/inventory/homebrewGear';

export function useHomebrewGear() {
  const [homebrewItems, setHomebrewItems] = useState<HomebrewGearItem[]>(() => loadHomebrewGear());

  useEffect(() => {
    saveHomebrewGear(homebrewItems);
  }, [homebrewItems]);

  const addGear = useCallback((item: HomebrewGearItem) => {
    setHomebrewItems(prev => [...prev, item]);
  }, []);

  const addMultipleGear = useCallback((items: HomebrewGearItem[]) => {
    setHomebrewItems(prev => [...prev, ...items]);
  }, []);

  const removeGear = useCallback((id: string) => {
    setHomebrewItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateGear = useCallback((id: string, updates: Partial<HomebrewGearItem>) => {
    setHomebrewItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  return {
    homebrewItems,
    addGear,
    addMultipleGear,
    removeGear,
    updateGear,
  };
}
