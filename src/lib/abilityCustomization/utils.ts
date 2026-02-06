// Ability Customization Utilities
// Merges custom overrides with base abilities

import { Ability, TierEffect } from '@/lib/types';
import { AbilityOverride, HomebrewAbility, AbilityCustomizationState } from './types';

/**
 * Apply custom overrides to a base ability
 * Returns a new ability object with customizations merged in
 */
export function applyOverrides(
  baseAbility: Ability,
  override: AbilityOverride | undefined
): Ability & { isCustomized?: boolean; customDice?: AbilityOverride['customDice']; customCooldownMinutes?: number } {
  if (!override) {
    return baseAbility;
  }

  const result: Ability & { isCustomized?: boolean; customDice?: AbilityOverride['customDice']; customCooldownMinutes?: number } = {
    ...baseAbility,
    isCustomized: true,
  };

  // Apply name override
  if (override.customName) {
    result.name = override.customName;
  }

  // Apply icon override
  if (override.customIcon) {
    result.icon = override.customIcon;
  }

  // Apply action type override
  if (override.customActionType) {
    result.actionType = override.customActionType;
  }

  // Apply usage type override
  if (override.customUsageType) {
    result.usageType = override.customUsageType;
  }

  // Apply tier effect overrides
  if (override.customTierEffects && override.customTierEffects.length > 0) {
    result.tierEffects = baseAbility.tierEffects.map(te => {
      const customEffect = override.customTierEffects?.find(cte => cte.tier === te.tier);
      return customEffect || te;
    });
  }

  // Attach custom dice (for prompt generation)
  if (override.customDice) {
    result.customDice = override.customDice;
  }

  // Attach custom cooldown
  if (override.customCooldownMinutes !== undefined) {
    result.customCooldownMinutes = override.customCooldownMinutes;
  }

  return result;
}

/**
 * Convert a homebrew ability to the standard Ability interface
 */
export function homebrewToAbility(
  homebrew: HomebrewAbility
): Ability & { isHomebrew: true; customDice?: HomebrewAbility['dice']; customCooldownMinutes: number } {
  return {
    id: homebrew.id,
    name: homebrew.name,
    tree: homebrew.tree,
    icon: homebrew.icon,
    type: homebrew.type,
    actionType: homebrew.actionType,
    usageType: homebrew.usageType,
    tierEffects: homebrew.tierEffects,
    minLevel: homebrew.minLevel,
    prerequisite: homebrew.prerequisite,
    isHomebrew: true,
    customDice: homebrew.dice,
    customCooldownMinutes: homebrew.cooldownMinutes,
  };
}

/**
 * Get all abilities including homebrew, with overrides applied
 */
export function getCustomizedAbilities(
  baseAbilities: Ability[],
  customization: AbilityCustomizationState
): (Ability & { isCustomized?: boolean; isHomebrew?: boolean })[] {
  // Apply overrides to base abilities
  const customizedBase = baseAbilities.map(ability => 
    applyOverrides(ability, customization.overrides[ability.id])
  );

  // Convert homebrew abilities
  const homebrewConverted = customization.homebrewAbilities.map(homebrewToAbility);

  return [...customizedBase, ...homebrewConverted];
}

/**
 * Check if an ability has any customizations
 */
export function hasCustomizations(
  abilityId: string,
  customization: AbilityCustomizationState
): boolean {
  return abilityId in customization.overrides;
}

/**
 * Generate a unique ID for homebrew abilities
 */
export function generateHomebrewId(): string {
  return `homebrew_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
