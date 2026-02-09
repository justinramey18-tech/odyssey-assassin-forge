// Warlock Eldritch Invocations
// D&D 5e Invocations: passive abilities that modify Eldritch Blast or grant at-will spells

export type InvocationCategory = 'eldritch_blast' | 'at_will_spell' | 'passive' | 'pact_boon';

export interface EldritchInvocation {
  id: string;
  name: string;
  category: InvocationCategory;
  /** Minimum warlock level required */
  levelRequirement: number;
  /** Other prerequisites (e.g., 'eldritch blast cantrip', 'Pact of the Blade') */
  prerequisite: string | null;
  description: string;
  /** For at-will spells: the spell name granted */
  grantsSpell?: string;
  /** For EB modifiers: mechanical effect description */
  mechanicalEffect: string;
  /** Lucide icon name */
  iconName: string;
}

// ============================================
// ELDRITCH BLAST MODIFIERS
// ============================================

const EB_INVOCATIONS: EldritchInvocation[] = [
  {
    id: 'agonizing-blast',
    name: 'Agonizing Blast',
    category: 'eldritch_blast',
    levelRequirement: 2,
    prerequisite: 'Eldritch Blast cantrip',
    description: 'When you cast Eldritch Blast, add your Charisma modifier to the damage it deals on a hit.',
    mechanicalEffect: '+CHA modifier to each Eldritch Blast beam damage',
    iconName: 'Flame',
  },
  {
    id: 'repelling-blast',
    name: 'Repelling Blast',
    category: 'eldritch_blast',
    levelRequirement: 2,
    prerequisite: 'Eldritch Blast cantrip',
    description: 'When you hit a creature with Eldritch Blast, you can push the creature up to 10 feet away from you in a straight line.',
    mechanicalEffect: 'Push target 10 ft per beam on hit',
    iconName: 'ArrowUpFromLine',
  },
  {
    id: 'eldritch-spear',
    name: 'Eldritch Spear',
    category: 'eldritch_blast',
    levelRequirement: 2,
    prerequisite: 'Eldritch Blast cantrip',
    description: 'When you cast Eldritch Blast, its range is 300 feet.',
    mechanicalEffect: 'Eldritch Blast range increased to 300 ft',
    iconName: 'Crosshair',
  },
  {
    id: 'grasp-of-hadar',
    name: 'Grasp of Hadar',
    category: 'eldritch_blast',
    levelRequirement: 2,
    prerequisite: 'Eldritch Blast cantrip',
    description: 'Once on each of your turns when you hit a creature with your Eldritch Blast, you can move that creature in a straight line 10 feet closer to you.',
    mechanicalEffect: 'Pull target 10 ft closer (once per turn)',
    iconName: 'Magnet',
  },
  {
    id: 'lance-of-lethargy',
    name: 'Lance of Lethargy',
    category: 'eldritch_blast',
    levelRequirement: 2,
    prerequisite: 'Eldritch Blast cantrip',
    description: 'Once on each of your turns when you hit a creature with your Eldritch Blast, you can reduce that creature\'s speed by 10 feet until the end of your next turn.',
    mechanicalEffect: 'Reduce target speed by 10 ft (once per turn)',
    iconName: 'Snail',
  },
];

// ============================================
// AT-WILL SPELL INVOCATIONS
// ============================================

const AT_WILL_INVOCATIONS: EldritchInvocation[] = [
  {
    id: 'armor-of-shadows',
    name: 'Armor of Shadows',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast Mage Armor on yourself at will, without expending a spell slot or material components.',
    grantsSpell: 'Mage Armor',
    mechanicalEffect: 'Cast Mage Armor at will (self only, AC = 13 + DEX)',
    iconName: 'Shield',
  },
  {
    id: 'mask-of-many-faces',
    name: 'Mask of Many Faces',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast Disguise Self at will, without expending a spell slot.',
    grantsSpell: 'Disguise Self',
    mechanicalEffect: 'Cast Disguise Self at will',
    iconName: 'Drama',
  },
  {
    id: 'eldritch-sight',
    name: 'Eldritch Sight',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast Detect Magic at will, without expending a spell slot.',
    grantsSpell: 'Detect Magic',
    mechanicalEffect: 'Cast Detect Magic at will',
    iconName: 'Search',
  },
  {
    id: 'beast-speech',
    name: 'Beast Speech',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast Speak with Animals at will, without expending a spell slot.',
    grantsSpell: 'Speak with Animals',
    mechanicalEffect: 'Cast Speak with Animals at will',
    iconName: 'Bird',
  },
  {
    id: 'fiendish-vigor',
    name: 'Fiendish Vigor',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast False Life on yourself at will as a 1st-level spell, without expending a spell slot or material components.',
    grantsSpell: 'False Life',
    mechanicalEffect: 'Cast False Life at will (1d4+4 temp HP)',
    iconName: 'HeartPulse',
  },
  {
    id: 'misty-visions',
    name: 'Misty Visions',
    category: 'at_will_spell',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can cast Silent Image at will, without expending a spell slot or material components.',
    grantsSpell: 'Silent Image',
    mechanicalEffect: 'Cast Silent Image at will',
    iconName: 'Image',
  },
  {
    id: 'ascendant-step',
    name: 'Ascendant Step',
    category: 'at_will_spell',
    levelRequirement: 9,
    prerequisite: null,
    description: 'You can cast Levitate on yourself at will, without expending a spell slot or material components.',
    grantsSpell: 'Levitate',
    mechanicalEffect: 'Cast Levitate at will (self only)',
    iconName: 'ArrowUp',
  },
  {
    id: 'otherworldly-leap',
    name: 'Otherworldly Leap',
    category: 'at_will_spell',
    levelRequirement: 9,
    prerequisite: null,
    description: 'You can cast Jump on yourself at will, without expending a spell slot or material components.',
    grantsSpell: 'Jump',
    mechanicalEffect: 'Cast Jump at will (self only)',
    iconName: 'ArrowBigUp',
  },
  {
    id: 'whispers-of-the-grave',
    name: 'Whispers of the Grave',
    category: 'at_will_spell',
    levelRequirement: 9,
    prerequisite: null,
    description: 'You can cast Speak with Dead at will, without expending a spell slot.',
    grantsSpell: 'Speak with Dead',
    mechanicalEffect: 'Cast Speak with Dead at will',
    iconName: 'Skull',
  },
  {
    id: 'shroud-of-shadow',
    name: 'Shroud of Shadow',
    category: 'at_will_spell',
    levelRequirement: 15,
    prerequisite: null,
    description: 'You can cast Invisibility at will, without expending a spell slot.',
    grantsSpell: 'Invisibility',
    mechanicalEffect: 'Cast Invisibility at will',
    iconName: 'EyeOff',
  },
];

// ============================================
// PASSIVE INVOCATIONS
// ============================================

const PASSIVE_INVOCATIONS: EldritchInvocation[] = [
  {
    id: 'devils-sight',
    name: "Devil's Sight",
    category: 'passive',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.',
    mechanicalEffect: 'See in all darkness (including magical) 120 ft',
    iconName: 'Eye',
  },
  {
    id: 'eyes-of-the-rune-keeper',
    name: 'Eyes of the Rune Keeper',
    category: 'passive',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You can read all writing.',
    mechanicalEffect: 'Read all writing (any language or code)',
    iconName: 'BookOpen',
  },
  {
    id: 'beguiling-influence',
    name: 'Beguiling Influence',
    category: 'passive',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You gain proficiency in the Deception and Persuasion skills.',
    mechanicalEffect: 'Proficiency in Deception and Persuasion',
    iconName: 'MessageSquare',
  },
  {
    id: 'eldritch-mind',
    name: 'Eldritch Mind',
    category: 'passive',
    levelRequirement: 2,
    prerequisite: null,
    description: 'You have advantage on Constitution saving throws that you make to maintain your concentration on a spell.',
    mechanicalEffect: 'Advantage on concentration saves',
    iconName: 'Brain',
  },
  {
    id: 'gift-of-the-ever-living-ones',
    name: 'Gift of the Ever-Living Ones',
    category: 'passive',
    levelRequirement: 2,
    prerequisite: 'Pact of the Chain',
    description: 'Whenever you regain hit points while your familiar is within 100 feet of you, treat any dice rolled to determine the hit points you regain as having rolled their maximum value.',
    mechanicalEffect: 'Maximize healing dice when familiar is near',
    iconName: 'Heart',
  },
  {
    id: 'maddening-hex',
    name: 'Maddening Hex',
    category: 'passive',
    levelRequirement: 5,
    prerequisite: 'Hex spell or warlock curse feature',
    description: 'As a bonus action, you cause a psychic disturbance around the target cursed by your Hex spell or a warlock feature. Each creature of your choice within 5 feet of the target takes psychic damage equal to your Charisma modifier (minimum 1).',
    mechanicalEffect: 'Bonus action: CHA mod psychic damage to creatures near Hex target',
    iconName: 'BrainCircuit',
  },
  {
    id: 'relentless-hex',
    name: 'Relentless Hex',
    category: 'passive',
    levelRequirement: 7,
    prerequisite: 'Hex spell or warlock curse feature',
    description: 'Your curse creates a temporary bond between you and your target. As a bonus action, you can magically teleport up to 30 feet to an unoccupied space you can see within 5 feet of the target cursed by your Hex spell or a warlock feature.',
    mechanicalEffect: 'Bonus action: teleport 30 ft to Hex target',
    iconName: 'Zap',
  },
  {
    id: 'witch-sight',
    name: 'Witch Sight',
    category: 'passive',
    levelRequirement: 15,
    prerequisite: null,
    description: 'You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic while the creature is within 30 feet of you and within line of sight.',
    mechanicalEffect: 'See through shapechanging and illusions within 30 ft',
    iconName: 'ScanEye',
  },
];

// ============================================
// PACT BOON INVOCATIONS
// ============================================

const PACT_BOON_INVOCATIONS: EldritchInvocation[] = [
  {
    id: 'thirsting-blade',
    name: 'Thirsting Blade',
    category: 'pact_boon',
    levelRequirement: 5,
    prerequisite: 'Pact of the Blade',
    description: 'You can attack with your pact weapon twice, instead of once, whenever you take the Attack action on your turn.',
    mechanicalEffect: 'Extra Attack with pact weapon',
    iconName: 'Swords',
  },
  {
    id: 'lifedrinker',
    name: 'Lifedrinker',
    category: 'pact_boon',
    levelRequirement: 12,
    prerequisite: 'Pact of the Blade',
    description: 'When you hit a creature with your pact weapon, the creature takes extra necrotic damage equal to your Charisma modifier (minimum 1).',
    mechanicalEffect: '+CHA mod necrotic damage on pact weapon hits',
    iconName: 'Skull',
  },
  {
    id: 'book-of-ancient-secrets',
    name: 'Book of Ancient Secrets',
    category: 'pact_boon',
    levelRequirement: 2,
    prerequisite: 'Pact of the Tome',
    description: 'You can now inscribe magical rituals in your Book of Shadows. Choose two 1st-level spells that have the ritual tag from any class\'s spell list. You can cast these spells as rituals. You can add other ritual spells to your Book of Shadows.',
    mechanicalEffect: 'Learn 2 ritual spells from any class + collect more',
    iconName: 'BookOpen',
  },
  {
    id: 'voice-of-the-chain-master',
    name: 'Voice of the Chain Master',
    category: 'pact_boon',
    levelRequirement: 2,
    prerequisite: 'Pact of the Chain',
    description: 'You can communicate telepathically with your familiar and perceive through your familiar\'s senses as long as you are on the same plane of existence.',
    mechanicalEffect: 'Telepathic communication and perception through familiar',
    iconName: 'Radio',
  },
  {
    id: 'investment-of-the-chain-master',
    name: 'Investment of the Chain Master',
    category: 'pact_boon',
    levelRequirement: 2,
    prerequisite: 'Pact of the Chain',
    description: 'When you cast Find Familiar, you can bestow the familiar with additional benefits: it uses your spell attack modifier for attacks, its attacks are magical, and you can command it to attack as a bonus action.',
    mechanicalEffect: 'Enhanced familiar: your spell attack, magical attacks, bonus action attack',
    iconName: 'Bug',
  },
];

// ============================================
// COMBINED EXPORTS
// ============================================

export const ALL_INVOCATIONS: EldritchInvocation[] = [
  ...EB_INVOCATIONS,
  ...AT_WILL_INVOCATIONS,
  ...PASSIVE_INVOCATIONS,
  ...PACT_BOON_INVOCATIONS,
];

/**
 * Get invocations available at a given warlock level
 */
export function getAvailableInvocations(warlockLevel: number): EldritchInvocation[] {
  return ALL_INVOCATIONS.filter(inv => warlockLevel >= inv.levelRequirement);
}

/**
 * Get invocations by category
 */
export function getInvocationsByCategory(category: InvocationCategory): EldritchInvocation[] {
  return ALL_INVOCATIONS.filter(inv => inv.category === category);
}

/**
 * Get the maximum number of invocations a warlock can know
 */
export function getMaxInvocations(warlockLevel: number): number {
  if (warlockLevel < 2) return 0;
  if (warlockLevel < 5) return 2;
  if (warlockLevel < 7) return 3;
  if (warlockLevel < 9) return 4;
  if (warlockLevel < 12) return 5;
  if (warlockLevel < 15) return 6;
  if (warlockLevel < 18) return 7;
  return 8;
}

/**
 * Check if an invocation's prerequisites are met
 */
export function meetsPrerequisite(invocation: EldritchInvocation, context: {
  hasEldritchBlast: boolean;
  pactBoon?: string | null;
  hasHex?: boolean;
}): boolean {
  if (!invocation.prerequisite) return true;
  
  const prereq = invocation.prerequisite.toLowerCase();
  
  if (prereq.includes('eldritch blast')) return context.hasEldritchBlast;
  if (prereq.includes('pact of the blade')) return context.pactBoon === 'blade';
  if (prereq.includes('pact of the tome')) return context.pactBoon === 'tome';
  if (prereq.includes('pact of the chain')) return context.pactBoon === 'chain';
  if (prereq.includes('hex')) return context.hasHex ?? false;
  
  return true; // Unknown prerequisite, allow selection
}

/**
 * Category display configuration
 */
export const INVOCATION_CATEGORY_CONFIG: Record<InvocationCategory, { label: string; color: string; icon: string }> = {
  eldritch_blast: { label: 'Eldritch Blast', color: 'text-purple-400', icon: 'Zap' },
  at_will_spell: { label: 'At-Will Spells', color: 'text-blue-400', icon: 'Wand2' },
  passive: { label: 'Passive', color: 'text-amber-400', icon: 'Shield' },
  pact_boon: { label: 'Pact Boon', color: 'text-emerald-400', icon: 'Gem' },
};
