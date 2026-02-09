// Wild Shape Hook
// Manages Druid Wild Shape transformations with beast form HP pools

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  WildShapeState,
  BeastForm,
  getWildShapeForLevel,
  getDefaultWildShapeState,
  getAvailableBeastForms,
  formatCR,
} from '@/lib/magic/wildShape';

const WILD_SHAPE_STORAGE_KEY = 'dnd-wild-shape-state';

export interface UseWildShapeReturn {
  state: WildShapeState;
  config: ReturnType<typeof getWildShapeForLevel>;
  availableForms: BeastForm[];
  // Actions
  transform: (form: BeastForm) => boolean;
  revert: (damageOverflow?: number) => number;
  takeDamage: (amount: number) => { reverted: boolean; overflow: number };
  heal: (amount: number) => void;
  useWildShape: () => boolean;
  restoreUse: () => void;
  onShortRest: () => void;
  onLongRest: () => void;
  // Helpers
  canTransform: boolean;
  getRemainingDuration: () => number | null;
}

export function useWildShape(druidLevel: number): UseWildShapeReturn {
  const { toast } = useToast();
  const config = getWildShapeForLevel(druidLevel);
  const availableForms = getAvailableBeastForms(druidLevel);

  // Load initial state from localStorage
  const [state, setState] = useState<WildShapeState>(() => {
    try {
      const saved = localStorage.getItem(WILD_SHAPE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate and merge with defaults
        return {
          ...getDefaultWildShapeState(druidLevel),
          ...parsed,
          maxUses: config?.maxUses ?? 0,
        };
      }
    } catch (e) {
      console.warn('Failed to load Wild Shape state:', e);
    }
    return getDefaultWildShapeState(druidLevel);
  });

  // Persist state changes
  useEffect(() => {
    localStorage.setItem(WILD_SHAPE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Update max uses when level changes
  useEffect(() => {
    if (config && state.maxUses !== config.maxUses) {
      setState(prev => ({
        ...prev,
        maxUses: config.maxUses,
        usesRemaining: Math.min(prev.usesRemaining, config.maxUses),
      }));
    }
  }, [config, state.maxUses]);

  const canTransform = state.usesRemaining > 0 && !state.isTransformed && druidLevel >= 2;

  const transform = useCallback((form: BeastForm): boolean => {
    if (!canTransform) {
      toast({
        title: 'Cannot Transform',
        description: state.isTransformed 
          ? 'You are already in beast form.' 
          : 'No Wild Shape uses remaining.',
        variant: 'destructive',
      });
      return false;
    }

    // Validate form is available
    if (!availableForms.find(f => f.id === form.id)) {
      toast({
        title: 'Form Unavailable',
        description: `You cannot assume the form of a ${form.name} at your level.`,
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      usesRemaining: prev.usesRemaining - 1,
      isTransformed: true,
      currentForm: form,
      formHP: form.hp,
      formMaxHP: form.hp,
      transformedAt: Date.now(),
      transformDurationMinutes: (config?.maxHours ?? 1) * 60,
    }));

    toast({
      title: `🐻 Wild Shape: ${form.name}`,
      description: `Transformed into ${form.name} (CR ${formatCR(form.cr)}). ${form.hp} HP, AC ${form.ac}.`,
      className: 'border-green-500 bg-green-500/10',
    });

    return true;
  }, [canTransform, availableForms, config, state.isTransformed, toast]);

  const revert = useCallback((damageOverflow: number = 0): number => {
    if (!state.isTransformed) return 0;

    const formName = state.currentForm?.name ?? 'beast form';

    setState(prev => ({
      ...prev,
      isTransformed: false,
      currentForm: null,
      formHP: 0,
      formMaxHP: 0,
      transformedAt: undefined,
      transformDurationMinutes: undefined,
    }));

    if (damageOverflow > 0) {
      toast({
        title: `🔄 Wild Shape Ended`,
        description: `Reverted from ${formName}. ${damageOverflow} damage carries over to your true form.`,
        className: 'border-amber-500 bg-amber-500/10',
      });
    } else {
      toast({
        title: `🔄 Wild Shape Ended`,
        description: `Reverted from ${formName} to your true form.`,
        className: 'border-green-500 bg-green-500/10',
      });
    }

    return damageOverflow;
  }, [state.isTransformed, state.currentForm, toast]);

  const takeDamage = useCallback((amount: number): { reverted: boolean; overflow: number } => {
    if (!state.isTransformed || amount <= 0) {
      return { reverted: false, overflow: 0 };
    }

    const newHP = state.formHP - amount;

    if (newHP <= 0) {
      // Form drops to 0 - revert with overflow
      const overflow = Math.abs(newHP);
      revert(overflow);
      return { reverted: true, overflow };
    }

    setState(prev => ({
      ...prev,
      formHP: newHP,
    }));

    return { reverted: false, overflow: 0 };
  }, [state.isTransformed, state.formHP, revert]);

  const heal = useCallback((amount: number) => {
    if (!state.isTransformed || amount <= 0) return;

    setState(prev => ({
      ...prev,
      formHP: Math.min(prev.formHP + amount, prev.formMaxHP),
    }));
  }, [state.isTransformed]);

  const useWildShape = useCallback((): boolean => {
    if (state.usesRemaining <= 0) {
      toast({
        title: 'No Wild Shape Uses',
        description: 'Take a short or long rest to recover Wild Shape uses.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      usesRemaining: prev.usesRemaining - 1,
    }));

    return true;
  }, [state.usesRemaining, toast]);

  const restoreUse = useCallback(() => {
    setState(prev => ({
      ...prev,
      usesRemaining: Math.min(prev.usesRemaining + 1, prev.maxUses),
    }));
  }, []);

  const onShortRest = useCallback(() => {
    // Wild Shape uses recover on short rest
    const restored = (config?.maxUses ?? 0) - state.usesRemaining;
    
    // Also revert if transformed
    if (state.isTransformed) {
      revert();
    }

    setState(prev => ({
      ...prev,
      usesRemaining: config?.maxUses ?? 0,
    }));

    if (restored > 0) {
      toast({
        title: '🌙 Wild Shape Restored',
        description: `${restored} Wild Shape use${restored > 1 ? 's' : ''} recovered.`,
        className: 'border-green-500 bg-green-500/10',
      });
    }
  }, [config, state.usesRemaining, state.isTransformed, revert, toast]);

  const onLongRest = useCallback(() => {
    if (state.isTransformed) {
      revert();
    }

    setState(prev => ({
      ...prev,
      usesRemaining: config?.maxUses ?? 0,
    }));
  }, [config, state.isTransformed, revert]);

  const getRemainingDuration = useCallback((): number | null => {
    if (!state.isTransformed || !state.transformedAt || !state.transformDurationMinutes) {
      return null;
    }

    const elapsed = (Date.now() - state.transformedAt) / 1000 / 60; // minutes
    const remaining = state.transformDurationMinutes - elapsed;
    return Math.max(0, remaining);
  }, [state.isTransformed, state.transformedAt, state.transformDurationMinutes]);

  return {
    state,
    config,
    availableForms,
    transform,
    revert,
    takeDamage,
    heal,
    useWildShape,
    restoreUse,
    onShortRest,
    onLongRest,
    canTransform,
    getRemainingDuration,
  };
}
