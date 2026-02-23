import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  MainCategory, 
  SubTabConfig, 
  getSubTabsForCategory,
  FIGHTING_TABS,
  INVENTORY_TABS,
  UTILITY_TABS,
} from '@/components/navigation/types';

const STORAGE_KEY = 'odyssey-category-navigation';

interface PersistedState {
  mainCategory: MainCategory;
  fightingSubTab: string;
  inventorySubTab: string;
  utilitySubTab: string;
}

interface UseCategoryNavigationOptions {
  isLegacyUnlocked?: boolean;
  onSettingsClick?: () => void;
  onCloudClick?: () => void;
  /** Optional filter — return true to keep the tab visible. Used by app-mode system. */
  tabFilter?: (tabId: string) => boolean;
}

interface UseCategoryNavigationReturn {
  mainCategory: MainCategory;
  activeSubTab: string;
  setMainCategory: (category: MainCategory) => void;
  navigateToSubTab: (subTabId: string, targetCategory?: MainCategory) => void;
  swipeToNextSubTab: () => void;
  swipeToPrevSubTab: () => void;
  getCurrentSubTabs: () => SubTabConfig[];
  getSubTabIndex: () => { current: number; total: number };
  getNextSubTabLabel: () => string | null;
  getPrevSubTabLabel: () => string | null;
}

export function useCategoryNavigation(
  options: UseCategoryNavigationOptions = {}
): UseCategoryNavigationReturn {
  const { isLegacyUnlocked = false, onSettingsClick, onCloudClick, tabFilter } = options;

  // Load persisted state
  const [mainCategory, setMainCategoryState] = useState<MainCategory>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PersistedState = JSON.parse(stored);
        return parsed.mainCategory || 'fighting';
      }
    } catch {
      // Ignore parse errors
    }
    return 'fighting';
  });

  const [fightingSubTab, setFightingSubTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PersistedState = JSON.parse(stored);
        return parsed.fightingSubTab || 'combat';
      }
    } catch {
      // Ignore parse errors
    }
    return 'combat';
  });

  const [inventorySubTab, setInventorySubTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PersistedState = JSON.parse(stored);
        return parsed.inventorySubTab || 'consumables';
      }
    } catch {
      // Ignore parse errors
    }
    return 'consumables';
  });

  const [utilitySubTab, setUtilitySubTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PersistedState = JSON.parse(stored);
        return parsed.utilitySubTab || 'scribe';
      }
    } catch {
      // Ignore parse errors
    }
    return 'scribe';
  });

  // Persist state changes
  useEffect(() => {
    const state: PersistedState = {
      mainCategory,
      fightingSubTab,
      inventorySubTab,
      utilitySubTab,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [mainCategory, fightingSubTab, inventorySubTab, utilitySubTab]);

  // Get current active sub-tab based on category
  const activeSubTab = useMemo(() => {
    switch (mainCategory) {
      case 'fighting':
        return fightingSubTab;
      case 'inventory':
        return inventorySubTab;
      case 'utility':
        return utilitySubTab;
      default:
        return '';
    }
  }, [mainCategory, fightingSubTab, inventorySubTab, utilitySubTab]);

  // Set main category
  const setMainCategory = useCallback((category: MainCategory) => {
    setMainCategoryState(category);
  }, []);

  // Navigate to a specific sub-tab (optionally with explicit category)
  const navigateToSubTab = useCallback((subTabId: string, targetCategory?: MainCategory) => {
    // Handle special cases (settings, cloud trigger modals)
    if (subTabId === 'settings' && onSettingsClick) {
      onSettingsClick();
      return;
    }
    if (subTabId === 'cloud' && onCloudClick) {
      onCloudClick();
      return;
    }

    // Handle legacy lock
    if (subTabId === 'legacy' && !isLegacyUnlocked) {
      return; // Don't navigate if locked
    }

    // Use explicit category if provided, otherwise use current mainCategory
    const category = targetCategory ?? mainCategory;
    
    // If switching to a different category, update the main category as well
    if (targetCategory && targetCategory !== mainCategory) {
      setMainCategoryState(targetCategory);
    }

    // Update the appropriate sub-tab state based on target category
    switch (category) {
      case 'fighting':
        if (FIGHTING_TABS.some(t => t.id === subTabId)) {
          setFightingSubTab(subTabId);
        }
        break;
      case 'inventory':
        if (INVENTORY_TABS.some(t => t.id === subTabId)) {
          setInventorySubTab(subTabId);
        }
        break;
      case 'utility':
        if (UTILITY_TABS.some(t => t.id === subTabId)) {
          setUtilitySubTab(subTabId);
        }
        break;
    }
  }, [mainCategory, isLegacyUnlocked, onSettingsClick, onCloudClick]);

  // Get current sub-tabs for the category (filtered by app mode if tabFilter provided)
  const getCurrentSubTabs = useCallback((): SubTabConfig[] => {
    const tabs = getSubTabsForCategory(mainCategory);
    return tabFilter ? tabs.filter(t => tabFilter(t.id)) : tabs;
  }, [mainCategory, tabFilter]);

  // Get current sub-tab index info
  const getSubTabIndex = useCallback((): { current: number; total: number } => {
    const tabs = getCurrentSubTabs();
    const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
    return {
      current: Math.max(0, currentIndex),
      total: tabs.length,
    };
  }, [getCurrentSubTabs, activeSubTab]);

  // Swipe to next sub-tab
  const swipeToNextSubTab = useCallback(() => {
    const tabs = getCurrentSubTabs();
    const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
    
    if (currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      
      // Skip locked legacy tab
      if (nextTab.id === 'legacy' && !isLegacyUnlocked) {
        if (currentIndex < tabs.length - 2) {
          navigateToSubTab(tabs[currentIndex + 2].id);
        }
        return;
      }
      
      navigateToSubTab(nextTab.id);
    }
  }, [getCurrentSubTabs, activeSubTab, isLegacyUnlocked, navigateToSubTab]);

  // Swipe to previous sub-tab
  const swipeToPrevSubTab = useCallback(() => {
    const tabs = getCurrentSubTabs();
    const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
    
    if (currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      
      // Skip locked legacy tab
      if (prevTab.id === 'legacy' && !isLegacyUnlocked) {
        if (currentIndex > 1) {
          navigateToSubTab(tabs[currentIndex - 2].id);
        }
        return;
      }
      
      navigateToSubTab(prevTab.id);
    }
  }, [getCurrentSubTabs, activeSubTab, isLegacyUnlocked, navigateToSubTab]);

  // Get next sub-tab label for swipe hint
  const getNextSubTabLabel = useCallback((): string | null => {
    const tabs = getCurrentSubTabs();
    const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
    
    if (currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      if (nextTab.id === 'legacy' && !isLegacyUnlocked) {
        if (currentIndex < tabs.length - 2) {
          return tabs[currentIndex + 2].label;
        }
        return null;
      }
      return nextTab.label;
    }
    return null;
  }, [getCurrentSubTabs, activeSubTab, isLegacyUnlocked]);

  // Get previous sub-tab label for swipe hint
  const getPrevSubTabLabel = useCallback((): string | null => {
    const tabs = getCurrentSubTabs();
    const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
    
    if (currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      if (prevTab.id === 'legacy' && !isLegacyUnlocked) {
        if (currentIndex > 1) {
          return tabs[currentIndex - 2].label;
        }
        return null;
      }
      return prevTab.label;
    }
    return null;
  }, [getCurrentSubTabs, activeSubTab, isLegacyUnlocked]);

  return {
    mainCategory,
    activeSubTab,
    setMainCategory,
    navigateToSubTab,
    swipeToNextSubTab,
    swipeToPrevSubTab,
    getCurrentSubTabs,
    getSubTabIndex,
    getNextSubTabLabel,
    getPrevSubTabLabel,
  };
}
