// Target/Enemy Type Definitions for Combat Tracker

import { 
  CreatureType, 
  CreatureSize, 
  DamageType, 
  EnemyCondition,
  CREATURE_TYPE_LABELS,
  CREATURE_SIZE_LABELS,
} from './creatureTypes';

// Re-export for convenience
export type { CreatureType, CreatureSize, DamageType, EnemyCondition };

/**
 * Damage history entry for tracking
 */
export interface DamageHistoryEntry {
  id: string;
  amount: number;
  type: 'damage' | 'healing';
  damageType?: DamageType;
  source?: string;
  timestamp: number;
}

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
  
  // Enhanced fields
  creatureType?: CreatureType;
  size?: CreatureSize;
  initiative?: number;
  conditions: EnemyCondition[];
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  damageHistory: DamageHistoryEntry[];
  
  // Template/source tracking
  isTemplate?: boolean;
  sourceSessionId?: string;
}

/**
 * Input for creating a new enemy
 */
export interface NewEnemyInput {
  name: string;
  maxHP: number;
  ac: number;
  notes?: string;
  creatureType?: CreatureType;
  size?: CreatureSize;
  initiative?: number;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
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
  creatureType?: CreatureType;
  size?: CreatureSize;
  conditions?: EnemyCondition[];
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
}

/**
 * Quick presets for common enemy types
 */
export const ENEMY_PRESETS = {
  minion: { label: 'Minion', hp: 10, ac: 10, size: 'small' as CreatureSize, type: 'humanoid' as CreatureType },
  standard: { label: 'Standard', hp: 30, ac: 13, size: 'medium' as CreatureSize, type: 'humanoid' as CreatureType },
  elite: { label: 'Elite', hp: 60, ac: 16, size: 'medium' as CreatureSize, type: 'humanoid' as CreatureType },
  boss: { label: 'Boss', hp: 120, ac: 18, size: 'large' as CreatureSize, type: 'monstrosity' as CreatureType },
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
 * Format creature type and size for display
 */
export function formatCreatureTypeSize(type?: CreatureType, size?: CreatureSize): string {
  if (!type && !size) return '';
  const typeLabel = type ? CREATURE_TYPE_LABELS[type] : '';
  const sizeLabel = size ? CREATURE_SIZE_LABELS[size] : '';
  if (typeLabel && sizeLabel) return `${sizeLabel} ${typeLabel}`;
  return typeLabel || sizeLabel;
}

/**
 * Format conditions for prompt
 */
export function formatConditionsForPrompt(conditions: EnemyCondition[]): string {
  if (!conditions.length) return '';
  return conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
}

/**
 * Format resistances/vulnerabilities for prompt
 */
export function formatDamageModifiers(
  resistances: DamageType[],
  vulnerabilities: DamageType[],
  immunities: DamageType[]
): string {
  const parts: string[] = [];
  if (resistances.length) parts.push(`Resistant: ${resistances.join(', ')}`);
  if (vulnerabilities.length) parts.push(`Vulnerable: ${vulnerabilities.join(', ')}`);
  if (immunities.length) parts.push(`Immune: ${immunities.join(', ')}`);
  return parts.join(' | ');
}

/**
 * Maximum number of enemies allowed in tracker
 */
export const MAX_ENEMIES = 10;

/**
 * localStorage key for targets
 */
export const TARGETS_STORAGE_KEY = 'dnd-combat-targets';
