import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ActiveCondition,
  ConditionState,
  ConditionSessionStats,
  ConditionSeverity,
  DurationType,
  ConditionsContext,
} from '@/lib/conditions/types';
import {
  CONDITION_DEFINITIONS,
  getConditionById,
  getDeadpoolCommentary,
} from '@/lib/conditions/config';
import { Personality } from '@/components/oracle/types';

const STORAGE_KEY = 'odyssey-conditions';
const HISTORY_LIMIT = 10;

// Generate unique ID
function generateId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initial stats
function getInitialStats(): ConditionSessionStats {
  return {
    totalApplied: 0,
    totalCleared: 0,
    conditionCounts: {},
    sourceCounts: {},
    totalRoundsAfflicted: 0,
    savesMade: 0,
    savesFailed: 0,
  };
}

// Load state from localStorage
function loadState(): ConditionState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load conditions state:', e);
  }
  return {
    active: [],
    history: [],
    stats: getInitialStats(),
  };
}

// Save state to localStorage
function saveState(state: ConditionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save conditions state:', e);
  }
}

interface UseConditionsOptions {
  personality?: Personality;
  onConditionAdded?: (condition: ActiveCondition) => void;
  onConditionCleared?: (condition: ActiveCondition) => void;
}

export function useConditions(options: UseConditionsOptions = {}) {
  const { personality = 'deadpool', onConditionAdded, onConditionCleared } = options;
  
  const [state, setState] = useState<ConditionState>(loadState);
  
  // Persist to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);
  
  // Add a new condition
  const addCondition = useCallback((params: {
    conditionId: string;
    name?: string;
    source?: string;
    durationType: DurationType;
    durationValue: number;
    isConcentration?: boolean;
    notes?: string;
  }) => {
    const definition = getConditionById(params.conditionId);
    
    const newCondition: ActiveCondition = {
      id: generateId(),
      conditionId: params.conditionId,
      name: params.name || definition?.name || params.conditionId,
      source: params.source,
      duration: {
        type: params.durationType,
        value: params.durationValue,
        initial: params.durationValue,
      },
      isConcentration: params.isConcentration || false,
      appliedAt: Date.now(),
      notes: params.notes,
      severity: definition?.severity || 'medium',
      category: definition?.category || 'debuff',
      icon: definition?.icon,
      color: definition?.color,
    };
    
    setState(prev => {
      const updatedStats = { ...prev.stats };
      updatedStats.totalApplied += 1;
      updatedStats.conditionCounts[params.conditionId] = 
        (updatedStats.conditionCounts[params.conditionId] || 0) + 1;
      if (params.source) {
        updatedStats.sourceCounts[params.source] = 
          (updatedStats.sourceCounts[params.source] || 0) + 1;
      }
      
      // Update most common
      const maxCondCount = Math.max(...Object.values(updatedStats.conditionCounts));
      updatedStats.mostCommonCondition = Object.entries(updatedStats.conditionCounts)
        .find(([_, count]) => count === maxCondCount)?.[0];
      
      if (Object.keys(updatedStats.sourceCounts).length > 0) {
        const maxSourceCount = Math.max(...Object.values(updatedStats.sourceCounts));
        updatedStats.mostCommonSource = Object.entries(updatedStats.sourceCounts)
          .find(([_, count]) => count === maxSourceCount)?.[0];
      }
      
      return {
        ...prev,
        active: [...prev.active, newCondition],
        stats: updatedStats,
      };
    });
    
    onConditionAdded?.(newCondition);
    
    // Toast with personality
    if (personality === 'deadpool') {
      const comment = getDeadpoolCommentary(
        newCondition.severity === 'critical' ? 'critical_severity' : 'condition_added',
        newCondition.name,
        newCondition.source
      );
      toast(comment, {
        className: 'border-red-500/50 bg-red-500/10',
      });
    } else {
      toast(`${newCondition.name} applied`, {
        description: params.source ? `Source: ${params.source}` : undefined,
      });
    }
    
    return newCondition;
  }, [personality, onConditionAdded]);
  
  // Remove a condition
  const removeCondition = useCallback((conditionId: string, recordInHistory = true) => {
    setState(prev => {
      const condition = prev.active.find(c => c.id === conditionId);
      if (!condition) return prev;
      
      const updatedStats = { ...prev.stats };
      updatedStats.totalCleared += 1;
      
      const newHistory = recordInHistory
        ? [condition, ...prev.history].slice(0, HISTORY_LIMIT)
        : prev.history;
      
      return {
        ...prev,
        active: prev.active.filter(c => c.id !== conditionId),
        history: newHistory,
        stats: updatedStats,
      };
    });
    
    const condition = state.active.find(c => c.id === conditionId);
    if (condition) {
      onConditionCleared?.(condition);
      
      if (personality === 'deadpool') {
        toast(getDeadpoolCommentary('condition_cleared', condition.name), {
          className: 'border-green-500/50 bg-green-500/10',
        });
      } else {
        toast(`${condition.name} cleared`);
      }
    }
  }, [state.active, personality, onConditionCleared]);
  
  // Tick durations (for "End Turn")
  const tickRounds = useCallback((rounds: number = 1) => {
    setState(prev => {
      const expired: ActiveCondition[] = [];
      const updatedActive = prev.active.filter(condition => {
        if (condition.duration.type === 'rounds') {
          const newValue = condition.duration.value - rounds;
          if (newValue <= 0) {
            expired.push(condition);
            return false;
          }
          condition.duration.value = newValue;
        }
        return true;
      });
      
      // Track rounds afflicted
      const activeRoundConditions = prev.active.filter(c => c.duration.type === 'rounds');
      const updatedStats = {
        ...prev.stats,
        totalRoundsAfflicted: prev.stats.totalRoundsAfflicted + activeRoundConditions.length * rounds,
        totalCleared: prev.stats.totalCleared + expired.length,
      };
      
      // Notify expired conditions
      expired.forEach(c => {
        onConditionCleared?.(c);
        toast(`${c.name} expired`, { duration: 2000 });
      });
      
      return {
        ...prev,
        active: updatedActive,
        history: [...expired.slice(0, 3), ...prev.history].slice(0, HISTORY_LIMIT),
        stats: updatedStats,
      };
    });
  }, [onConditionCleared]);
  
  // Adjust duration manually
  const adjustDuration = useCallback((conditionId: string, delta: number) => {
    setState(prev => ({
      ...prev,
      active: prev.active.map(c => 
        c.id === conditionId
          ? { ...c, duration: { ...c.duration, value: Math.max(0, c.duration.value + delta) } }
          : c
      ),
    }));
  }, []);
  
  // Handle save result
  const handleSave = useCallback((conditionId: string, success: boolean) => {
    setState(prev => {
      const updatedStats = {
        ...prev.stats,
        savesMade: prev.stats.savesMade + (success ? 1 : 0),
        savesFailed: prev.stats.savesFailed + (success ? 0 : 1),
      };
      
      if (success) {
        const condition = prev.active.find(c => c.id === conditionId);
        if (condition) {
          if (personality === 'deadpool') {
            toast(getDeadpoolCommentary('save_succeeded'), {
              className: 'border-green-500/50 bg-green-500/10',
            });
          } else {
            toast(`Save succeeded! ${condition.name} cleared.`);
          }
        }
        
        return {
          ...prev,
          active: prev.active.filter(c => c.id !== conditionId),
          history: [
            prev.active.find(c => c.id === conditionId)!,
            ...prev.history,
          ].filter(Boolean).slice(0, HISTORY_LIMIT),
          stats: updatedStats,
        };
      } else {
        if (personality === 'deadpool') {
          toast(getDeadpoolCommentary('save_failed'), {
            className: 'border-orange-500/50 bg-orange-500/10',
          });
        } else {
          toast('Save failed. Condition persists.');
        }
        
        return {
          ...prev,
          stats: updatedStats,
        };
      }
    });
  }, [personality]);
  
  // Short rest - clear applicable conditions
  const shortRest = useCallback(() => {
    setState(prev => {
      const toClear = prev.active.filter(c => {
        const def = getConditionById(c.conditionId);
        return def?.shortRestClears;
      });
      
      const remaining = prev.active.filter(c => {
        const def = getConditionById(c.conditionId);
        return !def?.shortRestClears;
      });
      
      // Also reduce exhaustion by 1
      const updatedRemaining = remaining.map(c => {
        if (c.conditionId.startsWith('exhaustion_')) {
          const level = parseInt(c.conditionId.split('_')[1]);
          if (level > 1) {
            const newLevel = level - 1;
            const newDef = getConditionById(`exhaustion_${newLevel}`);
            return {
              ...c,
              conditionId: `exhaustion_${newLevel}`,
              name: newDef?.name || `Exhaustion (${newLevel})`,
              severity: newDef?.severity || c.severity,
            };
          }
          return null; // Remove exhaustion 1
        }
        return c;
      }).filter(Boolean) as ActiveCondition[];
      
      if (personality === 'deadpool') {
        toast(getDeadpoolCommentary('short_rest'), {
          className: 'border-cyan-500/50 bg-cyan-500/10',
        });
      } else if (toClear.length > 0) {
        toast(`Short rest: Cleared ${toClear.map(c => c.name).join(', ')}`);
      }
      
      return {
        ...prev,
        active: updatedRemaining,
        history: [...toClear, ...prev.history].slice(0, HISTORY_LIMIT),
        stats: {
          ...prev.stats,
          totalCleared: prev.stats.totalCleared + toClear.length,
        },
      };
    });
  }, [personality]);
  
  // Long rest - clear all except permanent
  const longRest = useCallback(() => {
    setState(prev => {
      const permanent = prev.active.filter(c => {
        const def = getConditionById(c.conditionId);
        return def?.longRestClears === false;
      });
      
      const cleared = prev.active.filter(c => {
        const def = getConditionById(c.conditionId);
        return def?.longRestClears !== false;
      });
      
      if (personality === 'deadpool') {
        toast(getDeadpoolCommentary('long_rest'), {
          className: 'border-green-500/50 bg-green-500/10',
        });
      } else if (cleared.length > 0) {
        toast(`Long rest: All conditions cleared!`);
      }
      
      return {
        ...prev,
        active: permanent,
        history: [...cleared, ...prev.history].slice(0, HISTORY_LIMIT),
        stats: {
          ...prev.stats,
          totalCleared: prev.stats.totalCleared + cleared.length,
        },
      };
    });
  }, [personality]);
  
  // Clear all conditions
  const clearAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      active: [],
      history: [...prev.active, ...prev.history].slice(0, HISTORY_LIMIT),
      stats: {
        ...prev.stats,
        totalCleared: prev.stats.totalCleared + prev.active.length,
      },
    }));
    toast('All conditions cleared');
  }, []);
  
  // Reset session stats
  const resetStats = useCallback(() => {
    setState(prev => ({
      ...prev,
      stats: getInitialStats(),
    }));
  }, []);
  
  // Build Oracle context
  const oracleContext = useMemo<ConditionsContext>(() => {
    const activeConditions = state.active
      .filter(c => c.category === 'debuff')
      .map(c => {
        const def = getConditionById(c.conditionId);
        return {
          name: c.name,
          remainingRounds: c.duration.type === 'rounds' ? c.duration.value : 
            c.duration.type === 'minutes' ? c.duration.value * 10 : 0,
          source: c.source,
          severity: c.severity,
          saveType: def?.saveStat,
        };
      });
    
    const activeBuffs = state.active
      .filter(c => c.category === 'buff')
      .map(c => ({
        name: c.name,
        remainingMinutes: c.duration.type === 'minutes' ? c.duration.value :
          c.duration.type === 'rounds' ? Math.ceil(c.duration.value / 10) : 0,
        concentration: c.isConcentration,
      }));
    
    return { activeConditions, activeBuffs };
  }, [state.active]);
  
  // Getters
  const activeConditions = useMemo(() => 
    state.active.filter(c => c.category === 'debuff'),
  [state.active]);
  
  const activeBuffs = useMemo(() => 
    state.active.filter(c => c.category === 'buff'),
  [state.active]);
  
  const hasCriticalCondition = useMemo(() => 
    state.active.some(c => c.severity === 'critical'),
  [state.active]);
  
  const hasConcentration = useMemo(() => 
    state.active.some(c => c.isConcentration),
  [state.active]);
  
  const saveEndsConditions = useMemo(() => 
    state.active.filter(c => c.duration.type === 'save_ends'),
  [state.active]);
  
  return {
    // State
    activeConditions,
    activeBuffs,
    allActive: state.active,
    history: state.history,
    stats: state.stats,
    
    // Computed
    hasCriticalCondition,
    hasConcentration,
    saveEndsConditions,
    oracleContext,
    
    // Actions
    addCondition,
    removeCondition,
    tickRounds,
    adjustDuration,
    handleSave,
    shortRest,
    longRest,
    clearAll,
    resetStats,
  };
}
