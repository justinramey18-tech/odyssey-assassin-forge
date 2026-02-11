import { LucideIcon, Home, Swords, Backpack, Wrench, Crosshair, Zap, Wand2, Crown, FlaskConical, Sparkles, Trophy, BookOpen, Search, Cloud, Settings, Store } from 'lucide-react';

export type MainCategory = 'home' | 'fighting' | 'inventory' | 'utility';

export interface SubTabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
}

export interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
}

export const CATEGORY_CONFIG: Record<MainCategory, CategoryConfig> = {
  home: {
    label: 'Home',
    icon: Home,
    color: 'green',
    glowColor: 'bg-green-400',
  },
  fighting: {
    label: 'Fighting',
    icon: Swords,
    color: 'red',
    glowColor: 'bg-red-400',
  },
  inventory: {
    label: 'Inventory',
    icon: Backpack,
    color: 'amber',
    glowColor: 'bg-amber-400',
  },
  utility: {
    label: 'Utility',
    icon: Wrench,
    color: 'cyan',
    glowColor: 'bg-cyan-400',
  },
};

export const FIGHTING_TABS: SubTabConfig[] = [
  { id: 'combat', label: 'Combat', icon: Crosshair, color: 'text-red-400', glowColor: 'bg-red-400' },
  { id: 'skills', label: 'Skills', icon: Swords, color: 'text-red-400', glowColor: 'bg-red-400' },
  { id: 'abilities', label: 'Abilities', icon: Zap, color: 'text-violet-400', glowColor: 'bg-violet-400' },
  { id: 'arcana', label: 'Arcana', icon: Wand2, color: 'text-indigo-400', glowColor: 'bg-indigo-400' },
  { id: 'legacy', label: 'Legacy', icon: Crown, color: 'text-purple-400', glowColor: 'bg-purple-400' },
];

export const INVENTORY_TABS: SubTabConfig[] = [
  { id: 'consumables', label: 'Consumables', icon: FlaskConical, color: 'text-emerald-400', glowColor: 'bg-emerald-400' },
  { id: 'shop', label: 'Shop', icon: Store, color: 'text-yellow-400', glowColor: 'bg-yellow-400' },
  { id: 'loot', label: 'Loot', icon: Backpack, color: 'text-purple-400', glowColor: 'bg-purple-400' },
  { id: 'gear', label: 'Gear', icon: Backpack, color: 'text-amber-400', glowColor: 'bg-amber-400' },
  { id: 'stars', label: 'Stars', icon: Sparkles, color: 'text-cyan-400', glowColor: 'bg-cyan-400' },
  { id: 'feats', label: 'Feats', icon: Trophy, color: 'text-purple-400', glowColor: 'bg-purple-400' },
];

export const UTILITY_TABS: SubTabConfig[] = [
  { id: 'scribe', label: 'Scribe', icon: BookOpen, color: 'text-amber-400', glowColor: 'bg-amber-400' },
  { id: 'chronicle', label: 'Chronicle', icon: Search, color: 'text-blue-400', glowColor: 'bg-blue-400' },
  { id: 'cloud', label: 'Cloud', icon: Cloud, color: 'text-sky-400', glowColor: 'bg-sky-400' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400', glowColor: 'bg-slate-400' },
];

export function getSubTabsForCategory(category: MainCategory): SubTabConfig[] {
  switch (category) {
    case 'fighting':
      return FIGHTING_TABS;
    case 'inventory':
      return INVENTORY_TABS;
    case 'utility':
      return UTILITY_TABS;
    default:
      return [];
  }
}

// Mapping for HomeScreen navigation cards
export type NavigableTab = 'combat' | 'skills' | 'abilities' | 'arcana' | 'legacy' | 'consumables' | 'shop' | 'loot' | 'gear' | 'stars' | 'feats' | 'scribe' | 'chronicle' | 'cloud' | 'settings';

export function getTabToCategoryMapping(tab: NavigableTab): { category: MainCategory; subTab: string } {
  // Fighting category tabs
  if (['combat', 'skills', 'abilities', 'arcana', 'legacy'].includes(tab)) {
    return { category: 'fighting', subTab: tab };
  }
  // Inventory category tabs
  if (['consumables', 'shop', 'loot', 'gear', 'stars', 'feats'].includes(tab)) {
    return { category: 'inventory', subTab: tab };
  }
  // Utility category tabs
  if (['scribe', 'chronicle', 'cloud', 'settings'].includes(tab)) {
    return { category: 'utility', subTab: tab };
  }
  // Default
  return { category: 'fighting', subTab: 'combat' };
}
