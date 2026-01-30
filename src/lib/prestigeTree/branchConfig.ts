// Branch Visual Configuration for Drizzt's Legacy Prestige Tree

import { LucideIcon, Swords, Cat, Eye, Zap } from 'lucide-react';
import { PrestigeBranch } from './types';

export interface BranchVisualConfig {
  id: PrestigeBranch;
  name: string;
  subtitle: string;
  icon: LucideIcon;
  primaryColor: string;       // Tailwind color (e.g., 'red-500')
  glowColor: string;          // For CSS shadows
  gradient: string;           // Background gradient
  position: 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';
}

export const BRANCH_VISUAL_CONFIG: Record<PrestigeBranch, BranchVisualConfig> = {
  dual_wielding: {
    id: 'dual_wielding',
    name: 'Dual Wielding',
    subtitle: 'Scimitar Mastery',
    icon: Swords,
    primaryColor: 'red-500',
    glowColor: '#EF4444',
    gradient: 'from-red-900/40 to-amber-900/20',
    position: 'upper-left',
  },
  guenhwyvar: {
    id: 'guenhwyvar',
    name: 'Guenhwyvar',
    subtitle: 'Astral Companion',
    icon: Cat,
    primaryColor: 'teal-500',
    glowColor: '#14B8A6',
    gradient: 'from-teal-900/40 to-slate-900/20',
    position: 'upper-right',
  },
  drow_abilities: {
    id: 'drow_abilities',
    name: 'Drow Abilities',
    subtitle: 'Shadow Magic',
    icon: Eye,
    primaryColor: 'violet-500',
    glowColor: '#8B5CF6',
    gradient: 'from-violet-900/40 to-black/40',
    position: 'lower-left',
  },
  monk_abilities: {
    id: 'monk_abilities',
    name: 'Monk Abilities',
    subtitle: 'Spiritual Discipline',
    icon: Zap,
    primaryColor: 'amber-500',
    glowColor: '#FBBF24',
    gradient: 'from-amber-900/40 to-slate-800/20',
    position: 'lower-right',
  },
};

// Central node config for Drizzt portrait
export const DRIZZT_CENTRAL_NODE = {
  name: "Drizzt Do'Urden",
  title: 'Legendary Ranger of Icewind Dale',
  primaryColor: 'purple-600',
  glowColor: '#7C3AED',
  gradient: 'from-purple-900/60 to-black/80',
};

// Branch order for navigation
export const BRANCH_ORDER: PrestigeBranch[] = [
  'dual_wielding', 
  'guenhwyvar', 
  'drow_abilities', 
  'monk_abilities'
];
