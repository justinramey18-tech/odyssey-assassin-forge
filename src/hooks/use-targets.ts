import { useState, useCallback, useEffect, useMemo } from 'react';
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

/**
 * Load targets from localStorage
 */
function loadFromStorage(): TargetsState {
  try {
    const stored = localStorage.getItem(TARGETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old enemies without new fields
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

/**
 * Generate a unique ID for enemies
 */
function generateId(): string {
  return `enemy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface UseTargetsReturn {
  // State
  enemies: Enemy[];
  currentTarget: Enemy | null;
  currentTargetId: string | null;
  
  // Actions
  addEnemy: (input: NewEnemyInput) => boolean;
  removeEnemy: (id: string) => void;
  updateEnemy: (id: string, updates: Partial<Enemy>) => void;
  setCurrentTarget: (id: string | null) => void;
  cloneEnemy: (id: string) => boolean;
  
  // Combat helpers
  dealDamage: (id: string, amount: number, damageType?: DamageType, source?: string) => void;
  healEnemy: (id: string, amount: number, source?: string) => void;
  
  // Condition management
  addCondition: (id: string, condition: EnemyCondition) => void;
  removeCondition: (id: string, condition: EnemyCondition) => void;
  toggleCondition: (id: string, condition: EnemyCondition) => void;
  
  // Bulk operations
  importEnemies: (enemies: NewEnemyInput[]) => number;
  
  // Computed
  enemyCount: number;
  defeatedCount: number;
  activeEnemies: Enemy[];
  
  // Utility
  clearAll: () => void;
  clearDefeated: () => void;
  getTargetForPrompt: () => TargetPromptInfo | null;
}

export function useTargets(): UseTargetsReturn {
  const [state, setState] = useState<TargetsState>(loadFromStorage);

  // Persist to localStorage on state change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Add a new enemy
  const addEnemy = useCallback((input: NewEnemyInput): boolean => {
    if (state.enemies.length >= MAX_ENEMIES) {
      return false;
    }
    
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
    
    setState(prev => {
      const updated = {
        ...prev,
        enemies: [...prev.enemies, newEnemy],
      };
      
      // Auto-target if this is the first enemy
      if (prev.enemies.length === 0) {
        updated.currentTargetId = newEnemy.id;
      }
      
      return updated;
    });
    
    return true;
  }, [state.enemies.length]);

  // Remove an enemy
  const removeEnemy = useCallback((id: string) => {
    setState(prev => {
      const newEnemies = prev.enemies.filter(e => e.id !== id);
      let newTargetId = prev.currentTargetId;
      
      // If we removed the current target, select the first remaining active enemy
      if (prev.currentTargetId === id) {
        const activeEnemy = newEnemies.find(e => e.currentHP > 0);
        newTargetId = activeEnemy?.id ?? null;
      }
      
      return {
        enemies: newEnemies,
        currentTargetId: newTargetId,
      };
    });
  }, []);

  // Update an enemy
  const updateEnemy = useCallback((id: string, updates: Partial<Enemy>) => {
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id 
          ? { ...e, ...updates, id: e.id } // Prevent ID from being changed
          : e
      ),
    }));
  }, []);

  // Set current target
  const setCurrentTarget = useCallback((id: string | null) => {
    setState(prev => ({
      ...prev,
      currentTargetId: id,
    }));
  }, []);

  // Deal damage to an enemy with history tracking
  const dealDamage = useCallback((id: string, amount: number, damageType?: DamageType, source?: string) => {
    if (amount <= 0) return;
    
    const historyEntry: DamageHistoryEntry = {
      id: generateId(),
      amount,
      type: 'damage',
      damageType,
      source,
      timestamp: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id 
          ? { 
              ...e, 
              currentHP: Math.max(0, e.currentHP - amount),
              damageHistory: [...e.damageHistory, historyEntry],
            }
          : e
      ),
    }));
  }, []);

  // Heal an enemy with history tracking
  const healEnemy = useCallback((id: string, amount: number, source?: string) => {
    if (amount <= 0) return;
    
    const historyEntry: DamageHistoryEntry = {
      id: generateId(),
      amount,
      type: 'healing',
      source,
      timestamp: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id 
          ? { 
              ...e, 
              currentHP: Math.min(e.maxHP, e.currentHP + amount),
              damageHistory: [...e.damageHistory, historyEntry],
            }
          : e
      ),
    }));
  }, []);

  // Clone an enemy
  const cloneEnemy = useCallback((id: string): boolean => {
    const enemy = state.enemies.find(e => e.id === id);
    if (!enemy || state.enemies.length >= MAX_ENEMIES) return false;
    
    // Find how many clones exist to generate a name
    const baseName = enemy.name.replace(/\s*\d+$/, '').trim();
    const cloneCount = state.enemies.filter(e => 
      e.name.replace(/\s*\d+$/, '').trim() === baseName
    ).length;
    
    const clonedEnemy: Enemy = {
      ...enemy,
      id: generateId(),
      name: `${baseName} ${cloneCount + 1}`,
      currentHP: enemy.maxHP, // Reset HP
      createdAt: Date.now(),
      conditions: [],
      damageHistory: [],
    };
    
    setState(prev => ({
      ...prev,
      enemies: [...prev.enemies, clonedEnemy],
    }));
    
    return true;
  }, [state.enemies]);

  // Condition management
  const addCondition = useCallback((id: string, condition: EnemyCondition) => {
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id && !e.conditions.includes(condition)
          ? { ...e, conditions: [...e.conditions, condition] }
          : e
      ),
    }));
  }, []);

  const removeCondition = useCallback((id: string, condition: EnemyCondition) => {
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id
          ? { ...e, conditions: e.conditions.filter(c => c !== condition) }
          : e
      ),
    }));
  }, []);

  const toggleCondition = useCallback((id: string, condition: EnemyCondition) => {
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => {
        if (e.id !== id) return e;
        const hasCondition = e.conditions.includes(condition);
        return {
          ...e,
          conditions: hasCondition 
            ? e.conditions.filter(c => c !== condition)
            : [...e.conditions, condition],
        };
      }),
    }));
  }, []);

  // Bulk import enemies
  const importEnemies = useCallback((newEnemies: NewEnemyInput[]): number => {
    const slotsAvailable = MAX_ENEMIES - state.enemies.length;
    const toImport = newEnemies.slice(0, slotsAvailable);
    
    if (toImport.length === 0) return 0;
    
    const importedEnemies: Enemy[] = toImport.map(input => ({
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
    }));
    
    setState(prev => {
      const updated = {
        ...prev,
        enemies: [...prev.enemies, ...importedEnemies],
      };
      
      // Auto-target first if none selected
      if (!prev.currentTargetId && importedEnemies.length > 0) {
        updated.currentTargetId = importedEnemies[0].id;
      }
      
      return updated;
    });
    
    return importedEnemies.length;
  }, [state.enemies.length]);

  // Clear all enemies
  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  // Clear only defeated enemies
  const clearDefeated = useCallback(() => {
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.filter(e => e.currentHP > 0),
    }));
  }, []);

  // Computed values
  const currentTarget = useMemo(() => 
    state.enemies.find(e => e.id === state.currentTargetId) ?? null,
    [state.enemies, state.currentTargetId]
  );

  const activeEnemies = useMemo(() => 
    state.enemies.filter(e => e.currentHP > 0),
    [state.enemies]
  );

  const defeatedCount = useMemo(() => 
    state.enemies.filter(e => e.currentHP <= 0).length,
    [state.enemies]
  );

  // Get target info formatted for prompts
  const getTargetForPrompt = useCallback((): TargetPromptInfo | null => {
    if (!currentTarget) return null;
    
    return {
      name: currentTarget.name,
      ac: currentTarget.ac,
      currentHP: currentTarget.currentHP,
      maxHP: currentTarget.maxHP,
      notes: currentTarget.notes,
      creatureType: currentTarget.creatureType,
      size: currentTarget.size,
      conditions: currentTarget.conditions,
      resistances: currentTarget.resistances,
      vulnerabilities: currentTarget.vulnerabilities,
      immunities: currentTarget.immunities,
    };
  }, [currentTarget]);

  return {
    // State
    enemies: state.enemies,
    currentTarget,
    currentTargetId: state.currentTargetId,
    
    // Actions
    addEnemy,
    removeEnemy,
    updateEnemy,
    setCurrentTarget,
    cloneEnemy,
    
    // Combat helpers
    dealDamage,
    healEnemy,
    
    // Condition management
    addCondition,
    removeCondition,
    toggleCondition,
    
    // Bulk operations
    importEnemies,
    
    // Computed
    enemyCount: state.enemies.length,
    defeatedCount,
    activeEnemies,
    
    // Utility
    clearAll,
    clearDefeated,
    getTargetForPrompt,
  };
}
