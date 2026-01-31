export type Personality = 'thunderhead' | 'jarvis' | 'deadpool';

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
