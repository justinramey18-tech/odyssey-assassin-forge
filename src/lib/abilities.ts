import { Ability } from './types';

// ═══════════════════════════════════════════════════════════════
// 🏹 HUNTER TREE - Ranged combat and awareness
// ═══════════════════════════════════════════════════════════════

export const hunterAbilities: Ability[] = [
  {
    id: 'devastating_shot',
    name: 'Devastating Shot',
    tree: 'hunter',
    icon: 'Target',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Use a bonus action to charge. Your next ranged attack deals +1d8 damage.' },
      { tier: 2, description: 'Damage increases to +2d8 and ignores half cover.' },
      { tier: 3, description: 'Damage increases to +3d8 and ignores all cover.' },
    ],
    synergies: ['archery_master', 'critical_assassination'],
  },
  {
    id: 'multi_shot',
    name: 'Multi-Shot',
    tree: 'hunter',
    icon: 'Crosshair',
    type: 'active',
    actionType: 'action',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Fire at up to 2 targets within 10 feet of each other. Make separate attack rolls.' },
      { tier: 2, description: 'Can target up to 3 enemies. Add your ability modifier to damage for each target.' },
      { tier: 3, description: 'Can target up to 4 enemies. Each target takes an additional 1d6 damage.' },
    ],
    synergies: ['archery_master'],
  },
  {
    id: 'predator_shot',
    name: 'Predator Shot',
    tree: 'hunter',
    icon: 'Eye',
    type: 'active',
    actionType: 'action',
    usageType: 'short_rest',
    tierEffects: [
      { tier: 1, description: 'Mark a target you can see. Your attacks against them have advantage for 1 minute.' },
      { tier: 2, description: 'While marked, the target cannot benefit from invisibility against you.' },
      { tier: 3, description: 'Marked target takes an additional 2d6 damage from your attacks.' },
    ],
    synergies: ['hunters_instinct'],
  },
  {
    id: 'ghost_arrows',
    name: 'Ghost Arrows',
    tree: 'hunter',
    icon: 'Sparkles',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'short_rest',
    minLevel: 9,
    tierEffects: [
      { tier: 1, description: 'Your arrows become ethereal for 1 minute. They pass through non-magical barriers.' },
      { tier: 2, description: 'Ethereal arrows deal force damage instead of piercing.' },
      { tier: 3, description: 'Ethereal arrows can hit creatures on the Ethereal Plane.' },
    ],
  },
  {
    id: 'rain_of_destruction',
    name: 'Rain of Destruction',
    tree: 'hunter',
    icon: 'CloudRain',
    type: 'active',
    actionType: 'action',
    usageType: 'long_rest',
    minLevel: 9,
    prerequisite: { abilityId: 'multi_shot', tier: 3 },
    tierEffects: [
      { tier: 1, description: 'Rain arrows on a 20-foot radius. All creatures make a Dex save or take 4d8 piercing.' },
      { tier: 2, description: 'Damage increases to 6d8. Failed saves also halve movement until end of their turn.' },
      { tier: 3, description: 'Damage increases to 8d8. Area becomes difficult terrain for 1 minute.' },
    ],
    synergies: ['multi_shot'],
  },
  // Passive abilities
  {
    id: 'archery_master',
    name: 'Archery Master',
    tree: 'hunter',
    icon: 'Award',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: '+1 to ranged attack rolls.' },
      { tier: 2, description: 'Bonus increases to +2 to attack rolls, +1 to damage.' },
      { tier: 3, description: 'Bonus increases to +2 to attack rolls, +2 to damage.' },
    ],
  },
  {
    id: 'hunters_instinct',
    name: "Hunter's Instinct",
    tree: 'hunter',
    icon: 'Radar',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Advantage on Perception checks to spot hidden creatures.' },
      { tier: 2, description: 'Gain blindsight out to 10 feet.' },
      { tier: 3, description: 'Blindsight increases to 30 feet. Cannot be surprised.' },
    ],
    synergies: ['predator_shot'],
  },
  {
    id: 'arrow_retrieval',
    name: 'Arrow Retrieval',
    tree: 'hunter',
    icon: 'Undo2',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'After combat, retrieve 50% of ammunition used.' },
      { tier: 2, description: 'Retrieve 75% of ammunition. Can retrieve arrows from corpses as a bonus action.' },
      { tier: 3, description: 'Retrieve 100% of ammunition. Arrows magically return to your quiver after each attack.' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// ⚔️ WARRIOR TREE - Melee combat and defense
// ═══════════════════════════════════════════════════════════════

export const warriorAbilities: Ability[] = [
  {
    id: 'ring_of_chaos',
    name: 'Ring of Chaos',
    tree: 'warrior',
    icon: 'Flame',
    type: 'active',
    actionType: 'action',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Swing in a whirlwind. All creatures within 5 feet make a Dex save or take 2d6 slashing.' },
      { tier: 2, description: 'Damage increases to 3d6. Failed saves are pushed 5 feet away.' },
      { tier: 3, description: 'Damage increases to 4d6. Radius increases to 10 feet.' },
    ],
    synergies: ['weapon_master'],
  },
  {
    id: 'shield_breaker',
    name: 'Shield Breaker',
    tree: 'warrior',
    icon: 'ShieldOff',
    type: 'active',
    actionType: 'action',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Make a powerful strike that ignores shield AC bonuses.' },
      { tier: 2, description: 'On hit, the target cannot use their shield until the end of their next turn.' },
      { tier: 3, description: 'If the target is using a non-magical shield, it is destroyed.' },
    ],
  },
  {
    id: 'battlecry',
    name: 'Battlecry',
    tree: 'warrior',
    icon: 'Megaphone',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'short_rest',
    minLevel: 9,
    tierEffects: [
      { tier: 1, description: 'Allies within 30 feet gain +1d4 to their next attack roll.' },
      { tier: 2, description: 'Bonus increases to +1d6. Allies also gain temporary HP equal to your level.' },
      { tier: 3, description: 'Bonus increases to +1d8. Enemies within range must make a Wis save or be frightened for 1 round.' },
    ],
  },
  {
    id: 'spartan_rage',
    name: 'Spartan Rage',
    tree: 'warrior',
    icon: 'Zap',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'long_rest',
    tierEffects: [
      { tier: 1, description: 'Enter a rage for 1 minute. Gain +2 to melee damage and resistance to bludgeoning, piercing, slashing.' },
      { tier: 2, description: 'Damage bonus increases to +4. Gain advantage on Strength checks and saves.' },
      { tier: 3, description: 'Damage bonus increases to +6. While raging, drop to 1 HP instead of 0 once.' },
    ],
    synergies: ['weapon_master', 'warriors_resilience'],
  },
  {
    id: 'hero_strike',
    name: 'Hero Strike',
    tree: 'warrior',
    icon: 'Swords',
    type: 'active',
    actionType: 'action',
    usageType: 'short_rest',
    minLevel: 9,
    tierEffects: [
      { tier: 1, description: 'Make a devastating strike dealing weapon damage + 3d10.' },
      { tier: 2, description: 'Damage increases to weapon + 5d10. On hit, target is staggered (disadvantage on next attack).' },
      { tier: 3, description: 'Damage increases to weapon + 7d10. This attack automatically hits.' },
    ],
    synergies: ['weapon_master', 'spartan_rage'],
  },
  // Passive abilities
  {
    id: 'weapon_master',
    name: 'Weapon Master',
    tree: 'warrior',
    icon: 'Sword',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: '+1 to melee attack rolls.' },
      { tier: 2, description: 'Bonus increases to +2 to attack rolls, +1 to damage.' },
      { tier: 3, description: 'Bonus increases to +2 to attack rolls, +2 to damage. Crit range becomes 19-20.' },
    ],
  },
  {
    id: 'warriors_resilience',
    name: "Warrior's Resilience",
    tree: 'warrior',
    icon: 'Shield',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: '+1 to AC when wearing medium or heavy armor.' },
      { tier: 2, description: 'Bonus increases to +2 AC. Reduce incoming critical hits to normal hits.' },
      { tier: 3, description: 'When you take damage, reduce it by your proficiency bonus (min 1).' },
    ],
    synergies: ['spartan_rage'],
  },
  {
    id: 'second_wind_mastery',
    name: 'Second Wind Mastery',
    tree: 'warrior',
    icon: 'Heart',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Your Second Wind heals an additional 1d10.' },
      { tier: 2, description: 'Second Wind now heals 2d10 additional HP and removes one condition.' },
      { tier: 3, description: 'Gain an additional use of Second Wind per short rest.' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 🗡️ ASSASSIN TREE - Stealth, crits, and deception
// ═══════════════════════════════════════════════════════════════

export const assassinAbilities: Ability[] = [
  {
    id: 'critical_assassination',
    name: 'Critical Assassination',
    tree: 'assassin',
    icon: 'Skull',
    type: 'active',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Your attacks against surprised creatures deal an extra 2d6 damage.' },
      { tier: 2, description: 'Extra damage increases to 4d6. These attacks automatically crit.' },
      { tier: 3, description: 'Extra damage increases to 6d6. You can Sneak Attack even without advantage if target is surprised.' },
    ],
    synergies: ['shadow_step', 'vanish'],
  },
  {
    id: 'shadow_step',
    name: 'Shadow Step',
    tree: 'assassin',
    icon: 'Footprints',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Teleport up to 30 feet to an unoccupied space in dim light or darkness you can see.' },
      { tier: 2, description: 'Range increases to 60 feet. Gain advantage on your next attack this turn.' },
      { tier: 3, description: 'Can teleport through solid objects. Leave behind a shadow decoy that lasts 1 round.' },
    ],
    synergies: ['vanish', 'critical_assassination'],
  },
  {
    id: 'venomous_attacks',
    name: 'Venomous Attacks',
    tree: 'assassin',
    icon: 'Droplets',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'short_rest',
    tierEffects: [
      { tier: 1, description: 'Coat your weapon with poison for 1 minute. Deals extra 1d6 poison damage on hit.' },
      { tier: 2, description: 'Damage increases to 2d6. Target must make Con save or be poisoned for 1 round.' },
      { tier: 3, description: 'Damage increases to 3d6. Poisoned targets have disadvantage on all saves.' },
    ],
  },
  {
    id: 'vanish',
    name: 'Vanish',
    tree: 'assassin',
    icon: 'EyeOff',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'short_rest',
    tierEffects: [
      { tier: 1, description: 'Become invisible until the end of your next turn or until you attack.' },
      { tier: 2, description: 'Invisibility lasts 1 minute. Attacking does not break it if you are hidden.' },
      { tier: 3, description: 'While invisible, you leave no tracks and cannot be detected by scent or tremorsense.' },
    ],
    synergies: ['shadow_step', 'critical_assassination'],
  },
  {
    id: 'deaths_veil',
    name: "Death's Veil",
    tree: 'assassin',
    icon: 'Ghost',
    type: 'active',
    actionType: 'reaction',
    usageType: 'long_rest',
    minLevel: 9,
    tierEffects: [
      { tier: 1, description: 'When you would drop to 0 HP, instead drop to 1 and become invisible until end of your next turn.' },
      { tier: 2, description: 'Also teleport up to 30 feet when activating this ability.' },
      { tier: 3, description: 'Regain HP equal to half your maximum HP instead of dropping to 1.' },
    ],
    synergies: ['vanish'],
  },
  // Passive abilities
  {
    id: 'shadow_dancer',
    name: 'Shadow Dancer',
    tree: 'assassin',
    icon: 'Moon',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: '+5 feet movement speed. You can Hide as a bonus action.' },
      { tier: 2, description: 'Speed bonus increases to +10 feet. You can move through enemies as difficult terrain.' },
      { tier: 3, description: 'Speed bonus increases to +15 feet. You can move through walls if you end your turn outside them.' },
    ],
    synergies: ['shadow_step'],
  },
  {
    id: 'poison_tolerance',
    name: 'Poison Tolerance',
    tree: 'assassin',
    icon: 'FlaskConical',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    tierEffects: [
      { tier: 1, description: 'Resistance to poison damage. Advantage on saves against being poisoned.' },
      { tier: 2, description: 'Immunity to poison damage and the poisoned condition.' },
      { tier: 3, description: 'When you would be poisoned, instead heal 1d10 HP.' },
    ],
    synergies: ['venomous_attacks'],
  },
  {
    id: 'sixth_sense',
    name: 'Sixth Sense',
    tree: 'assassin',
    icon: 'Brain',
    type: 'passive',
    actionType: 'passive',
    usageType: 'at_will',
    minLevel: 15,
    tierEffects: [
      { tier: 1, description: '+2 to Initiative. Cannot be surprised while conscious.' },
      { tier: 2, description: 'Initiative bonus increases to +5. You can act normally on surprise rounds.' },
      { tier: 3, description: 'You always act first in initiative order. Immune to divination magic.' },
    ],
  },
];

// Combined array of all abilities
export const allAbilities: Ability[] = [
  ...hunterAbilities,
  ...warriorAbilities,
  ...assassinAbilities,
];

// Get abilities by tree
export function getAbilitiesByTree(tree: 'hunter' | 'warrior' | 'assassin'): Ability[] {
  switch (tree) {
    case 'hunter':
      return hunterAbilities;
    case 'warrior':
      return warriorAbilities;
    case 'assassin':
      return assassinAbilities;
  }
}

// Get ability by ID
export function getAbilityById(id: string): Ability | undefined {
  return allAbilities.find(a => a.id === id);
}
