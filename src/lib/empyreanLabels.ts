// Empyrean Mode Label Translations
// When the app is in "empyrean" mode, D&D labels swap to Fourth Wing / dragon rider labels.
// This file is the SINGLE SOURCE OF TRUTH for all label mappings.

import { getScopedItem } from '@/lib/scoped-storage';

const MODE_KEY = 'odyssey-app-mode';

/** Returns true when the user has selected "empyrean" as their app mode */
export function isEmpyreanMode(): boolean {
  try {
    return getScopedItem(MODE_KEY) === 'empyrean';
  } catch {
    return false;
  }
}

// ── Ability Score Labels ──────────────────────────────────────────────────

export const EMPYREAN_ABILITY_LABELS: Record<string, { abbr: string; label: string }> = {
  strength:     { abbr: 'BODY',      label: 'Body' },
  dexterity:    { abbr: 'AGI',       label: 'Agility' },
  constitution: { abbr: 'GRIT',      label: 'Grit' },
  intelligence: { abbr: 'INT',       label: 'Intellect' },
  wisdom:       { abbr: 'INST',      label: 'Instinct' },
  charisma:     { abbr: 'WILL',      label: 'Willpower' },
};

export const EMPYREAN_ABILITY_ABBR: Record<string, { abbr: string; name: string }> = {
  str: { abbr: 'BODY', name: 'Body' },
  dex: { abbr: 'AGI',  name: 'Agility' },
  con: { abbr: 'GRIT', name: 'Grit' },
  int: { abbr: 'INT',  name: 'Intellect' },
  wis: { abbr: 'INST', name: 'Instinct' },
  cha: { abbr: 'WILL', name: 'Willpower' },
};

// ── Saving Throw Labels ──────────────────────────────────────────────────

export const EMPYREAN_SAVE_LABELS: Record<string, string> = {
  strength:     'Body Save',
  dexterity:    'Agility Save',
  constitution: 'Grit Save',
  intelligence: 'Focus Save',
  wisdom:       'Instinct Save',
  charisma:     'Willpower Save',
};

// ── Skill Labels ─────────────────────────────────────────────────────────

export const EMPYREAN_SKILL_LABELS: Record<string, string> = {
  acrobatics:      'Aerial Combat',
  animal_handling: 'Dragon Empathy',
  arcana:          'Signet Theory',
  athletics:       'Flight Endurance',
  deception:       'Deception',
  history:         'Military History',
  insight:         'Insight',
  intimidation:    'Intimidation',
  investigation:   'The Codex',
  medicine:        'Field Medicine',
  nature:          'Dragon Lore',
  perception:      'Awareness',
  performance:     'Morale',
  persuasion:      'Command',
  religion:        'Venin Knowledge',
  sleight_of_hand: 'Rune Crafting',
  stealth:         'Shadow Work',
  survival:        'Survival Tactics',
};

// ── Skill Ability Overrides (some skills change which ability they use) ──

export const EMPYREAN_SKILL_ABILITY_OVERRIDES: Record<string, string> = {
  athletics:       'con',  // Flight Endurance uses GRIT not STR
  arcana:          'int',  // same
  animal_handling: 'cha',  // Dragon Empathy uses WILLPOWER not WIS
  deception:       'int',  // uses INTELLECT not CHA
  medicine:        'int',  // Field Medicine uses INTELLECT not WIS
  sleight_of_hand: 'int',  // Rune Crafting uses INTELLECT not DEX
  persuasion:      'cha',  // Command uses WILLPOWER (same underlying key)
  performance:     'cha',  // Morale uses WILLPOWER (same underlying key)
};

// ── Combat Stat Labels ───────────────────────────────────────────────────

export const EMPYREAN_COMBAT_LABELS: Record<string, string> = {
  ac:              'Defense',
  hp:              'Vitality',
  initiative:      'Combat Reflexes',
  spellAttack:     'Signet Attack',
  spellSaveDC:     'Signet Save DC',
  spellSlots:      'Signet Power',
  hitPoints:       'Vitality',
  armorClass:      'Defense',
};

// ── Spell / Signet Labels ────────────────────────────────────────────────

export const EMPYREAN_SPELL_LABELS: Record<string, string> = {
  cantrip:      'Minor Signet Use',
  '1st':        'Moderate Signet Use',
  '2nd':        'Moderate Signet Use',
  '3rd':        'Major Signet Use',
  '4th':        'Major Signet Use',
  '5th':        'Major Signet Use',
  '6th':        'Extreme Signet Use',
  '7th':        'Extreme Signet Use',
  '8th':        'Extreme Signet Use',
  '9th':        'Extreme Signet Use',
};

export const EMPYREAN_SCHOOL_LABELS: Record<string, string> = {
  evocation:      'Elemental Wielding',
  abjuration:     'Shielding',
  transmutation:  'Physical Enhancement',
  divination:     'Farsight',
  enchantment:    'Mental Influence',
  illusion:       'Shadow Wielding',
  conjuration:    'Distance Wielding',
  necromancy:     'Forbidden Arts',
};

// ── Class Labels ─────────────────────────────────────────────────────────

export const EMPYREAN_CLASS_LABELS: Record<string, string> = {
  rogue:    'Shadow Operative',
  wizard:   'Arcane Wielder',
  sorcerer: 'Natural Prodigy',
  warlock:  'Venin-Touched',
  cleric:   'Battle Medic',
  druid:    'Beast Speaker',
  bard:     'Rebel Coordinator',
  fighter:  'Weaponmaster',
  paladin:  'Dragon Champion',
  ranger:   'Scout Rider',
  barbarian:'Berserker Rider',
  monk:     'Martial Adept',
};

// ── Equipment Labels ─────────────────────────────────────────────────────

export const EMPYREAN_EQUIPMENT_LABELS: Record<string, string> = {
  'Leather Armor':   "Rider's Leathers",
  'Studded Leather': 'Reinforced Leathers',
  'Scale Mail':      'Dragon Scale Vest',
  'Longsword':       'Standard Sword',
  'Shortsword':      "Rider's Blade",
  'Healing Potion':  'Healing Draught',
};

// ── Generic helper: get label with empyrean override ─────────────────────

/**
 * Returns the empyrean label if in empyrean mode, otherwise the default.
 * Usage: getLabel(EMPYREAN_SKILL_LABELS, 'arcana', 'Arcana')
 */
export function getLabel(map: Record<string, string>, key: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return map[key] ?? fallback;
}

/**
 * Returns the empyrean ability abbreviation if in empyrean mode.
 * Usage: getAbilityAbbr('str', 'STR') => 'BODY' in empyrean, 'STR' otherwise
 */
export function getAbilityAbbr(key: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return EMPYREAN_ABILITY_ABBR[key]?.abbr ?? fallback;
}

/**
 * Returns the empyrean ability full name if in empyrean mode.
 * Usage: getAbilityName('str', 'Strength') => 'Body' in empyrean
 */
export function getAbilityName(key: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return EMPYREAN_ABILITY_ABBR[key]?.name ?? fallback;
}

/**
 * Returns the empyrean skill name if in empyrean mode.
 */
export function getSkillName(skillId: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return EMPYREAN_SKILL_LABELS[skillId] ?? fallback;
}

/**
 * Returns the empyrean combat label if in empyrean mode.
 */
export function getCombatLabel(key: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return EMPYREAN_COMBAT_LABELS[key] ?? fallback;
}

/**
 * Returns the empyrean class name if in empyrean mode.
 */
export function getClassName(classId: string, fallback: string): string {
  if (!isEmpyreanMode()) return fallback;
  return EMPYREAN_CLASS_LABELS[classId] ?? fallback;
}
