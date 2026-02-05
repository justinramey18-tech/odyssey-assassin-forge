// Creature Type and Size Definitions for D&D 5e

/**
 * D&D 5e Creature Types
 */
export const CREATURE_TYPES = [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
] as const;

export type CreatureType = typeof CREATURE_TYPES[number];

/**
 * D&D 5e Creature Sizes
 */
export const CREATURE_SIZES = [
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
] as const;

export type CreatureSize = typeof CREATURE_SIZES[number];

/**
 * Common D&D Damage Types
 */
export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;

export type DamageType = typeof DAMAGE_TYPES[number];

/**
 * Display labels for creature types
 */
export const CREATURE_TYPE_LABELS: Record<CreatureType, string> = {
  aberration: 'Aberration',
  beast: 'Beast',
  celestial: 'Celestial',
  construct: 'Construct',
  dragon: 'Dragon',
  elemental: 'Elemental',
  fey: 'Fey',
  fiend: 'Fiend',
  giant: 'Giant',
  humanoid: 'Humanoid',
  monstrosity: 'Monstrosity',
  ooze: 'Ooze',
  plant: 'Plant',
  undead: 'Undead',
};

/**
 * Display labels for creature sizes
 */
export const CREATURE_SIZE_LABELS: Record<CreatureSize, string> = {
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
};

/**
 * Short labels for damage types (icons/badges)
 */
export const DAMAGE_TYPE_LABELS: Record<DamageType, { label: string; emoji: string }> = {
  acid: { label: 'Acid', emoji: '🧪' },
  bludgeoning: { label: 'Bludg', emoji: '🔨' },
  cold: { label: 'Cold', emoji: '❄️' },
  fire: { label: 'Fire', emoji: '🔥' },
  force: { label: 'Force', emoji: '💫' },
  lightning: { label: 'Lght', emoji: '⚡' },
  necrotic: { label: 'Necro', emoji: '💀' },
  piercing: { label: 'Pierce', emoji: '🗡️' },
  poison: { label: 'Poison', emoji: '☠️' },
  psychic: { label: 'Psych', emoji: '🧠' },
  radiant: { label: 'Radiant', emoji: '✨' },
  slashing: { label: 'Slash', emoji: '⚔️' },
  thunder: { label: 'Thunder', emoji: '🌩️' },
};

/**
 * Icon/emoji for creature types
 */
export const CREATURE_TYPE_ICONS: Record<CreatureType, string> = {
  aberration: '👁️',
  beast: '🐺',
  celestial: '👼',
  construct: '🤖',
  dragon: '🐉',
  elemental: '🌀',
  fey: '🧚',
  fiend: '👿',
  giant: '🦶',
  humanoid: '👤',
  monstrosity: '🦑',
  ooze: '🟢',
  plant: '🌿',
  undead: '💀',
};

/**
 * Common enemy conditions (subset of D&D conditions)
 */
export const ENEMY_CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;

export type EnemyCondition = typeof ENEMY_CONDITIONS[number];

/**
 * Condition display info
 */
export const ENEMY_CONDITION_INFO: Record<EnemyCondition, { label: string; emoji: string; effect: string }> = {
  blinded: { label: 'Blinded', emoji: '🙈', effect: 'Attacks have disadvantage' },
  charmed: { label: 'Charmed', emoji: '💕', effect: "Can't attack charmer" },
  deafened: { label: 'Deafened', emoji: '🔇', effect: "Can't hear" },
  frightened: { label: 'Frightened', emoji: '😱', effect: 'Disadvantage while source visible' },
  grappled: { label: 'Grappled', emoji: '🤝', effect: 'Speed is 0' },
  incapacitated: { label: 'Incapacitated', emoji: '😵', effect: 'No actions or reactions' },
  invisible: { label: 'Invisible', emoji: '👻', effect: 'Attacks have advantage' },
  paralyzed: { label: 'Paralyzed', emoji: '⚡', effect: 'Auto-fail STR/DEX saves' },
  petrified: { label: 'Petrified', emoji: '🗿', effect: 'Turned to stone' },
  poisoned: { label: 'Poisoned', emoji: '☠️', effect: 'Disadvantage on attacks & checks' },
  prone: { label: 'Prone', emoji: '🛋️', effect: 'Melee attacks have advantage' },
  restrained: { label: 'Restrained', emoji: '⛓️', effect: 'Speed 0, attacks have disadvantage' },
  stunned: { label: 'Stunned', emoji: '💫', effect: 'Incapacitated, auto-fail saves' },
  unconscious: { label: 'Unconscious', emoji: '😴', effect: 'Prone and incapacitated' },
};
