import { Target, Swords, Eye, LucideIcon } from 'lucide-react';
import { AbilityTree } from '@/lib/types';

export interface TreeVisualConfig {
  primary: string;      // Tailwind color class (e.g., 'hunter')
  glow: string;         // Glow variant
  dim: string;          // Dim variant
  icon: LucideIcon;     // Tree icon component
  name: string;         // Display name
  subtitle: string;     // Tree description
  gradient: string;     // Background gradient classes
  borderActive: string; // Active border color
}

export const TREE_VISUAL_CONFIG: Record<AbilityTree, TreeVisualConfig> = {
  hunter: {
    primary: 'hunter',
    glow: 'hunter-glow',
    dim: 'hunter-dim',
    icon: Target,
    name: 'Hunter',
    subtitle: 'Ranged & Awareness',
    gradient: 'from-hunter/20 via-transparent to-transparent',
    borderActive: 'border-hunter',
  },
  warrior: {
    primary: 'warrior',
    glow: 'warrior-glow',
    dim: 'warrior-dim',
    icon: Swords,
    name: 'Warrior',
    subtitle: 'Melee & Defense',
    gradient: 'from-warrior/20 via-transparent to-transparent',
    borderActive: 'border-warrior',
  },
  assassin: {
    primary: 'assassin',
    glow: 'assassin-glow',
    dim: 'assassin-dim',
    icon: Eye,
    name: 'Assassin',
    subtitle: 'Stealth & Crits',
    gradient: 'from-assassin/20 via-transparent to-transparent',
    borderActive: 'border-assassin',
  },
};

// Get tree-specific CSS variable color
export function getTreeColor(tree: AbilityTree, variant: 'primary' | 'glow' | 'dim' = 'primary'): string {
  const config = TREE_VISUAL_CONFIG[tree];
  switch (variant) {
    case 'glow':
      return `hsl(var(--${config.glow}))`;
    case 'dim':
      return `hsl(var(--${config.dim}))`;
    default:
      return `hsl(var(--${config.primary}))`;
  }
}

// Get tree-specific Tailwind text color class
export function getTreeTextClass(tree: AbilityTree): string {
  return `text-${TREE_VISUAL_CONFIG[tree].primary}`;
}

// Get tree-specific Tailwind background class
export function getTreeBgClass(tree: AbilityTree, opacity: number = 100): string {
  if (opacity === 100) {
    return `bg-${TREE_VISUAL_CONFIG[tree].primary}`;
  }
  return `bg-${TREE_VISUAL_CONFIG[tree].primary}/${opacity}`;
}
