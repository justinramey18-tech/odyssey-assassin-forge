// Prestige Skill Tree Types
// Drizzt's Legacy - Post-endgame progression system

export type PrestigeBranch = 
  | 'dual_wielding' 
  | 'guenhwyvar' 
  | 'drow_abilities' 
  | 'monk_abilities';

export interface PrestigeAbility {
  id: string;
  name: string;
  branch: PrestigeBranch;
  tier: 1 | 2 | 3;           // Foundation, Intermediate, Advanced
  prestigeCost: number;       // 2-12 prestige points
  minimumPrestigeLevel?: number;
  prerequisites: string[];    // IDs of required abilities
  description: string;
  aiPrompt: string;          // Copyable narrative prompt
  mechanicalContext: string; // DM-facing mechanics (in brackets)
  effects: {
    mechanicalBonus?: string;
    cooldown?: string;
    saveDC?: number;
    duration?: string;
  };
  icon: string;              // Lucide icon name
}

// Serializable structure (no Maps - JSON compatible)
export interface PrestigeTreeProgress {
  unlockedAbilities: string[];              // Array of unlocked ability IDs
  spentPrestigePoints: number;              // Points spent on tree
  unlockTimestamps: Record<string, number>; // Unix timestamps as object
}

export const DEFAULT_PRESTIGE_TREE_PROGRESS: PrestigeTreeProgress = {
  unlockedAbilities: [],
  spentPrestigePoints: 0,
  unlockTimestamps: {},
};

// Helper for runtime usage (converts to Set for O(1) lookups)
export interface PrestigeTreeState {
  unlockedAbilities: Set<string>;
  unlockTimestamps: Map<string, Date>;
}

export function deserializeProgress(data: PrestigeTreeProgress): PrestigeTreeState {
  return {
    unlockedAbilities: new Set(data.unlockedAbilities),
    unlockTimestamps: new Map(
      Object.entries(data.unlockTimestamps).map(([id, ts]) => [id, new Date(ts)])
    ),
  };
}

export function serializeProgress(
  unlockedAbilities: Set<string>, 
  unlockTimestamps: Map<string, Date>,
  spentPrestigePoints: number
): PrestigeTreeProgress {
  return {
    unlockedAbilities: Array.from(unlockedAbilities),
    spentPrestigePoints,
    unlockTimestamps: Object.fromEntries(
      Array.from(unlockTimestamps.entries()).map(([id, date]) => [id, date.getTime()])
    ),
  };
}

// Required base ability points to unlock Drizzt's Legacy
export const LEGACY_UNLOCK_THRESHOLD = 72; // 24 abilities × 3 tiers

// Tier-based requirements
export const TIER_REQUIREMENTS = {
  1: { minPrestigeLevel: 0, costRange: [2, 3] as const },
  2: { minPrestigeLevel: 5, costRange: [4, 6] as const },
  3: { minPrestigeLevel: 8, costRange: [8, 12] as const },
} as const;

// High-tier gates for capstone abilities
export const HIGH_TIER_GATES: Record<string, number> = {
  'legacy_of_lolth': 15,     // Dual Wielding capstone
  'avatar_panther': 12,      // Guenhwyvar capstone
  'drow_lord_authority': 15, // Drow capstone
  'perfect_consciousness': 12, // Monk capstone
};
