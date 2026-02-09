// Sorcery Points - Sorcerer Class Resource
// Separate progression from spell slots per 5e rules
// Regenerates on long rest (unlike pact slots which regen on short rest)

export interface SorceryPointsConfig {
  maxPoints: number;  // Equal to sorcerer level
}

/**
 * Sorcery points progression
 * Sorcerers gain points equal to their sorcerer level
 */
export const SORCERY_POINTS_BY_LEVEL: Record<number, SorceryPointsConfig> = {
  1:  { maxPoints: 1 },
  2:  { maxPoints: 2 },
  3:  { maxPoints: 3 },
  4:  { maxPoints: 4 },
  5:  { maxPoints: 5 },
  6:  { maxPoints: 6 },
  7:  { maxPoints: 7 },
  8:  { maxPoints: 8 },
  9:  { maxPoints: 9 },
  10: { maxPoints: 10 },
  11: { maxPoints: 11 },
  12: { maxPoints: 12 },
  13: { maxPoints: 13 },
  14: { maxPoints: 14 },
  15: { maxPoints: 15 },
  16: { maxPoints: 16 },
  17: { maxPoints: 17 },
  18: { maxPoints: 18 },
  19: { maxPoints: 19 },
  20: { maxPoints: 20 },
};

/**
 * Spell slot costs for creating slots with sorcery points (Font of Magic)
 * Per 5e PHB: Creating Spell Slots
 */
export const SORCERY_POINT_SLOT_COST: Record<number, number> = {
  1: 2,  // 1st-level slot costs 2 sorcery points
  2: 3,  // 2nd-level slot costs 3 sorcery points
  3: 5,  // 3rd-level slot costs 5 sorcery points
  4: 6,  // 4th-level slot costs 6 sorcery points
  5: 7,  // 5th-level slot costs 7 sorcery points
};

/**
 * Sorcery points gained when converting spell slots (Font of Magic)
 * Per 5e PHB: Converting a Spell Slot to Sorcery Points
 * You gain sorcery points equal to the slot's level
 */
export function getPointsFromSlotLevel(slotLevel: number): number {
  return slotLevel; // 1:1 ratio per 5e rules
}

/**
 * Get sorcery points configuration for a sorcerer level
 */
export function getSorceryPointsForLevel(sorcererLevel: number): SorceryPointsConfig | null {
  if (sorcererLevel < 1) return null;
  const clampedLevel = Math.min(sorcererLevel, 20);
  return SORCERY_POINTS_BY_LEVEL[clampedLevel] ?? null;
}

/**
 * Get the cost to create a spell slot of a given level
 */
export function getSlotCreationCost(slotLevel: number): number | null {
  if (slotLevel < 1 || slotLevel > 5) return null; // Only 1st-5th level slots can be created
  return SORCERY_POINT_SLOT_COST[slotLevel] ?? null;
}

/**
 * Check if sorcery points regenerate on short rest
 * Per 5e: Sorcery points regenerate on LONG rest, not short rest
 */
export function sorceryPointsRegenerateOnShortRest(): boolean {
  return false;
}

/**
 * Check if sorcery points regenerate on long rest
 */
export function sorceryPointsRegenerateOnLongRest(): boolean {
  return true;
}

/**
 * Available Metamagic options (unlocked at level 3)
 * Each has a sorcery point cost
 */
export interface MetamagicOption {
  id: string;
  name: string;
  cost: number;
  description: string;
  unlockedAtLevel: number;
}

export const METAMAGIC_OPTIONS: MetamagicOption[] = [
  {
    id: 'careful',
    name: 'Careful Spell',
    cost: 1,
    description: 'When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell\'s full force. Choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell.',
    unlockedAtLevel: 3,
  },
  {
    id: 'distant',
    name: 'Distant Spell',
    cost: 1,
    description: 'When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range of the spell 30 feet.',
    unlockedAtLevel: 3,
  },
  {
    id: 'empowered',
    name: 'Empowered Spell',
    cost: 1,
    description: 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.',
    unlockedAtLevel: 3,
  },
  {
    id: 'extended',
    name: 'Extended Spell',
    cost: 1,
    description: 'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.',
    unlockedAtLevel: 3,
  },
  {
    id: 'heightened',
    name: 'Heightened Spell',
    cost: 3,
    description: 'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.',
    unlockedAtLevel: 3,
  },
  {
    id: 'quickened',
    name: 'Quickened Spell',
    cost: 2,
    description: 'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.',
    unlockedAtLevel: 3,
  },
  {
    id: 'seeking',
    name: 'Seeking Spell',
    cost: 2,
    description: 'If you make an attack roll for a spell and miss, you can spend 2 sorcery points to reroll the d20, and you must use the new roll. You can use Seeking Spell even if you have already used a different Metamagic option during the casting of the spell.',
    unlockedAtLevel: 3,
  },
  {
    id: 'subtle',
    name: 'Subtle Spell',
    cost: 1,
    description: 'When you cast a spell, you can spend 1 sorcery point to cast it without any somatic or verbal components.',
    unlockedAtLevel: 3,
  },
  {
    id: 'transmuted',
    name: 'Transmuted Spell',
    cost: 1,
    description: 'When you cast a spell that deals a type of damage from the following list, you can spend 1 sorcery point to change that damage type to one of the other listed types: acid, cold, fire, lightning, poison, thunder.',
    unlockedAtLevel: 3,
  },
  {
    id: 'twinned',
    name: 'Twinned Spell',
    cost: 0, // Special: costs spell level (minimum 1)
    description: 'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level to target a second creature in range with the same spell (1 sorcery point if the spell is a cantrip).',
    unlockedAtLevel: 3,
  },
];

/**
 * Get the cost for Twinned Spell (special case - varies by spell level)
 */
export function getTwinnedSpellCost(spellLevel: number): number {
  return Math.max(1, spellLevel); // Cantrips cost 1, leveled spells cost spell level
}

/**
 * Get available metamagic options for a sorcerer level
 */
export function getAvailableMetamagic(sorcererLevel: number): MetamagicOption[] {
  return METAMAGIC_OPTIONS.filter(m => sorcererLevel >= m.unlockedAtLevel);
}
