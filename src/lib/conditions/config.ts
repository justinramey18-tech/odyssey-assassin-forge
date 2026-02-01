import { ConditionConfig, QuickPreset } from './types';

// ============================================
// D&D 5e Standard Conditions (14 total)
// ============================================

export const STANDARD_CONDITIONS: ConditionConfig[] = [
  // --- SEVERE DEBUFFS ---
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    category: 'debuff',
    severity: 'severe',
    description: 'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    mechanical: 'Incapacitated, can\'t move/speak, auto-fail STR/DEX saves, attacks have advantage, melee crits',
    icon: 'Zap',
    defaultDuration: 'rounds',
    defaultValue: 1,
    suggestedSave: 'CON',
  },
  {
    id: 'petrified',
    name: 'Petrified',
    category: 'debuff',
    severity: 'severe',
    description: 'A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can\'t move or speak, and is unaware of its surroundings. Attack rolls against the creature have advantage. The creature automatically fails Strength and Dexterity saving throws.',
    mechanical: 'Turned to stone, incapacitated, unaware, auto-fail STR/DEX saves, resistance to all damage',
    icon: 'Mountain',
    defaultDuration: 'indefinite',
    defaultValue: 0,
    suggestedSave: 'CON',
  },
  {
    id: 'stunned',
    name: 'Stunned',
    category: 'debuff',
    severity: 'severe',
    description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.',
    mechanical: 'Incapacitated, can\'t move, auto-fail STR/DEX saves, attacks have advantage',
    icon: 'Star',
    defaultDuration: 'rounds',
    defaultValue: 1,
    suggestedSave: 'CON',
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    category: 'debuff',
    severity: 'severe',
    description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature drops whatever it\'s holding and falls prone. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    mechanical: 'Incapacitated, prone, drops items, unaware, melee attacks are crits',
    icon: 'Moon',
    defaultDuration: 'indefinite',
    defaultValue: 0,
  },

  // --- MODERATE DEBUFFS ---
  {
    id: 'blinded',
    name: 'Blinded',
    category: 'debuff',
    severity: 'moderate',
    description: 'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    mechanical: 'Can\'t see, auto-fail sight checks, attacks against have advantage, your attacks have disadvantage',
    icon: 'EyeOff',
    defaultDuration: 'rounds',
    defaultValue: 1,
    suggestedSave: 'CON',
  },
  {
    id: 'frightened',
    name: 'Frightened',
    category: 'debuff',
    severity: 'moderate',
    description: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can\'t willingly move closer to the source of its fear.',
    mechanical: 'Disadvantage on checks/attacks while source visible, can\'t approach source',
    icon: 'Ghost',
    defaultDuration: 'save_ends',
    defaultValue: 0,
    suggestedSave: 'WIS',
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    category: 'debuff',
    severity: 'moderate',
    description: 'An incapacitated creature can\'t take actions or reactions.',
    mechanical: 'No actions or reactions',
    icon: 'Ban',
    defaultDuration: 'rounds',
    defaultValue: 1,
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    category: 'debuff',
    severity: 'moderate',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
    mechanical: 'Disadvantage on attacks and ability checks',
    icon: 'Skull',
    defaultDuration: 'minutes',
    defaultValue: 1,
    suggestedSave: 'CON',
  },
  {
    id: 'restrained',
    name: 'Restrained',
    category: 'debuff',
    severity: 'moderate',
    description: 'A restrained creature\'s speed becomes 0. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.',
    mechanical: 'Speed 0, attacks against have advantage, your attacks have disadvantage, disadvantage on DEX saves',
    icon: 'Link',
    defaultDuration: 'save_ends',
    defaultValue: 0,
    suggestedSave: 'STR',
  },

  // --- MINOR DEBUFFS ---
  {
    id: 'charmed',
    name: 'Charmed',
    category: 'debuff',
    severity: 'minor',
    description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    mechanical: 'Can\'t attack charmer, charmer has advantage on social checks',
    icon: 'Heart',
    defaultDuration: 'hours',
    defaultValue: 1,
    suggestedSave: 'WIS',
  },
  {
    id: 'deafened',
    name: 'Deafened',
    category: 'debuff',
    severity: 'minor',
    description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    mechanical: 'Can\'t hear, auto-fail hearing checks',
    icon: 'VolumeX',
    defaultDuration: 'rounds',
    defaultValue: 1,
  },
  {
    id: 'grappled',
    name: 'Grappled',
    category: 'debuff',
    severity: 'minor',
    description: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the reach of the grappler.',
    mechanical: 'Speed 0, ends if grappler incapacitated or moved out of reach',
    icon: 'Hand',
    defaultDuration: 'indefinite',
    defaultValue: 0,
    suggestedSave: 'STR',
  },
  {
    id: 'prone',
    name: 'Prone',
    category: 'debuff',
    severity: 'minor',
    description: 'A prone creature\'s only movement option is to crawl. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.',
    mechanical: 'Crawl only, disadvantage on attacks, melee attacks have advantage against you',
    icon: 'ArrowDown',
    defaultDuration: 'indefinite',
    defaultValue: 0,
  },
  {
    id: 'invisible',
    name: 'Invisible',
    category: 'debuff', // Can be either debuff (enemy) or buff (self)
    severity: 'minor',
    description: 'An invisible creature is impossible to see without the aid of magic or a special sense. The creature\'s location can be detected by any noise it makes or any tracks it leaves.',
    mechanical: 'Can\'t be seen, advantage on attacks, attacks against have disadvantage',
    icon: 'Eye',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
];

// ============================================
// Common Buff Effects
// ============================================

export const BUFF_CONDITIONS: ConditionConfig[] = [
  {
    id: 'blessed',
    name: 'Blessed',
    category: 'concentration',
    severity: 'minor',
    description: 'Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.',
    mechanical: '+1d4 to attack rolls and saving throws',
    icon: 'Sparkles',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
  {
    id: 'hasted',
    name: 'Hasted',
    category: 'concentration',
    severity: 'moderate',
    description: 'Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns.',
    mechanical: 'Double speed, +2 AC, advantage on DEX saves, extra action (Attack/Dash/Disengage/Hide/Use Object only)',
    icon: 'Zap',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
  {
    id: 'invisible_self',
    name: 'Invisible (Self)',
    category: 'concentration',
    severity: 'minor',
    description: 'You become invisible until the spell ends. Anything you are wearing or carrying is invisible as long as it is on your person.',
    mechanical: 'Invisible, advantage on attacks, attacks against you have disadvantage',
    icon: 'Eye',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
  {
    id: 'bardic_inspiration',
    name: 'Bardic Inspiration',
    category: 'buff',
    severity: 'minor',
    description: 'You can use a bonus action to inspire another creature. Once within the next 10 minutes, the creature can add the die to one ability check, attack roll, or saving throw.',
    mechanical: 'Add inspiration die (d6-d12) to one roll',
    icon: 'Music',
    defaultDuration: 'minutes',
    defaultValue: 10,
  },
  {
    id: 'guidance',
    name: 'Guidance',
    category: 'concentration',
    severity: 'minor',
    description: 'Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
    mechanical: '+1d4 to one ability check',
    icon: 'Compass',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
  {
    id: 'shield_of_faith',
    name: 'Shield of Faith',
    category: 'concentration',
    severity: 'minor',
    description: 'A shimmering field appears and surrounds a creature, granting it a +2 bonus to AC for the duration.',
    mechanical: '+2 AC',
    icon: 'Shield',
    defaultDuration: 'minutes',
    defaultValue: 10,
  },
  {
    id: 'mirror_image',
    name: 'Mirror Image',
    category: 'buff',
    severity: 'moderate',
    description: 'Three illusory duplicates appear in your space. Each time a creature targets you with an attack during the spell\'s duration, roll a d20 to determine whether the attack instead targets one of your duplicates.',
    mechanical: '3 duplicates, attacks may target duplicates instead (AC 10 + DEX mod)',
    icon: 'Users',
    defaultDuration: 'minutes',
    defaultValue: 1,
  },
  {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    category: 'concentration',
    severity: 'minor',
    description: 'You choose a creature you can see within range and mystically mark it as your quarry. Until the spell ends, you deal an extra 1d6 damage to the target whenever you hit it with a weapon attack.',
    mechanical: '+1d6 damage on weapon attacks against marked target',
    icon: 'Target',
    defaultDuration: 'hours',
    defaultValue: 1,
  },
  {
    id: 'hex',
    name: 'Hex',
    category: 'concentration',
    severity: 'minor',
    description: 'You place a curse on a creature. Until the spell ends, you deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack. Also, choose one ability when you cast the spell. The target has disadvantage on ability checks made with the chosen ability.',
    mechanical: '+1d6 necrotic on attacks, target has disadvantage on one ability\'s checks',
    icon: 'Flame',
    defaultDuration: 'hours',
    defaultValue: 1,
  },
];

// ============================================
// All Conditions Combined
// ============================================

export const ALL_CONDITIONS: ConditionConfig[] = [
  ...STANDARD_CONDITIONS,
  ...BUFF_CONDITIONS,
];

// Helper to get condition by ID
export const getConditionById = (id: string): ConditionConfig | undefined => {
  return ALL_CONDITIONS.find(c => c.id === id);
};

// Helper to get conditions by category
export const getConditionsByCategory = (category: ConditionConfig['category']): ConditionConfig[] => {
  return ALL_CONDITIONS.filter(c => c.category === category);
};

// ============================================
// Quick-Apply Presets (2-tap application)
// ============================================

export const QUICK_PRESETS: Record<string, QuickPreset> = {
  // Common combat debuffs
  poisoned: { conditionId: 'poisoned', durationType: 'minutes', durationValue: 1 },
  frightened: { conditionId: 'frightened', durationType: 'save_ends', durationValue: 0 },
  prone: { conditionId: 'prone', durationType: 'indefinite', durationValue: 0 },
  stunned: { conditionId: 'stunned', durationType: 'rounds', durationValue: 1 },
  blinded: { conditionId: 'blinded', durationType: 'rounds', durationValue: 1 },
  restrained: { conditionId: 'restrained', durationType: 'save_ends', durationValue: 0 },
  grappled: { conditionId: 'grappled', durationType: 'indefinite', durationValue: 0 },
  
  // Common concentration buffs
  blessed: { conditionId: 'blessed', durationType: 'minutes', durationValue: 1, concentration: true },
  hasted: { conditionId: 'hasted', durationType: 'minutes', durationValue: 1, concentration: true },
  hunters_mark: { conditionId: 'hunters_mark', durationType: 'hours', durationValue: 1, concentration: true },
  hex: { conditionId: 'hex', durationType: 'hours', durationValue: 1, concentration: true },
  
  // Non-concentration buffs
  bardic_inspiration: { conditionId: 'bardic_inspiration', durationType: 'minutes', durationValue: 10 },
  mirror_image: { conditionId: 'mirror_image', durationType: 'minutes', durationValue: 1 },
};

// ============================================
// Duration Presets for UI
// ============================================

export const DURATION_PRESETS = [
  { label: '1 Round', durationType: 'rounds' as const, value: 1 },
  { label: '3 Rounds', durationType: 'rounds' as const, value: 3 },
  { label: '1 Minute', durationType: 'minutes' as const, value: 1 },
  { label: '10 Minutes', durationType: 'minutes' as const, value: 10 },
  { label: '1 Hour', durationType: 'hours' as const, value: 1 },
  { label: 'Save Ends', durationType: 'save_ends' as const, value: 0 },
  { label: 'Until Removed', durationType: 'indefinite' as const, value: 0 },
];

// ============================================
// Rest Behavior Configuration
// ============================================

// Conditions that clear on short rest
export const CLEARS_ON_SHORT_REST: string[] = [
  // Most magical effects don't clear on short rest
  // Add specific condition IDs here if needed
];

// Conditions that clear on long rest
export const CLEARS_ON_LONG_REST: string[] = [
  'poisoned',
  'frightened',
  'charmed',
  'exhaustion', // If you add exhaustion levels
];

// Conditions that NEVER auto-clear (require manual removal)
export const NEVER_AUTO_CLEAR: string[] = [
  'petrified',
  'unconscious', // Special handling for death saves
];
