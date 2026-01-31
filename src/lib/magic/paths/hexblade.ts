import { PathConfig } from '../types';

export const HEXBLADE: PathConfig = {
  id: 'hexblade',
  name: 'Hexblade',
  subtitle: 'Pact of the Blade',
  iconName: 'Skull',
  primaryColor: 'violet',
  accentColor: 'text-violet-400',
  glowColor: 'shadow-violet-500/50',
  spellcastingAbility: 'CHA',
  slotProgression: 'pact',
  flavorText: 'You\'ve forged a pact with a mysterious entity from the Shadowfell. Your patron grants you the power to curse your enemies and strike with eldritch might.',
  features: [
    {
      id: 'hexblades_curse',
      name: 'Hexblade\'s Curse',
      level: 1,
      description: 'Curse a creature: gain bonus damage, crit on 19-20, and regain HP if they die. Resets on short rest.',
    },
    {
      id: 'hex_warrior',
      name: 'Hex Warrior',
      level: 1,
      description: 'Use Charisma for weapon attacks. Gain proficiency with medium armor, shields, and martial weapons.',
    },
    {
      id: 'accursed_specter',
      name: 'Accursed Specter',
      level: 6,
      description: 'When you slay a humanoid, you can raise their spirit as a specter bound to your will.',
    },
    {
      id: 'armor_of_hexes',
      name: 'Armor of Hexes',
      level: 10,
      description: 'Roll d6 when a cursed target hits you; on 4+, the attack misses instead.',
    },
    {
      id: 'master_of_hexes',
      name: 'Master of Hexes',
      level: 14,
      description: 'When a cursed target dies, you can move the curse to another creature without expending a use.',
    },
  ],
  oracleVoice: {
    thunderhead: 'Your patron connection manifests as a 78.4% increase in combat lethality. The Shadowfell entity appears... pleased.',
    jarvis: 'Your patron appears to be in a generous mood, Sir. The eldritch energies are flowing quite smoothly today.',
    deadpool: 'Ooh, spooky patron vibes! Is it like having a really demanding magical landlord? "Pay your soul rent on time or I\'ll hex your hot water!"',
  },
};
