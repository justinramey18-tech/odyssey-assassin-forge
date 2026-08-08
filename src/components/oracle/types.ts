export type Personality = 'thunderhead' | 'jarvis' | 'deadpool' | 'gandalf' | 'jarlaxle' | 'investigator';

export type OracleMode = 'chat' | 'plan' | 'choice' | 'analyze' | 'quick' | 'recap' | 'quest';

export interface Whisper {
  type: 'action' | 'tactics' | 'whisper';
  target?: string;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  personality?: Personality;
  mode?: OracleMode;
  whispers?: Whisper[];
  senderName?: string; // NPC name when voicing an NPC, undefined for normal DM messages
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
  gender?: string;
  race?: string;
  backstory?: string;
  relationships?: Array<{ name: string; disposition: string; notes?: string }>;
  currentHP: number;
  maxHP: number;
  /** Live XP progression so the DM never guesses level-up thresholds */
  progression?: {
    mode: 'xp' | 'milestone';
    currentXP?: number;
    xpForNextLevel?: number;
    xpRemaining?: number;
    xpLevelFloor?: number;
    xpIntoLevel?: number;
    xpLevelSpan?: number;
    pace?: string;
  };
  /** Primary class identity (e.g. 'rogue', 'wizard') */
  characterClass?: string;
  /** Multiclass breakdown: e.g. { rogue: 7, warlock: 3 } — only present if multiclassed */
  multiclassBreakdown?: Record<string, number>;
  /** Subclass identity: e.g. 'Circle of the Moon', 'Life Domain', 'The Fiend' */
  subclass?: string;
  deity?: string;
  domain?: string;
  abilities: Array<{
    name: string;
    tier: number;
    tree: string;
    /** active or passive */
    type?: string;
    /** action, bonus_action, reaction, passive, etc. */
    actionType?: string;
    /** at_will, per_short_rest, per_long_rest, etc. */
    usageType?: string;
    /** Rules text for the tier the character currently has. The model has never
     *  seen these abilities, so without this it is guessing. */
    effect?: string;
    /** Dice for the current tier, e.g. "2d6" */
    dice?: string;
    /** Cooldown in minutes, 0 or undefined means none */
    cooldownMinutes?: number;
    /** Which weapon the ability uses, for homebrew abilities */
    attackType?: string;
    /** True for player-created abilities */
    isHomebrew?: boolean;
    /** True for built-in abilities the player has modified */
    isCustomized?: boolean;
  }>;
  equippedAbilities: string[];
  equipment: Array<{ slot: string; name: string; rarity: string }>;
  activeSetBonuses: string[];
  consumables: Array<{ name: string; quantity: number; type: string; effect?: string }>;
  cooldowns: {
    active: Array<{ name: string; remainingSeconds: number }>;
    ready: string[];
  };
  prestigeLevel: number;
  prestigeAbilities: string[];
  // Defenses (AC, temp HP, initiative) for the DM and the solo sheet
  defenses?: {
    armorClass: number;
    tempHP: number;
    initiativeBonus: number;
  };
  // Proficiencies (skills, saves, expertise) for the DM and the solo sheet
  proficiencies?: {
    bonus: number;
    skills: string[];
    saves: string[];
    expertise: string[];
  };
  /** Current gold. Without this the DM can award and deduct coin but never knows the balance. */
  gold?: number;
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
    /** Full stat blocks for player-created spells. The model has never seen these,
     *  so the name alone is not enough for it to run them. */
    homebrewSpells?: Array<{
      name: string;
      level: number;
      school: string;
      castingTime: string;
      range: string;
      duration: string;
      concentration: boolean;
      ritual: boolean;
      description: string;
      higherLevels?: string;
      attackType?: string;
      saveStat?: string;
      damageType?: string;
      damageFormula?: string;
      healingFormula?: string;
      verbal: boolean;
      somatic: boolean;
      material?: string;
      /** False when the character has no slot high enough to cast it yet */
      castable?: boolean;
    }>;
  };
  // Loot inventory context
  loot?: {
    items: Array<{
      name: string;
      category: string;
      rarity: string;
      goldValue: number;
      hasDiceMechanics: boolean;
      description?: string;
      effect?: string;
      dice?: string;
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
    race?: string;
    gender?: string;
    multiclassLevels?: Record<string, number>;
    abilityScores?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    equippedAbilities?: string[];
    preparedSpells?: string[];
    spellSlots?: Array<{ level: number; current: number; max: number }>;
  }>;
  // Companion (Geralt the owlbear) context — momo only
  companion?: {
    name: string;
    currentHP: number;
    maxHP: number;
    conditions: string[];
    mood: string;
    abilities: { str: number; dex: number; con: number; wis: number; int: number; cha: number };
    attacks: Array<{ name: string; bonus: string; damage: string; desc: string }>;
  };
  // Wild Shape state
  wildShape?: {
    isTransformed: boolean;
    formName: string | null;
    formHP: number;
    formMaxHP: number;
    formAC: number | null;
    formCR: number | null;
    usesRemaining: number;
    maxUses: number;
  };
  // Campaign narrative summary for contextual awareness
  campaignSummary?: string;
  // Recent DM narrative messages for immediate context
  recentNarrative?: Array<{ role: string; name?: string; content: string }>;
  // GM Guides content (host-enabled lore/rules)
  gmGuidesContent?: string;
  // Memory Anchors — long-term campaign facts (NPCs, locations, quests, secrets)
  memoryAnchors?: string;
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
