// Wild Shape Hook
// Manages Druid Wild Shape transformations with beast form HP pools
// Supports Circle of the Moon enhancements + Dragon Wild Shape

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  WildShapeState,
  BeastForm,
  getWildShapeForLevel,
  getDefaultWildShapeState,
  getAvailableBeastForms,
  formatCR,
  BEAST_FORMS,
} from '@/lib/magic/wildShape';
import {
  DruidCircle,
  getMoonCircleWildShape,
  MOON_CIRCLE_BEAST_FORMS,
  ELEMENTAL_FORMS,
  ElementalForm,
  DRAGON_FORMS,
  DragonForm,
} from '@/lib/classes/druidCircles';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import { isMomoEasterEgg } from '@/lib/easter-eggs';

const WILD_SHAPE_STORAGE_KEY = 'dnd-wild-shape-state';

export interface UseWildShapeReturn {
  state: WildShapeState;
  config: ReturnType<typeof getWildShapeForLevel>;
  availableForms: BeastForm[];
  elementalForms: ElementalForm[];
  canUseElemental: boolean;
  dragonForms: DragonForm[];
  canUseDragon: boolean;
  // Actions
  transform: (form: BeastForm) => boolean;
  transformElemental: (form: ElementalForm) => boolean;
  transformDragon: (form: DragonForm) => boolean;
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
  // Circle of the Moon bonus action healing
  healWithSpellSlot: (slotLevel: number) => void;
}

export function useWildShape(druidLevel: number, circle: DruidCircle | null = null, enforceDuration: boolean = true, characterName: string = ''): UseWildShapeReturn {
  const { toast } = useToast();
  const isMomoMoon = isMomoEasterEgg(characterName) && circle === 'moon';
  const baseConfig = getWildShapeForLevel(druidLevel);
  const moonConfig = circle === 'moon' ? getMoonCircleWildShape(druidLevel) : null;
  
  // Use Moon Circle config if available, otherwise base
  // Moon Circle at level 18+ gets 3 uses to support dragon transformation (costs 3)
  // Momo + Moon override: always 3 uses minimum
  const moonMaxUses = isMomoMoon ? 3 : (circle === 'moon' && druidLevel >= 18) ? 3 : (baseConfig?.maxUses ?? 0);
  const config = moonConfig ? {
    maxUses: moonMaxUses,
    maxCR: isMomoMoon ? 99 : moonConfig.maxCR,
    canSwim: isMomoMoon ? true : moonConfig.canSwim,
    canFly: isMomoMoon ? true : moonConfig.canFly,
    maxHours: baseConfig?.maxHours ?? 0,
  } : isMomoMoon ? {
    maxUses: 3,
    maxCR: 99,
    canSwim: true,
    canFly: true,
    maxHours: baseConfig?.maxHours ?? 1,
  } : baseConfig;

  // Get available beast forms based on circle
  const availableForms = useMemo(() => {
    if (!config && !isMomoMoon) return [];
    
    // Momo + Moon: unlock ALL forms, no filtering
    const allForms = (circle === 'moon' || isMomoMoon)
      ? [...BEAST_FORMS, ...MOON_CIRCLE_BEAST_FORMS]
      : BEAST_FORMS;
    
    if (isMomoMoon) return allForms;
    
    return allForms.filter(beast => {
      if (beast.cr > (config?.maxCR ?? 0)) return false;
      if (beast.swimSpeed && !config?.canSwim) return false;
      if (beast.flySpeed && !config?.canFly) return false;
      return true;
    });
  }, [config, circle, isMomoMoon]);

  // Elemental forms (Moon Circle level 10+ OR Momo easter egg)
  const canUseElemental = isMomoMoon || (circle === 'moon' && moonConfig?.canElemental === true);
  const elementalForms = canUseElemental ? ELEMENTAL_FORMS : [];

  // Dragon forms (Moon Circle level 18+ OR Momo easter egg)
  const canUseDragon = isMomoMoon || (circle === 'moon' && moonConfig?.canDragon === true);
  const dragonForms = canUseDragon ? DRAGON_FORMS : [];

  // Load initial state from localStorage
  const [state, setState] = useState<WildShapeState>(() => {
    migrateToScoped(WILD_SHAPE_STORAGE_KEY);
    try {
      const saved = getScopedItem(WILD_SHAPE_STORAGE_KEY);
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
    setScopedItem(WILD_SHAPE_STORAGE_KEY, JSON.stringify(state));
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

  const canTransform = (isMomoMoon || state.usesRemaining > 0) && !state.isTransformed && druidLevel >= 2;

  const transform = useCallback((form: BeastForm): boolean => {
    if (!canTransform && !isMomoMoon) {
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
      transformDurationMinutes: enforceDuration ? (config?.maxHours ?? 1) * 60 : undefined,
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

  // Transform into elemental (Moon Circle level 10+, costs 2 uses)
  const transformElemental = useCallback((form: ElementalForm): boolean => {
    if (!canUseElemental) {
      toast({
        title: 'Elemental Form Unavailable',
        description: 'Elemental Wild Shape requires Circle of the Moon at level 10+.',
        variant: 'destructive',
      });
      return false;
    }

    if (state.usesRemaining < 2) {
      toast({
        title: 'Insufficient Uses',
        description: 'Elemental Wild Shape requires 2 Wild Shape uses.',
        variant: 'destructive',
      });
      return false;
    }

    if (state.isTransformed) {
      toast({
        title: 'Already Transformed',
        description: 'You must revert before assuming a new form.',
        variant: 'destructive',
      });
      return false;
    }

    // Create a BeastForm-compatible object from ElementalForm
    const elementalAsBeast: BeastForm = {
      id: form.id,
      name: form.name,
      cr: form.cr,
      hp: form.hp,
      ac: form.ac,
      speed: form.speed,
      iconName: form.iconName,
      description: form.description,
      specialAbilities: form.specialAbilities,
    };

    setState(prev => ({
      ...prev,
      usesRemaining: prev.usesRemaining - 2, // Costs 2 uses
      isTransformed: true,
      currentForm: elementalAsBeast,
      formHP: form.hp,
      formMaxHP: form.hp,
      transformedAt: Date.now(),
      transformDurationMinutes: enforceDuration ? (config?.maxHours ?? 1) * 60 : undefined,
    }));

    toast({
      title: `🔥 Elemental Wild Shape: ${form.name}`,
      description: `Transformed into ${form.name}! ${form.hp} HP, AC ${form.ac}. Cost: 2 uses.`,
      className: 'border-orange-500 bg-orange-500/10',
    });

    return true;
  }, [canUseElemental, state.usesRemaining, state.isTransformed, config, toast]);

  // Heal with spell slot (Moon Circle Combat Wild Shape feature)
  const healWithSpellSlot = useCallback((slotLevel: number) => {
    if (!state.isTransformed) {
      toast({
        title: 'Not Transformed',
        description: 'You can only use this ability while in beast form.',
        variant: 'destructive',
      });
      return;
    }

    if (circle !== 'moon') {
      toast({
        title: 'Combat Wild Shape Required',
        description: 'This ability requires Circle of the Moon.',
        variant: 'destructive',
      });
      return;
    }

    // Heal 1d8 per slot level
    const healRoll = Array.from({ length: slotLevel }, () => Math.floor(Math.random() * 8) + 1);
    const totalHeal = healRoll.reduce((a, b) => a + b, 0);

    setState(prev => ({
      ...prev,
      formHP: Math.min(prev.formHP + totalHeal, prev.formMaxHP),
    }));

    toast({
      title: `💚 Combat Wild Shape Healing`,
      description: `Expended level ${slotLevel} slot to heal ${totalHeal} HP (${slotLevel}d8: [${healRoll.join(', ')}])`,
      className: 'border-green-500 bg-green-500/10',
    });
  }, [state.isTransformed, circle, toast]);

  // Transform into dragon (Moon Circle level 18+, costs 3 uses)
  const transformDragon = useCallback((form: DragonForm): boolean => {
    if (!canUseDragon) {
      toast({
        title: 'Dragon Form Unavailable',
        description: 'Dragon Wild Shape requires Circle of the Moon at level 18+.',
        variant: 'destructive',
      });
      return false;
    }

    if (state.usesRemaining < 3) {
      toast({
        title: 'Insufficient Uses',
        description: 'Dragon Wild Shape requires 3 Wild Shape uses.',
        variant: 'destructive',
      });
      return false;
    }

    if (state.isTransformed) {
      toast({
        title: 'Already Transformed',
        description: 'You must revert before assuming a new form.',
        variant: 'destructive',
      });
      return false;
    }

    // Create a BeastForm-compatible object from DragonForm
    const dragonAsBeast: BeastForm = {
      id: form.id,
      name: form.name,
      cr: form.cr,
      hp: form.hp,
      ac: form.ac,
      speed: form.speed,
      flySpeed: form.flySpeed,
      swimSpeed: form.swimSpeed,
      iconName: form.iconName,
      description: form.description,
      specialAbilities: form.specialAbilities,
    };

    setState(prev => ({
      ...prev,
      usesRemaining: prev.usesRemaining - 3, // Costs 3 uses
      isTransformed: true,
      currentForm: dragonAsBeast,
      formHP: form.hp,
      formMaxHP: form.hp,
      transformedAt: Date.now(),
      transformDurationMinutes: enforceDuration ? (config?.maxHours ?? 1) * 60 : undefined,
    }));

    toast({
      title: `🐉 Dragon Wild Shape: ${form.name}`,
      description: `Transformed into ${form.name}! ${form.hp} HP, AC ${form.ac}. Cost: 3 uses.`,
      className: 'border-purple-500 bg-purple-500/10',
    });

    return true;
  }, [canUseDragon, state.usesRemaining, state.isTransformed, config, enforceDuration, toast]);

  return {
    state,
    config,
    availableForms,
    elementalForms,
    canUseElemental,
    dragonForms,
    canUseDragon,
    transform,
    transformElemental,
    transformDragon,
    revert,
    takeDamage,
    heal,
    healWithSpellSlot,
    useWildShape,
    restoreUse,
    onShortRest,
    onLongRest,
    canTransform,
    getRemainingDuration,
  };
}
