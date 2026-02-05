import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Enemy,
  NewEnemyInput,
  TargetPromptInfo,
  MAX_ENEMIES,
  TARGETS_STORAGE_KEY,
  getHealthStatus,
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
      return {
        enemies: Array.isArray(parsed.enemies) ? parsed.enemies : [],
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
  
  // Combat helpers
  dealDamage: (id: string, amount: number) => void;
  healEnemy: (id: string, amount: number) => void;
  
  // Computed
  enemyCount: number;
  defeatedCount: number;
  activeEnemies: Enemy[];
  
  // Utility
  clearAll: () => void;
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

  // Deal damage to an enemy
  const dealDamage = useCallback((id: string, amount: number) => {
    if (amount <= 0) return;
    
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id 
          ? { ...e, currentHP: Math.max(0, e.currentHP - amount) }
          : e
      ),
    }));
  }, []);

  // Heal an enemy
  const healEnemy = useCallback((id: string, amount: number) => {
    if (amount <= 0) return;
    
    setState(prev => ({
      ...prev,
      enemies: prev.enemies.map(e => 
        e.id === id 
          ? { ...e, currentHP: Math.min(e.maxHP, e.currentHP + amount) }
          : e
      ),
    }));
  }, []);

  // Clear all enemies
  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE);
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
    
    // Combat helpers
    dealDamage,
    healEnemy,
    
    // Computed
    enemyCount: state.enemies.length,
    defeatedCount,
    activeEnemies,
    
    // Utility
    clearAll,
    getTargetForPrompt,
  };
}
