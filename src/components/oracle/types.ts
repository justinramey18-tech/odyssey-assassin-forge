export type Personality = 'thunderhead' | 'jarvis' | 'deadpool' | 'gandalf' | 'jarlaxle' | 'investigator';

export type OracleMode = 'chat' | 'plan' | 'choice' | 'analyze' | 'quick';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  personality?: Personality;
  mode?: OracleMode;
}

export interface OracleModeConfig {
  id: OracleMode;
  name: string;
  icon: string;
  description: string;
  color: string;
  quickPrompts: string[];
}

export interface CharacterContext {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  deity?: string;
  domain?: string;
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
  // Loot inventory context
  loot?: {
    items: Array<{
      name: string;
      category: string;
      rarity: string;
      goldValue: number;
      hasDiceMechanics: boolean;
    }>;
    totalValue: number;
    usableCount: number;
    diceMechanicsCount: number;
  };
  // Combat context - real-time tactical awareness
  combat?: {
    isInCombat: boolean;
    roundNumber: number;
    isPlayerTurn: boolean;
    // Action economy
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;
    maxMovement: number;
    // Current target
    currentTarget: {
      name: string;
      ac: number;
      currentHP: number;
      maxHP: number;
      conditions: string[];
      resistances: string[];
      vulnerabilities: string[];
      immunities: string[];
    } | null;
    // Active enemies
    enemies: Array<{
      name: string;
      currentHP: number;
      maxHP: number;
      isDefeated: boolean;
      conditions: string[];
    }>;
    // Recent combat log entries (last 5)
    recentActions: Array<{
      actionType: string;
      actionName: string;
      timestamp: string;
      damage?: string;
      wasHit?: boolean;
      wasCrit?: boolean;
    }>;
  };
  // Party members context
  partyMembers?: Array<{
    name: string;
    level?: number;
    className?: string;
    currentHP?: number;
    maxHP?: number;
    ac?: number;
    conditions?: string[];
  }>;
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
