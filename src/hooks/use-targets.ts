import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Enemy,
  NewEnemyInput,
  TargetPromptInfo,
  MAX_ENEMIES,
  TARGETS_STORAGE_KEY,
  DamageHistoryEntry,
  EnemyCondition,
  DamageType,
} from '@/lib/combat/targetTypes';

interface TargetsState {
  enemies: Enemy[];
  currentTargetId: string | null;
}

const DEFAULT_STATE: TargetsState = {
  enemies: [],
  currentTargetId: null,
};

const SYNC_EVENT = 'odyssey-targets-sync';

/**
 * Load targets from localStorage
 */
function loadFromStorage(): TargetsState {
  try {
    const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const enemies = Array.isArray(parsed.enemies) 
        ? parsed.enemies.map((e: Partial<Enemy>) => ({
            ...e,
            conditions: e.conditions ?? [],
            resistances: e.resistances ?? [],
            vulnerabilities: e.vulnerabilities ?? [],
            immunities: e.immunities ?? [],
            damageHistory: e.damageHistory ?? [],
          }))
        : [];
      return {
        enemies,
        currentTargetId: parsed.currentTargetId ?? null,
      };
    }
  } catch (error) {
    console.warn('Failed to load targets from localStorage:', error);
  }
  return DEFAULT_STATE;
}

/**
 * Save targets to localStorage
 */
function saveToStorage(state: TargetsState): void {
  try {
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save targets to localStorage:', error);
  }
}

function generateId(): string {
  return `enemy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Helper: save, dispatch sync, and schedule ref reset */
function dispatchSync(isSelfUpdate: React.MutableRefObject<boolean>) {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  setTimeout(() => { isSelfUpdate.current = false; }, 50);
}

export interface UseTargetsReturn {
  enemies: Enemy[];
  currentTarget: Enemy | null;
  currentTargetId: string | null;
  addEnemy: (input: NewEnemyInput) => boolean;
  removeEnemy: (id: string) => void;
  updateEnemy: (id: string, updates: Partial<Enemy>) => void;
  setCurrentTarget: (id: string | null) => void;
  cloneEnemy: (id: string) => boolean;
  dealDamage: (id: string, amount: number, damageType?: DamageType, source?: string) => void;
  healEnemy: (id: string, amount: number, source?: string) => void;
  addCondition: (id: string, condition: EnemyCondition) => void;
  removeCondition: (id: string, condition: EnemyCondition) => void;
  toggleCondition: (id: string, condition: EnemyCondition) => void;
  importEnemies: (enemies: NewEnemyInput[]) => number;
  enemyCount: number;
  defeatedCount: number;
  activeEnemies: Enemy[];
  clearAll: () => void;
  clearDefeated: () => void;
  getTargetForPrompt: () => TargetPromptInfo | null;
  refreshFromStorage: () => void;
}

export function useTargets(): UseTargetsReturn {
  const [state, setState] = useState<TargetsState>(loadFromStorage);
  const isSelfUpdate = useRef(false);

  // Persist to localStorage on state change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Listen for sync events from other instances
  useEffect(() => {
    const handler = () => {
      if (isSelfUpdate.current) return;
      setState(loadFromStorage());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const addEnemy = useCallback((input: NewEnemyInput): boolean => {
    if (state.enemies.length >= MAX_ENEMIES) return false;
    
    const newEnemy: Enemy = {
      id: generateId(),
      name: input.name.trim() || 'Unknown Enemy',
      currentHP: input.maxHP,
      maxHP: input.maxHP,
      ac: input.ac,
      notes: input.notes?.trim() || undefined,
      createdAt: Date.now(),
      creatureType: input.creatureType,
      size: input.size,
      initiative: input.initiative,
      conditions: [],
      resistances: input.resistances ?? [],
      vulnerabilities: input.vulnerabilities ?? [],
      immunities: input.immunities ?? [],
      damageHistory: [],
    };
    
    isSelfUpdate.current = true;
    setState(prev => {
      const updated = { ...prev, enemies: [...prev.enemies, newEnemy] };
      if (prev.enemies.length === 0) updated.currentTargetId = newEnemy.id;
      return updated;
    });
    dispatchSync(isSelfUpdate);
    return true;
  }, [state.enemies.length]);

  const removeEnemy = useCallback((id: string) => {
    isSelfUpdate.current = true;
    setState(prev => {
      const newEnemies = prev.enemies.filter(e => e.id !== id);
      let newTargetId = prev.currentTargetId;
      if (prev.currentTargetId === id) {
        const activeEnemy = newEnemies.find(e => e.currentHP > 0);
        newTargetId = activeEnemy?.id ?? null;
      }
      return { enemies: newEnemies, currentTargetId: newTargetId };
    });
    dispatchSync(isSelfUpdate);
  }, []);

  const updateEnemy = useCallback((id: string, updates: Partial<Enemy>) => {
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => e.id === id ? { ...e, ...updates, id: e.id } : e),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const setCurrentTarget = useCallback((id: string | null) => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, currentTargetId: id }));
    dispatchSync(isSelfUpdate);
  }, []);

  const dealDamage = useCallback((id: string, amount: number, damageType?: DamageType, source?: string) => {
    if (amount <= 0) return;
    const historyEntry: DamageHistoryEntry = {
      id: generateId(), amount, type: 'damage', damageType, source, timestamp: Date.now(),
    };
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id ? { ...e, currentHP: Math.max(0, e.currentHP - amount), damageHistory: [...e.damageHistory, historyEntry] } : e
      ),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const healEnemy = useCallback((id: string, amount: number, source?: string) => {
    if (amount <= 0) return;
    const historyEntry: DamageHistoryEntry = {
      id: generateId(), amount, type: 'healing', source, timestamp: Date.now(),
    };
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id ? { ...e, currentHP: Math.min(e.maxHP, e.currentHP + amount), damageHistory: [...e.damageHistory, historyEntry] } : e
      ),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const cloneEnemy = useCallback((id: string): boolean => {
    const enemy = state.enemies.find(e => e.id === id);
    if (!enemy || state.enemies.length >= MAX_ENEMIES) return false;
    const baseName = enemy.name.replace(/\s*\d+$/, '').trim();
    const cloneCount = state.enemies.filter(e => e.name.replace(/\s*\d+$/, '').trim() === baseName).length;
    const clonedEnemy: Enemy = {
      ...enemy, id: generateId(), name: `${baseName} ${cloneCount + 1}`,
      currentHP: enemy.maxHP, createdAt: Date.now(), conditions: [], damageHistory: [],
    };
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, enemies: [...prev.enemies, clonedEnemy] }));
    dispatchSync(isSelfUpdate);
    return true;
  }, [state.enemies]);

  const addCondition = useCallback((id: string, condition: EnemyCondition) => {
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id && !e.conditions.includes(condition) ? { ...e, conditions: [...e.conditions, condition] } : e
      ),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const removeCondition = useCallback((id: string, condition: EnemyCondition) => {
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id ? { ...e, conditions: e.conditions.filter(c => c !== condition) } : e
      ),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const toggleCondition = useCallback((id: string, condition: EnemyCondition) => {
    isSelfUpdate.current = true;
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => {
        if (e.id !== id) return e;
        const has = e.conditions.includes(condition);
        return { ...e, conditions: has ? e.conditions.filter(c => c !== condition) : [...e.conditions, condition] };
      }),
    }));
    dispatchSync(isSelfUpdate);
  }, []);

  const importEnemies = useCallback((newEnemies: NewEnemyInput[]): number => {
    const slotsAvailable = MAX_ENEMIES - state.enemies.length;
    const toImport = newEnemies.slice(0, slotsAvailable);
    if (toImport.length === 0) return 0;
    const importedEnemies: Enemy[] = toImport.map(input => ({
      id: generateId(), name: input.name.trim() || 'Unknown Enemy',
      currentHP: input.maxHP, maxHP: input.maxHP, ac: input.ac,
      notes: input.notes?.trim() || undefined, createdAt: Date.now(),
      creatureType: input.creatureType, size: input.size, initiative: input.initiative,
      conditions: [], resistances: input.resistances ?? [], vulnerabilities: input.vulnerabilities ?? [],
      immunities: input.immunities ?? [], damageHistory: [],
    }));
    isSelfUpdate.current = true;
    setState(prev => {
      const updated = { ...prev, enemies: [...prev.enemies, ...importedEnemies] };
      if (!prev.currentTargetId && importedEnemies.length > 0) updated.currentTargetId = importedEnemies[0].id;
      return updated;
    });
    dispatchSync(isSelfUpdate);
    return importedEnemies.length;
  }, [state.enemies.length]);

  const clearAll = useCallback(() => {
    isSelfUpdate.current = true;
    setState(DEFAULT_STATE);
    dispatchSync(isSelfUpdate);
  }, []);

  const clearDefeated = useCallback(() => {
    isSelfUpdate.current = true;
    setState(prev => ({ ...prev, enemies: prev.enemies.filter(e => e.currentHP > 0) }));
    dispatchSync(isSelfUpdate);
  }, []);

  const currentTarget = useMemo(() => 
    state.enemies.find(e => e.id === state.currentTargetId) ?? null,
    [state.enemies, state.currentTargetId]
  );

  const activeEnemies = useMemo(() => state.enemies.filter(e => e.currentHP > 0), [state.enemies]);
  const defeatedCount = useMemo(() => state.enemies.filter(e => e.currentHP <= 0).length, [state.enemies]);

  const getTargetForPrompt = useCallback((): TargetPromptInfo | null => {
    if (!currentTarget) return null;
    return {
      name: currentTarget.name, ac: currentTarget.ac,
      currentHP: currentTarget.currentHP, maxHP: currentTarget.maxHP,
      notes: currentTarget.notes, creatureType: currentTarget.creatureType,
      size: currentTarget.size, conditions: currentTarget.conditions,
      resistances: currentTarget.resistances, vulnerabilities: currentTarget.vulnerabilities,
      immunities: currentTarget.immunities,
    };
  }, [currentTarget]);

  return {
    enemies: state.enemies, currentTarget, currentTargetId: state.currentTargetId,
    addEnemy, removeEnemy, updateEnemy, setCurrentTarget, cloneEnemy,
    dealDamage, healEnemy, addCondition, removeCondition, toggleCondition,
    importEnemies, enemyCount: state.enemies.length, defeatedCount, activeEnemies,
    clearAll, clearDefeated, getTargetForPrompt,
    refreshFromStorage: useCallback(() => { setState(loadFromStorage()); }, []),
  };
}
