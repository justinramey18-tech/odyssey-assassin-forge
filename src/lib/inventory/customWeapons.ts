// Custom Weapons - Swords, Daggers, Bows, and Spears
import { EquipmentItem } from './types';

// =============================================================================
// SWORDS (4 Total)
// =============================================================================

export const customSwords: EquipmentItem[] = [
  // 1. Assassin's Shortsword (Uncommon)
  {
    id: 'assassin_shortsword',
    name: "Assassin's Shortsword",
    slotType: 'primary_weapon',
    rarity: 'uncommon',
    level: 5,
    icon: '⚔️',
    description: 'A balanced blade designed for quick, lethal strikes. The crossguard features a hidden compartment for poison.',
    stats: {
      damage: '1d6+2',
      attackBonus: 1,
    },
    properties: ['Finesse', 'Light', 'Poison Reservoir'],
    enchantments: [
      { name: 'Quick Poison', description: 'Apply poison as bonus action' },
      { name: 'Quick Draw', description: 'Draw as free action' },
    ],
    weight: 2,
    value: 200,
  },

  // 2. Blade of Mercy (Rare)
  {
    id: 'blade_of_mercy',
    name: 'Blade of Mercy',
    slotType: 'primary_weapon',
    rarity: 'rare',
    level: 10,
    icon: '🗡️',
    description: 'An elegant longsword with a blade that hums with arcane energy. Grants swift, merciful deaths to its targets.',
    stats: {
      damage: '1d8+3',
      attackBonus: 2,
      criticalDamage: 'x3',
    },
    properties: ['Finesse', 'Versatile (1d10+3)', 'Vorpal (natural 20)'],
    enchantments: [
      { name: 'Keen Edge', description: 'Critical hit on 19-20' },
      { name: 'Instant Death', description: 'DC 15 CON save or die on crit' },
    ],
    weight: 3,
    value: 1200,
  },

  // 3. Shadowbane (Very Rare)
  {
    id: 'shadowbane',
    name: 'Shadowbane',
    slotType: 'primary_weapon',
    rarity: 'epic',
    level: 15,
    icon: '⚜️',
    description: 'A black blade that drinks in light. Forged in absolute darkness, it cuts through both flesh and shadow.',
    stats: {
      damage: '1d8+4',
      attackBonus: 3,
      necroticDamage: '2d6',
    },
    properties: ['Finesse', 'Versatile (1d10+4)', 'Life Drain', 'Shadow Cut'],
    enchantments: [
      { name: 'Vampiric Touch', description: 'Heal for necrotic damage dealt' },
      { name: 'Shadow Strike', description: 'Teleport 30ft as bonus action' },
      { name: 'Devour Shadows', description: 'Absorb shadows for extra damage' },
    ],
    weight: 3,
    value: 4500,
  },

  // 4. Sword of Altaïr (Legendary)
  {
    id: 'sword_of_altair',
    name: "Sword of Altaïr",
    slotType: 'primary_weapon',
    rarity: 'legendary',
    level: 20,
    icon: '🦅',
    description: "The legendary blade of Altaïr Ibn-La'Ahad, first Mentor of the Levantine Brotherhood. Unbreakable and perfectly balanced.",
    stats: {
      damage: '2d8+5',
      attackBonus: 5,
      radiantDamage: '3d6',
      intelligence: 18,
      wisdom: 20,
      charisma: 16,
    },
    properties: ['Finesse', 'Versatile (2d10+5)', 'Unbreakable', 'Legendary', 'Sentient'],
    enchantments: [
      { name: 'Legendary Resistance', description: '3/day auto-succeed saves' },
      { name: 'Eagle Vision', description: 'Grant Eagle Vision to wielder' },
      { name: 'Leap of Faith', description: 'No fall damage' },
      { name: 'Assassinate', description: 'Auto-crit on surprised enemies' },
      { name: "Master's Guidance", description: 'Advantage on all attacks' },
      { name: 'Nothing is True', description: 'See through all illusions' },
    ],
    lore: 'This sentient blade guides the worthy toward justice. It telepathically communicates with its wielder.',
    weight: 3,
    value: 50000,
  },
];

// =============================================================================
// DAGGERS (4 Total)
// =============================================================================

export const customDaggers: EquipmentItem[] = [
  // 1. Throwing Knife of the Brotherhood (Common)
  {
    id: 'brotherhood_throwing_knife',
    name: 'Throwing Knife of the Brotherhood',
    slotType: 'secondary_weapon',
    rarity: 'common',
    level: 1,
    icon: '🔪',
    description: 'Standard issue throwing knife for Brotherhood initiates. Perfectly balanced for accuracy.',
    stats: {
      damage: '1d4+1',
      attackBonus: 1,
      throwingRange: 60,
    },
    properties: ['Finesse', 'Light', 'Thrown (20/60)', 'Returns to hand'],
    enchantments: [
      { name: 'Returning', description: 'Returns as bonus action' },
    ],
    weight: 0.5,
    value: 25,
  },

  // 2. Jeweled Dagger of Artemis Entreri (Rare)
  {
    id: 'entreri_jeweled_dagger',
    name: 'Jeweled Dagger of Artemis Entreri',
    slotType: 'secondary_weapon',
    rarity: 'rare',
    level: 10,
    icon: '💎',
    description: 'A magnificent dagger with a jeweled hilt. Drains the life force of those it strikes, healing the wielder.',
    stats: {
      damage: '1d4+3',
      attackBonus: 3,
      necroticDamage: '2d6',
    },
    properties: ['Finesse', 'Light', 'Thrown (20/60)', 'Life Drain', 'Vampiric'],
    enchantments: [
      { name: 'Vampiric Touch', description: 'Heal for necrotic damage dealt' },
      { name: 'Soul Trap', description: 'Trap souls of slain enemies' },
      { name: 'Life Steal', description: 'Constant life drain' },
    ],
    weight: 1,
    value: 3500,
  },

  // 3. Retribution (Very Rare)
  {
    id: 'retribution_dagger',
    name: 'Retribution',
    slotType: 'secondary_weapon',
    rarity: 'epic',
    level: 15,
    icon: '⚡',
    description: "Durzo Blint's legendary black dagger. Absorbs the souls of those it kills and can release them as devastating attacks.",
    stats: {
      damage: '1d6+4',
      attackBonus: 4,
      necroticDamage: '2d8',
    },
    properties: ['Finesse', 'Light', 'Thrown (30/90)', 'Soul Reaper', 'Returning'],
    enchantments: [
      { name: 'Soul Reaper', description: 'Trap souls on kill' },
      { name: 'Soul Blast', description: 'Release stored souls as 10d10 AoE' },
      { name: 'Returning', description: 'Returns instantly' },
      { name: 'Phase Strike', description: 'Ignore armor AC' },
    ],
    weight: 1,
    value: 8000,
  },

  // 4. Mercy (Legendary)
  {
    id: 'mercy_dagger',
    name: 'Mercy',
    slotType: 'secondary_weapon',
    rarity: 'legendary',
    level: 20,
    icon: '🌟',
    description: "The Night Angel's dagger of mercy. Can kill instantly or heal completely, depending on the wielder's intent.",
    stats: {
      damage: '2d6+5',
      attackBonus: 5,
    },
    properties: ['Finesse', 'Light', 'Thrown (60/180)', 'Dual Nature', 'Sentient'],
    enchantments: [
      { name: 'Judgment', description: 'Choose to kill or heal on hit' },
      { name: 'Mercy Strike', description: 'DC 20 CON save or instant death' },
      { name: 'Resurrection', description: 'Restore recently dead to life' },
      { name: 'Perfect Throw', description: 'Never misses' },
      { name: 'Dimensional Anchor', description: 'Prevent target teleportation' },
    ],
    lore: 'This sentient dagger judges the worthy from the wicked through an empathic bond.',
    weight: 1,
    value: 25000,
  },
];

// =============================================================================
// BOWS (4 Total)
// =============================================================================

export const customBows: EquipmentItem[] = [
  // 1. Silent Hunter's Bow (Uncommon)
  {
    id: 'silent_hunter_bow',
    name: "Silent Hunter's Bow",
    slotType: 'ranged_weapon',
    rarity: 'uncommon',
    level: 5,
    icon: '🏹',
    description: 'A composite bow designed for stealth. Arrows fired from this bow make no sound.',
    stats: {
      damage: '1d8+2',
      attackBonus: 2,
      stealthBonus: 2,
    },
    properties: ['Ammunition (80/320)', 'Two-Handed', 'Silent', 'Stealth'],
    enchantments: [
      { name: 'Silence', description: 'Arrows make no sound' },
      { name: 'Steady Aim', description: '+1 AC when aiming' },
    ],
    weight: 2,
    value: 350,
  },

  // 2. Phantom Bow of the Shadows (Rare)
  {
    id: 'phantom_bow',
    name: 'Phantom Bow of the Shadows',
    slotType: 'ranged_weapon',
    rarity: 'rare',
    level: 10,
    icon: '👻',
    description: 'A bow forged from shadow-infused wood. Creates ethereal arrows that can pass through walls.',
    stats: {
      damage: '1d8+3',
      attackBonus: 3,
      necroticDamage: '1d6',
    },
    properties: ['Ammunition (100/400)', 'Two-Handed', 'Ethereal Arrows', 'No Ammo Required'],
    enchantments: [
      { name: 'Conjure Arrows', description: 'Unlimited shadow arrows' },
      { name: 'Phase Shot', description: 'Ignore cover' },
      { name: 'Shadow Strike', description: 'Teleport to arrow location' },
    ],
    weight: 2,
    value: 2800,
  },

  // 3. Eagle's Talon (Very Rare)
  {
    id: 'eagles_talon_bow',
    name: "Eagle's Talon",
    slotType: 'ranged_weapon',
    rarity: 'epic',
    level: 15,
    icon: '🦅',
    description: 'The legendary bow of the Brotherhood. Grants supernatural accuracy and the ability to curve shots around obstacles.',
    stats: {
      damage: '2d8+4',
      attackBonus: 4,
      radiantDamage: '2d6',
    },
    properties: ['Ammunition (150/600)', 'Two-Handed', 'Seeking Arrows', 'Eagle Vision'],
    enchantments: [
      { name: 'Seeking Arrows', description: 'Auto-hit, DEX save for half' },
      { name: 'Multi-Shot', description: '3 arrows as one attack' },
      { name: 'Eagle Eye', description: 'See through walls, 60ft' },
      { name: 'Headshot', description: 'x3 damage on crit' },
    ],
    weight: 2,
    value: 6500,
  },

  // 4. Bow of the Night Angel (Legendary)
  {
    id: 'night_angel_bow',
    name: 'Bow of the Night Angel',
    slotType: 'ranged_weapon',
    rarity: 'legendary',
    level: 20,
    icon: '🌑',
    description: 'Forged from the essence of night itself. Each arrow fired splits into multiple shadow projectiles.',
    stats: {
      damage: '3d8+5',
      attackBonus: 5,
      necroticDamage: '3d8',
    },
    properties: ['Ammunition (unlimited)', 'Two-Handed', 'Shadow Split', 'Legendary'],
    enchantments: [
      { name: 'Infinite Arrows', description: 'Conjured from shadow' },
      { name: 'Arrow Storm', description: '1 arrow becomes 10' },
      { name: 'Death Shot', description: 'Instant kill on crit' },
      { name: 'Dimensional Anchor', description: 'Prevent target escape' },
      { name: 'Legendary Accuracy', description: 'Never miss' },
      { name: 'Time Stop', description: 'Freeze target for 1 round on hit' },
    ],
    weight: 2,
    value: 35000,
  },
];

// =============================================================================
// SPEARS (4 Total)
// =============================================================================

export const customSpears: EquipmentItem[] = [
  // 1. Assassin's Pike (Uncommon)
  {
    id: 'assassin_pike',
    name: "Assassin's Pike",
    slotType: 'secondary_weapon',
    rarity: 'uncommon',
    level: 5,
    icon: '🔱',
    description: 'A collapsible spear that can be concealed as a walking staff. Extends instantly for surprise attacks.',
    stats: {
      damage: '1d8+2',
      attackBonus: 2,
      reach: 10,
    },
    properties: ['Versatile (1d10+2)', 'Thrown (20/60)', 'Reach', 'Collapsible'],
    enchantments: [
      { name: 'Quick Deploy', description: 'Deploy as bonus action' },
      { name: 'Disguise Self', description: 'Appears as staff' },
    ],
    weight: 4,
    value: 280,
  },

  // 2. Spear of the Dunes (Rare)
  {
    id: 'spear_of_dunes',
    name: 'Spear of the Dunes',
    slotType: 'secondary_weapon',
    rarity: 'rare',
    level: 10,
    icon: '🏜️',
    description: 'A spear used by Assassins in the deserts of the Levant. The blade is enchanted to pierce any armor.',
    stats: {
      damage: '1d10+3',
      attackBonus: 3,
      fireDamage: '1d6',
      reach: 10,
    },
    properties: ['Versatile (1d12+3)', 'Thrown (30/90)', 'Reach', 'Armor Piercing', 'Returning'],
    enchantments: [
      { name: 'Armor Piercing', description: 'Ignore armor AC bonuses' },
      { name: 'Flame Strike', description: 'Bonus fire damage' },
      { name: 'Returning', description: 'Returns as bonus action' },
      { name: 'Sandstorm', description: 'Create obscuring cloud 1/day' },
    ],
    weight: 4,
    value: 1900,
  },

  // 3. Lance of the Phantom (Very Rare)
  {
    id: 'phantom_lance',
    name: 'Lance of the Phantom',
    slotType: 'secondary_weapon',
    rarity: 'epic',
    level: 15,
    icon: '👻',
    description: 'An ethereal spear that can strike from impossible angles. Phases through defenses to strike vital organs.',
    stats: {
      damage: '2d10+4',
      attackBonus: 4,
      forceDamage: '2d8',
      reach: 15,
    },
    properties: ['Versatile (2d12+4)', 'Thrown (60/180)', 'Reach', 'Phase Strike', 'Returning'],
    enchantments: [
      { name: 'Phase Strike', description: 'Ignore all AC' },
      { name: 'Dimensional Strike', description: 'Attack from any angle' },
      { name: 'Returning', description: 'Returns instantly' },
      { name: 'Blink Strike', description: 'Teleport to target after hit' },
      { name: 'Vital Strike', description: '+4d6 damage to surprised targets' },
    ],
    weight: 4,
    value: 7200,
  },

  // 4. Gungnir's Shadow (Legendary)
  {
    id: 'gungnir_shadow',
    name: "Gungnir's Shadow",
    slotType: 'secondary_weapon',
    rarity: 'legendary',
    level: 20,
    icon: '⚡',
    description: "A spear modeled after Odin's legendary weapon but forged in shadow. Never misses its target and always returns.",
    stats: {
      damage: '3d10+5',
      attackBonus: 5,
      lightningDamage: '3d10',
      reach: 20,
    },
    properties: ['Versatile (3d12+5)', 'Thrown (unlimited range)', 'Reach', 'Never Misses', 'Legendary'],
    enchantments: [
      { name: 'Inevitable Strike', description: 'Cannot miss' },
      { name: 'Instant Return', description: 'Returns before end of turn' },
      { name: 'Lightning Strike', description: 'Chain lightning on hit' },
      { name: 'Dimensional Throw', description: 'Throw across planes' },
      { name: 'Death Mark', description: 'Mark targets for death' },
      { name: 'Legendary Resistance', description: 'Auto-succeed saves 1/day' },
    ],
    weight: 4,
    value: 45000,
  },
];

// Combine all weapons
export const allCustomWeapons: EquipmentItem[] = [
  ...customSwords,
  ...customDaggers,
  ...customBows,
  ...customSpears,
];
