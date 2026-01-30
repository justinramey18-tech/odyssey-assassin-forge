import { CooldownConfig, CooldownModifier } from './types';

// Convert minutes to seconds for internal calculations
const MINUTE = 60;

// Short Rest threshold: abilities with base cooldown < 30 minutes can be reset on Short Rest
export const SHORT_REST_THRESHOLD = 30 * MINUTE; // 1800 seconds

// TTRPG-Adjusted Cooldown Configurations
// These are longer than video game timings to match tabletop pacing
export const COOLDOWN_CONFIGS: Record<string, CooldownConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // 🏹 HUNTER TREE
  // ═══════════════════════════════════════════════════════════════
  predator_shot: {
    abilityId: 'predator_shot',
    displayName: 'Predator Shot',
    tree: 'hunter',
    baseCooldown: 8 * MINUTE, // 480 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  multi_shot: {
    abilityId: 'multi_shot',
    displayName: 'Multi-Shot',
    tree: 'hunter',
    baseCooldown: 15 * MINUTE, // 900 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  devastating_shot: {
    abilityId: 'devastating_shot',
    displayName: 'Devastating Shot',
    tree: 'hunter',
    baseCooldown: 20 * MINUTE, // 1200 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  ghost_arrows: {
    abilityId: 'ghost_arrows',
    displayName: 'Ghost Arrows',
    tree: 'hunter',
    baseCooldown: 45 * MINUTE, // 2700 seconds - Long Rest only
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  rain_of_destruction: {
    abilityId: 'rain_of_destruction',
    displayName: 'Rain of Destruction',
    tree: 'hunter',
    baseCooldown: 60 * MINUTE, // 3600 seconds - Long Rest only
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  // Hunter Passives (no cooldowns)
  archery_master: {
    abilityId: 'archery_master',
    displayName: 'Archery Master',
    tree: 'hunter',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  hunters_instinct: {
    abilityId: 'hunters_instinct',
    displayName: "Hunter's Instinct",
    tree: 'hunter',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  arrow_retrieval: {
    abilityId: 'arrow_retrieval',
    displayName: 'Arrow Retrieval',
    tree: 'hunter',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // ⚔️ WARRIOR TREE
  // ═══════════════════════════════════════════════════════════════
  shield_breaker: {
    abilityId: 'shield_breaker',
    displayName: 'Shield Breaker',
    tree: 'warrior',
    baseCooldown: 10 * MINUTE, // 600 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  ring_of_chaos: {
    abilityId: 'ring_of_chaos',
    displayName: 'Ring of Chaos',
    tree: 'warrior',
    baseCooldown: 15 * MINUTE, // 900 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  battlecry: {
    abilityId: 'battlecry',
    displayName: 'Battlecry',
    tree: 'warrior',
    baseCooldown: 18 * MINUTE, // 1080 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  hero_strike: {
    abilityId: 'hero_strike',
    displayName: 'Hero Strike',
    tree: 'warrior',
    baseCooldown: 30 * MINUTE, // 1800 seconds - Long Rest only (exactly at threshold)
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  spartan_rage: {
    abilityId: 'spartan_rage',
    displayName: 'Spartan Rage',
    tree: 'warrior',
    baseCooldown: 150 * MINUTE, // 9000 seconds (2.5 hours) - Long Rest only
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  // Warrior Passives (no cooldowns)
  weapon_master: {
    abilityId: 'weapon_master',
    displayName: 'Weapon Master',
    tree: 'warrior',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  warriors_resilience: {
    abilityId: 'warriors_resilience',
    displayName: "Warrior's Resilience",
    tree: 'warrior',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  second_wind_mastery: {
    abilityId: 'second_wind_mastery',
    displayName: 'Second Wind Mastery',
    tree: 'warrior',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // 🗡️ ASSASSIN TREE
  // ═══════════════════════════════════════════════════════════════
  shadow_step: {
    abilityId: 'shadow_step',
    displayName: 'Shadow Step',
    tree: 'assassin',
    baseCooldown: 12 * MINUTE, // 720 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  venomous_attacks: {
    abilityId: 'venomous_attacks',
    displayName: 'Venomous Attacks',
    tree: 'assassin',
    baseCooldown: 12 * MINUTE, // 720 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  critical_assassination: {
    abilityId: 'critical_assassination',
    displayName: 'Critical Assassination',
    tree: 'assassin',
    baseCooldown: 18 * MINUTE, // 1080 seconds - Short Rest eligible
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  vanish: {
    abilityId: 'vanish',
    displayName: 'Vanish',
    tree: 'assassin',
    baseCooldown: 35 * MINUTE, // 2100 seconds - Long Rest only
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  deaths_veil: {
    abilityId: 'deaths_veil',
    displayName: "Death's Veil",
    tree: 'assassin',
    baseCooldown: 60 * MINUTE, // 3600 seconds (1 hour) - Long Rest only
    tierReductions: { tier1: 0, tier2: 0.125, tier3: 0.25 },
    isPassive: false,
  },
  // Assassin Passives (no cooldowns)
  shadow_dancer: {
    abilityId: 'shadow_dancer',
    displayName: 'Shadow Dancer',
    tree: 'assassin',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  poison_tolerance: {
    abilityId: 'poison_tolerance',
    displayName: 'Poison Tolerance',
    tree: 'assassin',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
  sixth_sense: {
    abilityId: 'sixth_sense',
    displayName: 'Sixth Sense',
    tree: 'assassin',
    baseCooldown: 0,
    tierReductions: { tier1: 0, tier2: 0, tier3: 0 },
    isPassive: true,
  },
};

/**
 * Calculate the effective cooldown for an ability given its tier and modifiers
 * @param abilityId - The ability identifier
 * @param tier - Current tier (1, 2, or 3)
 * @param modifiers - Array of active cooldown modifiers
 * @returns Effective cooldown in seconds
 */
export function calculateEffectiveCooldown(
  abilityId: string,
  tier: 1 | 2 | 3,
  modifiers: CooldownModifier[] = []
): number {
  const config = COOLDOWN_CONFIGS[abilityId];
  if (!config || config.isPassive) return 0;

  // Apply tier reduction
  const tierKey = `tier${tier}` as 'tier1' | 'tier2' | 'tier3';
  const tierReduction = config.tierReductions[tierKey];
  let effectiveCooldown = config.baseCooldown * (1 - tierReduction);

  // Apply modifiers (filter out expired ones)
  const now = Date.now();
  modifiers
    .filter(mod => !mod.expiresAt || mod.expiresAt > now)
    .forEach(mod => {
      if (mod.type === 'percentage') {
        // Percentage reduction (e.g., -10% = value of 10)
        effectiveCooldown *= (1 - mod.value / 100);
      } else {
        // Flat reduction in seconds
        effectiveCooldown -= mod.value;
      }
    });

  return Math.max(0, Math.floor(effectiveCooldown));
}

/**
 * Check if an ability is eligible for Short Rest reset (base cooldown < 30 minutes)
 * Uses BASE cooldown only, ignoring tier reductions (D&D consistency)
 */
export function isShortRestEligible(abilityId: string): boolean {
  const config = COOLDOWN_CONFIGS[abilityId];
  if (!config || config.isPassive) return false;
  return config.baseCooldown < SHORT_REST_THRESHOLD;
}

/**
 * Get all non-passive abilities that have cooldown tracking
 */
export function getTrackableAbilities(): CooldownConfig[] {
  return Object.values(COOLDOWN_CONFIGS).filter(config => !config.isPassive);
}

/**
 * Get abilities grouped by Short Rest / Long Rest recovery
 */
export function getAbilitiesByRestType(): {
  shortRest: CooldownConfig[];
  longRest: CooldownConfig[];
} {
  const trackable = getTrackableAbilities();
  return {
    shortRest: trackable.filter(config => config.baseCooldown < SHORT_REST_THRESHOLD),
    longRest: trackable.filter(config => config.baseCooldown >= SHORT_REST_THRESHOLD),
  };
}
