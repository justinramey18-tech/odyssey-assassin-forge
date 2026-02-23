import { useState, useEffect, useCallback, useMemo } from 'react';
import { getScopedItem, setScopedItem, removeScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import {
  AppMode,
  CustomOverrides,
  APP_MODE_CONFIGS,
  isFeatureVisible as _isFeatureVisible,
  isHomeFeatureVisible as _isHomeFeatureVisible,
  isDMButtonVisible as _isDMButtonVisible,
  isQuickAccessVisible as _isQuickAccessVisible,
  isTabVisible as _isTabVisible,
  getFilteredSubTabsForCategory,
  getVisibleCategories as _getVisibleCategories,
} from '@/lib/app-modes';
import type { MainCategory } from '@/components/navigation/types';

const MODE_KEY = 'odyssey-app-mode';
const OVERRIDES_KEY = 'odyssey-app-mode-custom';
export const APP_MODE_CHANGE_EVENT = 'odyssey-app-mode-change';

export function useAppMode() {
  // ── State ────────────────────────────────────────────────────────────────

  const [appMode, setAppModeState] = useState<AppMode | null>(() => {
    try {
      migrateToScoped(MODE_KEY);
      const stored = getScopedItem(MODE_KEY);
      if (stored && stored in APP_MODE_CONFIGS) return stored as AppMode;
    } catch { /* ignore */ }
    return null;
  });

  const [customOverrides, setCustomOverridesState] = useState<CustomOverrides>(() => {
    try {
      migrateToScoped(OVERRIDES_KEY);
      const stored = getScopedItem(OVERRIDES_KEY);
      if (stored) return JSON.parse(stored) as CustomOverrides;
    } catch { /* ignore */ }
    return {};
  });

  // ── Derived ──────────────────────────────────────────────────────────────

  const hasChosenMode = appMode !== null;
  const effectiveMode: AppMode = appMode ?? 'fullAccess';

  // ── Setters ──────────────────────────────────────────────────────────────

  const setAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
    setCustomOverridesState({});
    try {
      setScopedItem(MODE_KEY, mode);
      removeScopedItem(OVERRIDES_KEY);
      window.dispatchEvent(new CustomEvent(APP_MODE_CHANGE_EVENT, { detail: mode }));
    } catch (e) {
      console.error('Failed to save app mode:', e);
    }
  }, []);

  const setCustomOverride = useCallback((featureId: string, visible: boolean) => {
    setCustomOverridesState(prev => {
      const next = { ...prev, [featureId]: visible };
      try { setScopedItem(OVERRIDES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetCustomizations = useCallback(() => {
    setCustomOverridesState({});
    try { removeScopedItem(OVERRIDES_KEY); } catch { /* ignore */ }
  }, []);

  // ── Cross-component sync ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail as AppMode;
      setAppModeState(mode);
      setCustomOverridesState({});
    };
    window.addEventListener(APP_MODE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(APP_MODE_CHANGE_EVENT, handler);
  }, []);

  // ── Bound visibility helpers ─────────────────────────────────────────────

  const isFeatureVisible = useCallback(
    (id: string) => _isFeatureVisible(id, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const isHomeFeatureVisible = useCallback(
    (id: string) => _isHomeFeatureVisible(id, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const isDMButtonVisible = useCallback(
    (id: string) => _isDMButtonVisible(id, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const isQuickAccessVisible = useCallback(
    (id: string) => _isQuickAccessVisible(id, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const isTabVisible = useCallback(
    (id: string) => _isTabVisible(id, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const getFilteredTabs = useCallback(
    (category: MainCategory) => getFilteredSubTabsForCategory(category, effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  const visibleCategories = useMemo(
    () => _getVisibleCategories(effectiveMode, customOverrides),
    [effectiveMode, customOverrides],
  );

  return {
    appMode,
    effectiveMode,
    hasChosenMode,
    setAppMode,
    customOverrides,
    setCustomOverride,
    resetCustomizations,
    isFeatureVisible,
    isHomeFeatureVisible,
    isDMButtonVisible,
    isQuickAccessVisible,
    isTabVisible,
    getFilteredTabs,
    visibleCategories,
  };
}
