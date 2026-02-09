// Adapter that wraps UseClassSpellcastingReturn to conform to UseSpellcastingReturn
// so the combat magic tab can work with both Rogue path and class-based spellcasting systems.

import { UseSpellcastingReturn, SpellCastResult } from '@/hooks/use-spellcasting';
import { UseClassSpellcastingReturn } from '@/hooks/use-class-spellcasting';
import { SpellcastingState } from '@/lib/magic/types';
import { SpellPreparationInfo } from '@/lib/magic/calculations';

/**
 * Adapts a UseClassSpellcastingReturn into a UseSpellcastingReturn shape
 * so the combat tab's MobileSpellList and QuickCastPanel can consume it.
 */
export function adaptClassSpellcastingForCombat(
  classSpellcasting: UseClassSpellcastingReturn,
  primaryClass: string
): UseSpellcastingReturn {
  const cs = classSpellcasting.state;

  const adaptedState: SpellcastingState = {
    path: primaryClass === 'warlock' ? 'hexblade' : 'arcane_trickster',
    pathUnlocked: true,
    knownSpells: cs.knownSpells,
    preparedSpells: cs.preparedSpells,
    favoriteSpells: cs.favoriteSpells,
    spellSlots: cs.spellSlots as SpellcastingState['spellSlots'],
    pactSlots: cs.pactSlots ? {
      current: cs.pactSlots.current,
      max: cs.pactSlots.max,
      level: cs.pactSlots.level,
    } : undefined,
    spellcastingAbility: classSpellcasting.spellcastingAbility === 'INT' ? 'INT'
      : classSpellcasting.spellcastingAbility === 'WIS' ? 'WIS' : 'CHA',
    abilityModifier: cs.abilityModifier,
    proficiencyBonus: cs.proficiencyBonus,
    materialComponents: cs.materialComponents,
    focusEquipped: cs.focusEquipped,
    concentratingOn: cs.concentratingOn,
    concentrationStartTime: cs.concentrationStartTime,
    ritualCastingActive: false,
    spellsCastToday: cs.spellsCastToday,
    totalSpellsCast: cs.totalSpellsCast,
  };

  const preparationInfo: SpellPreparationInfo = {
    cantripsKnown: 0,
    maxPreparedSpells: classSpellcasting.maxPreparedSpells,
    spellcasterLevel: 0,
    maxSpellLevel: classSpellcasting.maxSpellLevel,
    hasRitualCasting: false,
  };

  // Wrap castSpell to return SpellCastResult
  const wrappedCastSpell = (
    spellId: string,
    spellName: string,
    baseLevel: number,
    castLevel: number,
    usePact: boolean,
    requiresConcentration: boolean,
    duration: string
  ): SpellCastResult => {
    const result = classSpellcasting.castSpell(
      spellId, spellName, baseLevel, castLevel, usePact, requiresConcentration, duration
    );
    return {
      success: result.success,
      spellId,
      spellName,
      castLevel,
      isUpcast: castLevel > baseLevel,
      isCantrip: baseLevel === 0,
      usedPactSlot: usePact,
      startedConcentration: requiresConcentration && result.success,
      brokeConcentration: result.brokeConcentration,
    };
  };

  return {
    state: adaptedState,
    activeSpells: classSpellcasting.activeSpells,
    spellAttackBonus: classSpellcasting.spellAttackBonus,
    spellSaveDC: classSpellcasting.spellSaveDC,
    hasPath: true,
    isPathUnlocked: true,
    totalSlotsRemaining: classSpellcasting.totalSlotsRemaining,
    preparationInfo,
    currentPreparedCount: classSpellcasting.currentPreparedCount,
    canPrepareMore: classSpellcasting.canPrepareMore,
    getScaledCantripDamage: classSpellcasting.getScaledCantripDamage,
    getConcentrationDC: classSpellcasting.getConcentrationDC,
    selectPath: () => {},
    unlockPath: () => {},
    clearPath: () => {},
    learnSpell: classSpellcasting.learnSpell,
    forgetSpell: classSpellcasting.forgetSpell,
    prepareSpell: classSpellcasting.prepareSpell,
    unprepareSpell: classSpellcasting.unprepareSpell,
    toggleFavorite: classSpellcasting.toggleFavorite,
    useSlot: classSpellcasting.useSlot,
    restoreSlot: classSpellcasting.restoreSlot,
    usePactSlot: classSpellcasting.usePactSlot,
    restorePactSlot: classSpellcasting.restorePactSlot,
    castSpell: wrappedCastSpell,
    dismissActiveSpell: classSpellcasting.dismissActiveSpell,
    startConcentration: classSpellcasting.startConcentration,
    breakConcentration: classSpellcasting.breakConcentration,
    addComponent: classSpellcasting.addComponent,
    useComponent: classSpellcasting.useComponent,
    removeComponent: classSpellcasting.removeComponent,
    toggleFocus: classSpellcasting.toggleFocus,
    onShortRest: classSpellcasting.onShortRest,
    onLongRest: classSpellcasting.onLongRest,
    updateAbilityModifier: () => {},
    updateProficiencyBonus: () => {},
    resetSpellcasting: classSpellcasting.resetClassSpellcasting,
    refreshSlotsForLevel: () => classSpellcasting.refreshSlotsForLevel(),
  };
}
