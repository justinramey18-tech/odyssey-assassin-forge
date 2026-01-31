import { SpellSchool, SchoolVisualConfig } from './types';

// ============================================
// SPELL SCHOOL VISUAL CONFIGURATIONS
// ============================================

export const SCHOOL_CONFIGS: Record<SpellSchool, SchoolVisualConfig> = {
  abjuration: {
    school: 'abjuration',
    name: 'Abjuration',
    color: 'text-blue-400',
    bgGradient: 'from-blue-600/30 to-blue-900/20',
    iconName: 'Shield',
    animationClass: 'animate-pulse',
  },
  conjuration: {
    school: 'conjuration',
    name: 'Conjuration',
    color: 'text-teal-400',
    bgGradient: 'from-teal-600/30 to-teal-900/20',
    iconName: 'Sparkles',
    animationClass: 'animate-spin-slow',
  },
  divination: {
    school: 'divination',
    name: 'Divination',
    color: 'text-violet-400',
    bgGradient: 'from-violet-600/30 to-violet-900/20',
    iconName: 'Eye',
    animationClass: 'animate-glow-pulse',
  },
  enchantment: {
    school: 'enchantment',
    name: 'Enchantment',
    color: 'text-pink-400',
    bgGradient: 'from-pink-600/30 to-pink-900/20',
    iconName: 'Heart',
    animationClass: 'animate-pulse',
  },
  evocation: {
    school: 'evocation',
    name: 'Evocation',
    color: 'text-orange-400',
    bgGradient: 'from-orange-600/30 to-red-900/20',
    iconName: 'Flame',
    animationClass: 'animate-flicker',
  },
  illusion: {
    school: 'illusion',
    name: 'Illusion',
    color: 'text-slate-300',
    bgGradient: 'from-slate-500/30 to-slate-800/20',
    iconName: 'Ghost',
    animationClass: 'animate-shimmer',
  },
  necromancy: {
    school: 'necromancy',
    name: 'Necromancy',
    color: 'text-green-400',
    bgGradient: 'from-green-800/30 to-black/30',
    iconName: 'Skull',
    animationClass: 'animate-pulse',
  },
  transmutation: {
    school: 'transmutation',
    name: 'Transmutation',
    color: 'text-amber-400',
    bgGradient: 'from-amber-600/30 to-amber-900/20',
    iconName: 'FlaskConical',
    animationClass: 'animate-glow-pulse',
  },
};

export function getSchoolConfig(school: SpellSchool): SchoolVisualConfig {
  return SCHOOL_CONFIGS[school];
}

export function getSchoolColor(school: SpellSchool): string {
  return SCHOOL_CONFIGS[school].color;
}

export function getSchoolIcon(school: SpellSchool): string {
  return SCHOOL_CONFIGS[school].iconName;
}
