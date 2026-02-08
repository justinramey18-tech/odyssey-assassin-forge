import { useState, useCallback, useEffect } from 'react';
import { 
  EditingRule, 
  RuleSet, 
  createRule, 
  validateRule, 
  MAX_RULES,
  detectRuleType,
  RuleType,
  RuleScope,
} from '@/lib/scribe/editingRules';

const STORAGE_KEY = 'scribe-editing-rules';
const RULE_SETS_KEY = 'scribe-rule-sets';

export interface UseEditingRulesReturn {
  // Current session rules
  rules: EditingRule[];
  
  // Rule management
  addRule: (instruction?: string, type?: RuleType) => boolean;
  updateRule: (id: string, updates: Partial<Pick<EditingRule, 'instruction' | 'scope' | 'type'>>) => void;
  removeRule: (id: string) => void;
  duplicateRule: (id: string) => boolean;
  reorderRules: (fromIndex: number, toIndex: number) => void;
  clearAllRules: () => void;
  
  // Validation
  canAddRule: boolean;
  validRuleCount: number;
  
  // Saved rule sets
  savedRuleSets: RuleSet[];
  saveAsRuleSet: (name: string) => void;
  loadRuleSet: (id: string) => void;
  deleteRuleSet: (id: string) => void;
  
  // Export/Import
  exportRules: () => string;
  importRules: (json: string) => boolean;
}

// Load saved rule sets from localStorage
function loadSavedRuleSets(): RuleSet[] {
  try {
    const stored = localStorage.getItem(RULE_SETS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RuleSet[];
  } catch (error) {
    console.error('Failed to load saved rule sets:', error);
    return [];
  }
}

// Save rule sets to localStorage
function saveRuleSetsToStorage(ruleSets: RuleSet[]): void {
  try {
    localStorage.setItem(RULE_SETS_KEY, JSON.stringify(ruleSets));
  } catch (error) {
    console.error('Failed to save rule sets:', error);
  }
}

// Load current session rules from localStorage
function loadSessionRules(): EditingRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as EditingRule[];
  } catch (error) {
    console.error('Failed to load session rules:', error);
    return [];
  }
}

// Save current session rules to localStorage
function saveSessionRules(rules: EditingRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error('Failed to save session rules:', error);
  }
}

export function useEditingRules(): UseEditingRulesReturn {
  const [rules, setRules] = useState<EditingRule[]>(() => loadSessionRules());
  const [savedRuleSets, setSavedRuleSets] = useState<RuleSet[]>(() => loadSavedRuleSets());

  // Persist rules to localStorage when they change
  useEffect(() => {
    saveSessionRules(rules);
  }, [rules]);

  // Persist saved rule sets when they change
  useEffect(() => {
    saveRuleSetsToStorage(savedRuleSets);
  }, [savedRuleSets]);

  const canAddRule = rules.length < MAX_RULES;
  const validRuleCount = rules.filter(r => r.isValid).length;

  const addRule = useCallback((instruction: string = '', type?: RuleType): boolean => {
    if (!canAddRule) return false;
    
    const detectedType = type ?? (instruction ? detectRuleType(instruction) : 'custom');
    const newRule = createRule(instruction, detectedType);
    
    setRules(prev => [...prev, newRule]);
    return true;
  }, [canAddRule]);

  const updateRule = useCallback((
    id: string, 
    updates: Partial<Pick<EditingRule, 'instruction' | 'scope' | 'type'>>
  ) => {
    setRules(prev => prev.map(rule => {
      if (rule.id !== id) return rule;
      
      const updatedRule: EditingRule = {
        ...rule,
        ...updates,
      };
      
      // Re-validate if instruction changed
      if (updates.instruction !== undefined) {
        return validateRule(updatedRule);
      }
      
      return updatedRule;
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id));
  }, []);

  const duplicateRule = useCallback((id: string): boolean => {
    if (!canAddRule) return false;
    
    setRules(prev => {
      const sourceRule = prev.find(r => r.id === id);
      if (!sourceRule) return prev;
      
      const sourceIndex = prev.findIndex(r => r.id === id);
      const newRule: EditingRule = {
        ...sourceRule,
        id: crypto.randomUUID(),
      };
      
      // Insert the duplicate right after the source rule
      const newRules = [...prev];
      newRules.splice(sourceIndex + 1, 0, newRule);
      return newRules;
    });
    
    return true;
  }, [canAddRule]);

  const reorderRules = useCallback((fromIndex: number, toIndex: number) => {
    setRules(prev => {
      const newRules = [...prev];
      const [removed] = newRules.splice(fromIndex, 1);
      newRules.splice(toIndex, 0, removed);
      return newRules;
    });
  }, []);

  const clearAllRules = useCallback(() => {
    setRules([]);
  }, []);

  const saveAsRuleSet = useCallback((name: string) => {
    if (rules.length === 0) return;

    const newSet: RuleSet = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Rule Set',
      rules: [...rules],
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    setSavedRuleSets(prev => [...prev, newSet]);
  }, [rules]);

  const loadRuleSet = useCallback((id: string) => {
    const ruleSet = savedRuleSets.find(set => set.id === id);
    if (!ruleSet) return;

    // Update lastUsed timestamp
    setSavedRuleSets(prev => prev.map(set => 
      set.id === id 
        ? { ...set, lastUsed: new Date().toISOString() }
        : set
    ));

    // Load the rules
    setRules(ruleSet.rules.map(rule => validateRule(rule)));
  }, [savedRuleSets]);

  const deleteRuleSet = useCallback((id: string) => {
    setSavedRuleSets(prev => prev.filter(set => set.id !== id));
  }, []);

  const exportRules = useCallback((): string => {
    return JSON.stringify({
      version: 1,
      rules,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }, [rules]);

  const importRules = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      
      if (!data.rules || !Array.isArray(data.rules)) {
        return false;
      }

      // Validate and limit imported rules
      const importedRules = data.rules
        .slice(0, MAX_RULES)
        .map((rule: EditingRule) => validateRule({
          id: crypto.randomUUID(), // Generate new IDs
          type: rule.type || 'custom',
          instruction: rule.instruction || '',
          scope: rule.scope || 'all',
          isValid: true,
        }));

      setRules(importedRules);
      return true;
    } catch (error) {
      console.error('Failed to import rules:', error);
      return false;
    }
  }, []);

  return {
    rules,
    addRule,
    updateRule,
    removeRule,
    duplicateRule,
    reorderRules,
    clearAllRules,
    canAddRule,
    validRuleCount,
    savedRuleSets,
    saveAsRuleSet,
    loadRuleSet,
    deleteRuleSet,
    exportRules,
    importRules,
  };
}
