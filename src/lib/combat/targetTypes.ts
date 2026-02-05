// Target/Enemy Type Definitions for Combat Tracker

/**
 * Represents an enemy/target in combat
 */
export interface Enemy {
  id: string;
  name: string;
  currentHP: number;
  maxHP: number;
  ac: number;
  notes?: string;
  createdAt: number;
}

/**
 * Input for creating a new enemy
 */
export interface NewEnemyInput {
  name: string;
  maxHP: number;
  ac: number;
  notes?: string;
}

/**
 * Target info formatted for AI DM prompts
 */
export interface TargetPromptInfo {
  name: string;
  ac: number;
  currentHP: number;
  maxHP: number;
  notes?: string;
}

/**
 * Quick presets for common enemy types
 */
export const ENEMY_PRESETS = {
  minion: { label: 'Minion', hp: 10, ac: 10 },
  standard: { label: 'Standard', hp: 30, ac: 13 },
  elite: { label: 'Elite', hp: 60, ac: 16 },
  boss: { label: 'Boss', hp: 120, ac: 18 },
} as const;

export type EnemyPresetKey = keyof typeof ENEMY_PRESETS;

/**
 * Calculate health status description based on HP percentage
 */
export function getHealthStatus(currentHP: number, maxHP: number): {
  label: string;
  color: string;
  narrative: string;
} {
  if (maxHP <= 0) {
    return { label: 'Unknown', color: 'text-muted-foreground', narrative: 'status unknown' };
  }
  
  const percent = (currentHP / maxHP) * 100;
  
  if (percent <= 0) {
    return { 
      label: 'Defeated', 
      color: 'text-slate-500', 
      narrative: 'lies defeated on the ground' 
    };
  }
  if (percent <= 25) {
    return { 
      label: 'Near Death', 
      color: 'text-red-500', 
      narrative: 'staggers on the brink of collapse, barely standing' 
    };
  }
  if (percent <= 50) {
    return { 
      label: 'Bloodied', 
      color: 'text-orange-500', 
      narrative: 'is visibly wounded and bloodied, fighting with desperation' 
    };
  }
  if (percent <= 75) {
    return { 
      label: 'Wounded', 
      color: 'text-amber-500', 
      narrative: 'shows signs of damage but remains a threat' 
    };
  }
  return { 
    label: 'Healthy', 
    color: 'text-green-500', 
    narrative: 'appears fresh and ready for combat' 
  };
}

/**
 * Maximum number of enemies allowed in tracker
 */
export const MAX_ENEMIES = 10;

/**
 * localStorage key for targets
 */
export const TARGETS_STORAGE_KEY = 'dnd-combat-targets';
