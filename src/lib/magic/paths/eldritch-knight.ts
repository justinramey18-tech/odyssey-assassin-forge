import { PathConfig } from '../types';

export const ELDRITCH_KNIGHT: PathConfig = {
  id: 'eldritch_knight',
  name: 'Eldritch Knight',
  subtitle: 'Blade-Bound Warrior',
  iconName: 'Sword',
  primaryColor: 'blue',
  accentColor: 'text-blue-400',
  glowColor: 'shadow-blue-500/50',
  spellcastingAbility: 'INT',
  spellListRestrictions: ['abjuration', 'evocation'],
  slotProgression: 'third',
  flavorText: 'Your blade is an extension of your arcane will. Through rigorous training, you\'ve learned to channel magic through your weapons.',
  features: [
    {
      id: 'weapon_bond',
      name: 'Weapon Bond',
      level: 3,
      description: 'Bond with up to two weapons. You cannot be disarmed, and can summon a bonded weapon to your hand as a bonus action.',
    },
    {
      id: 'war_magic',
      name: 'War Magic',
      level: 7,
      description: 'When you cast a cantrip, you can make one weapon attack as a bonus action.',
    },
    {
      id: 'eldritch_strike',
      name: 'Eldritch Strike',
      level: 10,
      description: 'When you hit with a weapon attack, the target has disadvantage on the next saving throw against your spells.',
    },
    {
      id: 'arcane_charge',
      name: 'Arcane Charge',
      level: 15,
      description: 'When you use Action Surge, you can teleport up to 30 feet before taking your extra action.',
    },
  ],
  oracleVoice: {
    thunderhead: 'The fusion of martial and arcane arts creates a formidable probability matrix. Your weapon bond resonance is stable at 99.2%.',
    jarvis: 'A most elegant synthesis of swordplay and sorcery, Sir. Shall I calculate optimal engagement vectors for your enhanced combat protocols?',
    deadpool: 'A magic sword guy! That\'s like... a sword guy, but with EXTRA steps. And glowy bits. I love glowy bits.',
  },
};
