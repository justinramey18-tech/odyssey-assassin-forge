// Spell Customization Types
// Custom homebrew spells that integrate into the existing spell system

import { SpellDefinition, SpellSchool, CastingTime, AttackType, SaveStat } from '@/lib/magic/types';
import { DnDClass } from '@/lib/classes/types';

/**
 * A homebrew spell created by the player.
 * Extends SpellDefinition so it can be used anywhere a standard spell is used.
 */
export interface HomebrewSpell extends SpellDefinition {
  isHomebrew: true;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  aiGenerated?: boolean;
}

/**
 * State for spell customization, persisted to localStorage
 */
export interface SpellCustomizationState {
  homebrewSpells: HomebrewSpell[];
  version: number;
}

/**
 * Default empty state
 */
export const DEFAULT_SPELL_CUSTOMIZATION_STATE: SpellCustomizationState = {
  homebrewSpells: [],
  version: 1,
};

/**
 * Spell school display info
 */
export const SPELL_SCHOOL_OPTIONS: { value: SpellSchool; label: string }[] = [
  { value: 'abjuration', label: 'Abjuration' },
  { value: 'conjuration', label: 'Conjuration' },
  { value: 'divination', label: 'Divination' },
  { value: 'enchantment', label: 'Enchantment' },
  { value: 'evocation', label: 'Evocation' },
  { value: 'illusion', label: 'Illusion' },
  { value: 'necromancy', label: 'Necromancy' },
  { value: 'transmutation', label: 'Transmutation' },
];

export const SPELL_LEVEL_OPTIONS = [
  { value: 0, label: 'Cantrip' },
  { value: 1, label: '1st Level' },
  { value: 2, label: '2nd Level' },
  { value: 3, label: '3rd Level' },
  { value: 4, label: '4th Level' },
  { value: 5, label: '5th Level' },
  { value: 6, label: '6th Level' },
  { value: 7, label: '7th Level' },
  { value: 8, label: '8th Level' },
  { value: 9, label: '9th Level' },
] as const;

export const CASTING_TIME_OPTIONS: { value: CastingTime; label: string }[] = [
  { value: 'action', label: '1 Action' },
  { value: 'bonus_action', label: '1 Bonus Action' },
  { value: 'reaction', label: '1 Reaction' },
  { value: 'ritual', label: '10 Minutes (Ritual)' },
  { value: '1_minute', label: '1 Minute' },
  { value: '10_minutes', label: '10 Minutes' },
];

export const DAMAGE_TYPE_OPTIONS = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant',
  'slashing', 'thunder',
] as const;

export const SPELL_ICON_OPTIONS = [
  'Flame', 'Snowflake', 'Zap', 'Wind', 'Droplet', 'Sparkles',
  'Star', 'Moon', 'Sun', 'Skull', 'Heart', 'Shield',
  'Eye', 'Wand', 'Ghost', 'Leaf', 'Mountain', 'Waves',
  'CloudLightning', 'Swords', 'Target', 'Hand', 'Brain', 'Gem',
] as const;
