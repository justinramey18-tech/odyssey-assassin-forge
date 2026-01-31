import { PathConfig } from '../types';

export const SHADOW_BLADE: PathConfig = {
  id: 'shadow_blade',
  name: 'Shadow Blade',
  subtitle: 'Shadowfell Assassin',
  iconName: 'Moon',
  primaryColor: 'purple',
  accentColor: 'text-purple-400',
  glowColor: 'shadow-purple-500/50',
  spellcastingAbility: 'CHA',
  spellListRestrictions: ['necromancy', 'illusion'],
  slotProgression: 'half',
  flavorText: 'The shadows have become your ally. You\'ve touched the Shadowfell and returned with dark gifts that let you step between worlds.',
  features: [
    {
      id: 'shadow_step',
      name: 'Shadow Step',
      level: 3,
      description: 'As a bonus action, teleport up to 60 feet to an unoccupied space in dim light or darkness. Gain advantage on your next attack.',
    },
    {
      id: 'umbral_sight',
      name: 'Umbral Sight',
      level: 6,
      description: 'Gain 120 feet of darkvision. While in darkness, you are invisible to creatures relying on darkvision to see you.',
    },
    {
      id: 'shadow_blade_conjure',
      name: 'Shadow Blade Mastery',
      level: 11,
      description: 'Your Shadow Blade deals additional necrotic damage equal to your Charisma modifier.',
    },
    {
      id: 'shadowfell_passage',
      name: 'Shadowfell Passage',
      level: 17,
      description: 'Once per long rest, teleport up to 500 feet through the Shadowfell, bringing up to 5 willing creatures.',
    },
  ],
  oracleVoice: {
    thunderhead: 'The Shadowfell connection registers clearly in my sensors. Your ability to manipulate darkness is... fascinating to observe.',
    jarvis: 'Your shadow manipulation capabilities are quite impressive, Sir. Though I must say, the darkness does make thermal readings rather challenging.',
    deadpool: 'Edgy shadow powers? Check. Teleporting through darkness? Check. Looking cool while doing it? MEGA CHECK. You\'re basically discount Nightcrawler.',
  },
};
