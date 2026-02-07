import { BuildConfig } from './types';
import { getAbilityPointsForLevel } from '@/lib/types';
import { calculateMaxHP } from '@/lib/hpCalculation';

/**
 * Default Odyssey Assassin build configuration
 * This is the original hardcoded configuration extracted into a data object
 */
export const ODYSSEY_ASSASSIN_CONFIG: BuildConfig = {
  version: 1,
  
  identity: {
    className: 'Odyssey Assassin',
    classSubtitle: 'ASSASSIN',
    defaultCharacterName: 'Unnamed Assassin',
    appTitle: 'Odyssey Assassin',
    classDescription: 'A custom D&D 5e Assassin class with extensive homebrew abilities, legendary gear, and prestige progression.',
  },
  
  trees: [
    {
      id: 'hunter',
      name: 'Hunter',
      subtitle: 'Ranged & Awareness',
      iconName: 'Target',
      colors: { primary: 'hunter', glow: 'hunter-glow', dim: 'hunter-dim' },
    },
    {
      id: 'warrior',
      name: 'Warrior',
      subtitle: 'Melee & Defense',
      iconName: 'Swords',
      colors: { primary: 'warrior', glow: 'warrior-glow', dim: 'warrior-dim' },
    },
    {
      id: 'assassin',
      name: 'Assassin',
      subtitle: 'Stealth & Crits',
      iconName: 'Eye',
      colors: { primary: 'assassin', glow: 'assassin-glow', dim: 'assassin-dim' },
    },
  ],
  
  prestige: {
    treeName: "Drizzt's Legacy",
    centralNode: {
      name: "Drizzt Do'Urden",
      title: 'Legendary Ranger of Icewind Dale',
    },
    branches: [
      { id: 'dual_wielding', name: 'Dual Wielding', subtitle: 'Scimitar Mastery', iconName: 'Swords', primaryColor: 'red-500', glowColor: '#EF4444' },
      { id: 'guenhwyvar', name: 'Guenhwyvar', subtitle: 'Astral Companion', iconName: 'Cat', primaryColor: 'teal-500', glowColor: '#14B8A6' },
      { id: 'drow_abilities', name: 'Drow Abilities', subtitle: 'Shadow Magic', iconName: 'Eye', primaryColor: 'violet-500', glowColor: '#8B5CF6' },
      { id: 'monk_abilities', name: 'Monk Abilities', subtitle: 'Spiritual Discipline', iconName: 'Zap', primaryColor: 'amber-500', glowColor: '#FBBF24' },
    ],
  },
  
  progression: {
    hitDie: 'd8',
    hitDieMax: 8,
    hitDieAvg: 5,
    maxLevel: 20,
    getAbilityPointsForLevel,
    calculateMaxHP,
  },
  
  aiPrompts: {
    personalityArchetype: 'Deadpool-inspired anti-hero',
    personalityTraits: [
      'Fourth-Wall Awareness',
      'Inappropriate Humor',
      'Mercenary Pragmatism',
      'Pop Culture References',
      'Genre Savvy',
    ],
    exampleQuips: [
      "Is it just me, or did that guy look like he was about to monologue?",
      "Ooh, a critical hit! That's gonna leave a mark. And by mark, I mean corpse.",
    ],
  },
};
