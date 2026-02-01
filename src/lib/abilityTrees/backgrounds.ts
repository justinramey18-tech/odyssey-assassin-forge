// Skill Tree Background Images Configuration

import { AbilityTree } from '@/lib/types';

// Import background images
import hunterBackground from '@/assets/trees/hunter-tree-mobile.jpg';
import warriorBackground from '@/assets/trees/warrior-tree-mobile.jpg';
import assassinBackground from '@/assets/trees/assassin-tree-mobile.jpg';

export interface TreeBackgroundConfig {
  mobile: string;
  desktop?: string;
  fallbackGradient: string;
}

export const TREE_BACKGROUNDS: Record<AbilityTree, TreeBackgroundConfig> = {
  hunter: {
    mobile: hunterBackground,
    fallbackGradient: 'linear-gradient(180deg, hsl(160 30% 8%) 0%, hsl(160 20% 4%) 100%)',
  },
  warrior: {
    mobile: warriorBackground,
    fallbackGradient: 'linear-gradient(180deg, hsl(0 30% 10%) 0%, hsl(0 20% 5%) 100%)',
  },
  assassin: {
    mobile: assassinBackground,
    fallbackGradient: 'linear-gradient(180deg, hsl(270 30% 10%) 0%, hsl(270 20% 5%) 100%)',
  },
};

/**
 * Get the background image URL for a tree
 */
export function getTreeBackground(tree: AbilityTree): string {
  return TREE_BACKGROUNDS[tree].mobile;
}

/**
 * Get the fallback gradient for a tree (used while image loads)
 */
export function getTreeFallbackGradient(tree: AbilityTree): string {
  return TREE_BACKGROUNDS[tree].fallbackGradient;
}
