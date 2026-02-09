import { LucideIcon } from 'lucide-react';

// ============================================
// MAGIC PATH TYPES
// ============================================

export type MagicPath = 'arcane_trickster' | 'shadow_blade' | 'eldritch_knight' | 'hexblade';

export type SpellSchool = 
  | 'abjuration' 
  | 'conjuration' 
  | 'divination' 
  | 'enchantment' 
  | 'evocation' 
  | 'illusion' 
  | 'necromancy' 
  | 'transmutation';

export type SpellcastingAbility = 'INT' | 'CHA' | 'WIS';

export type SlotProgression = 'third' | 'half' | 'pact';

export type CastingTime = 'action' | 'bonus_action' | 'reaction' | 'ritual' | '1_minute' | '10_minutes';

export type AttackType = 'melee' | 'ranged' | 'save' | 'auto';

export type SaveStat = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

// ============================================
// PATH CONFIGURATION
// ============================================

export interface PathFeature {
  id: string;
  name: string;
  level: number;
  description: string;
}

export interface PathConfig {
  id: MagicPath;
  name: string;
  subtitle: string;
  iconName: string; // Lucide icon name
  primaryColor: string; // Tailwind color class
  accentColor: string;
  glowColor: string;
  spellcastingAbility: SpellcastingAbility;
  spellListRestrictions?: SpellSchool[];
  slotProgression: SlotProgression;
  features: PathFeature[];
  flavorText: string;
  oracleVoice: {
    thunderhead: string;
    jarvis: string;
    deadpool: string;
  };
}

// ============================================
// SPELL DEFINITION
// ============================================

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material?: string;
  materialConsumed?: boolean;
  materialCost?: number; // in gold pieces
}

export interface SpellDefinition {
  id: string;
  name: string;
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // 0 = cantrip, up to 9th for full casters
  school: SpellSchool;
  castingTime: CastingTime;
  range: string;
  components: SpellComponents;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels?: string; // Upcast effect
  attackType?: AttackType;
  saveStat?: SaveStat;
  damageType?: string;
  damageFormula?: string; // e.g., "1d10" or "3d8"
  healingFormula?: string;
  iconName: string; // Lucide icon name
  pathRestrictions?: MagicPath[]; // Only these paths can learn this spell (Rogue MagicPath system)
  classes?: DnDClass[]; // Which D&D classes can learn this spell (class-based spellcasting)
  personalityQuips: {
    thunderhead: string;
    jarvis: string;
    deadpool: string;
  };
}

// Import DnDClass for the classes field
import { DnDClass } from '@/lib/classes/types';

// ============================================
// SPELL SLOT TRACKING
// ============================================

export interface SpellSlotLevel {
  current: number;
  max: number;
}

export interface PactSlots {
  current: number;
  max: number;
  level: number; // What level the pact slots cast at
}

// ============================================
// MATERIAL COMPONENT INVENTORY
// ============================================

export interface MaterialComponent {
  id: string;
  name: string;
  cost: number; // in gold pieces
  consumedOnUse: boolean;
  description: string;
}

// ============================================
// SPELLCASTING STATE
// ============================================

export interface SpellcastingState {
  // Path selection
  path: MagicPath | null;
  pathUnlocked: boolean;
  
  // Spell management
  knownSpells: string[]; // Spell IDs
  preparedSpells: string[]; // Subset of known (for prepared casters)
  favoriteSpells: string[]; // Pinned for quick access
  
  // Slot tracking (levels 1-4 for half-casters)
  spellSlots: Record<number, SpellSlotLevel>;
  
  // Warlock-style pact slots (separate tracking)
  pactSlots?: PactSlots;
  
  // Spellcasting modifiers (derived from character stats)
  spellcastingAbility: SpellcastingAbility;
  abilityModifier: number; // e.g., +3 for 16 INT
  proficiencyBonus: number;
  
  // Material components inventory
  materialComponents: Record<string, number>; // Component ID -> quantity
  focusEquipped: boolean; // Arcane focus bypasses non-consumed materials
  
  // Concentration tracking
  concentratingOn: string | null; // Spell ID
  concentrationStartTime?: number; // Timestamp for duration tracking
  
  // Ritual casting
  ritualCastingActive: boolean;
  
  // Statistics
  spellsCastToday: number;
  totalSpellsCast: number;
}

// ============================================
// SPELL SCHOOL VISUAL CONFIG
// ============================================

export interface SchoolVisualConfig {
  school: SpellSchool;
  name: string;
  color: string;
  bgGradient: string;
  iconName: string;
  animationClass: string;
}

// ============================================
// SPELL CAST EVENT
// ============================================

export interface SpellCastEvent {
  spell: SpellDefinition;
  castLevel: number;
  path: MagicPath;
  isRitual: boolean;
  isUpcast: boolean;
  slotUsed: boolean;
  characterName: string;
  timestamp: number;
}

// ============================================
// PREPARATION CALCULATION
// ============================================

export interface PreparationLimits {
  cantripsKnown: number;
  spellsKnown: number; // For known-spell casters
  spellsPrepared: number; // For prepared casters
  maxSpellLevel: number;
}

// ============================================
// SLOT PROGRESSION TABLES
// ============================================

// Third-caster progression (Arcane Trickster, Eldritch Knight)
export const THIRD_CASTER_SLOTS: Record<number, Record<number, number>> = {
  // Character Level -> { Spell Level -> Slots }
  1: {},
  2: {},
  3: { 1: 2 },
  4: { 1: 3 },
  5: { 1: 3 },
  6: { 1: 3 },
  7: { 1: 4, 2: 2 },
  8: { 1: 4, 2: 2 },
  9: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 },
  11: { 1: 4, 2: 3 },
  12: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 },
  14: { 1: 4, 2: 3, 3: 2 },
  15: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 },
  17: { 1: 4, 2: 3, 3: 3 },
  18: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

// Half-caster progression (Ranger, Paladin style - for Shadow Blade)
export const HALF_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1: {},
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 },
  6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3 },
  9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

// Warlock-style pact magic progression
export const PACT_CASTER_SLOTS: Record<number, { slots: number; level: number }> = {
  1: { slots: 1, level: 1 },
  2: { slots: 2, level: 1 },
  3: { slots: 2, level: 2 },
  4: { slots: 2, level: 2 },
  5: { slots: 2, level: 3 },
  6: { slots: 2, level: 3 },
  7: { slots: 2, level: 4 },
  8: { slots: 2, level: 4 },
  9: { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getSpellAttackBonus(abilityMod: number, profBonus: number): number {
  return abilityMod + profBonus;
}

export function getSpellSaveDC(abilityMod: number, profBonus: number): number {
  return 8 + abilityMod + profBonus;
}

export function getSlotsForLevel(
  characterLevel: number,
  progression: SlotProgression
): Record<number, SpellSlotLevel> {
  const slots: Record<number, SpellSlotLevel> = {};
  
  let table: Record<number, Record<number, number>>;
  
  switch (progression) {
    case 'third':
      table = THIRD_CASTER_SLOTS;
      break;
    case 'half':
      table = HALF_CASTER_SLOTS;
      break;
    case 'pact':
      // Pact casters use a different system
      return slots;
    default:
      return slots;
  }
  
  const levelSlots = table[characterLevel] || {};
  
  for (const [level, max] of Object.entries(levelSlots)) {
    slots[parseInt(level)] = { current: max, max };
  }
  
  return slots;
}

export function getPactSlotsForLevel(characterLevel: number): PactSlots | undefined {
  const pactData = PACT_CASTER_SLOTS[characterLevel];
  if (!pactData) return undefined;
  
  return {
    current: pactData.slots,
    max: pactData.slots,
    level: pactData.level,
  };
}

export function getMaxSpellLevel(characterLevel: number, progression: SlotProgression): number {
  if (progression === 'pact') {
    return PACT_CASTER_SLOTS[characterLevel]?.level || 0;
  }
  
  const table = progression === 'third' ? THIRD_CASTER_SLOTS : HALF_CASTER_SLOTS;
  const slots = table[characterLevel] || {};
  
  const levels = Object.keys(slots).map(Number);
  return Math.max(0, ...levels);
}
