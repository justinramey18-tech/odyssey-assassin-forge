export type Personality = 'thunderhead' | 'jarvis' | 'deadpool' | 'gandalf' | 'jarlaxle' | 'investigator';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  personality?: Personality;
}

export interface CharacterContext {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  abilities: Array<{ name: string; tier: number; tree: string }>;
  equippedAbilities: string[];
  equipment: Array<{ slot: string; name: string; rarity: string }>;
  activeSetBonuses: string[];
  consumables: Array<{ name: string; quantity: number; type: string }>;
  cooldowns: {
    active: Array<{ name: string; remainingSeconds: number }>;
    ready: string[];
  };
  prestigeLevel: number;
  prestigeAbilities: string[];
  // Ability Scores
  abilityScores?: {
    strength: { base: number; modifier: number; final: number };
    dexterity: { base: number; modifier: number; final: number };
    constitution: { base: number; modifier: number; final: number };
    intelligence: { base: number; modifier: number; final: number };
    wisdom: { base: number; modifier: number; final: number };
    charisma: { base: number; modifier: number; final: number };
  };
  // Condition tracking
  activeConditions?: Array<{
    name: string;
    remainingRounds: number;
    source?: string;
    severity: string;
    saveType?: string;
  }>;
  activeBuffs?: Array<{
    name: string;
    remainingMinutes: number;
    concentration: boolean;
  }>;
  // Spellcasting context
  spellcasting?: {
    path: string | null;
    spellAttackBonus: number;
    spellSaveDC: number;
    totalSlotsRemaining: number;
    concentratingOn: string | null;
    preparedSpells: string[];
    slots: Array<{ level: number; current: number; max: number }>;
    pactSlots?: { current: number; max: number; level: number };
  };
}

export interface PersonalityConfig {
  id: Personality;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  quickPrompts: string[];
}
