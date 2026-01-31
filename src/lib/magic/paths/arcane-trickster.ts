import { PathConfig } from '../types';

export const ARCANE_TRICKSTER: PathConfig = {
  id: 'arcane_trickster',
  name: 'Arcane Trickster',
  subtitle: 'Master of Mischief & Magic',
  iconName: 'Wand2',
  primaryColor: 'emerald',
  accentColor: 'text-emerald-400',
  glowColor: 'shadow-emerald-500/50',
  spellcastingAbility: 'INT',
  spellListRestrictions: ['enchantment', 'illusion'],
  slotProgression: 'third',
  flavorText: 'You\'ve learned to weave magic into your roguish talents, specializing in spells that deceive, distract, and outwit.',
  features: [
    {
      id: 'mage_hand_legerdemain',
      name: 'Mage Hand Legerdemain',
      level: 3,
      description: 'Your invisible mage hand can stow objects, pick locks, disarm traps, and plant items on others undetected.',
    },
    {
      id: 'magical_ambush',
      name: 'Magical Ambush',
      level: 9,
      description: 'If you are hidden when you cast a spell, targets have disadvantage on saving throws against it.',
    },
    {
      id: 'versatile_trickster',
      name: 'Versatile Trickster',
      level: 13,
      description: 'Use your mage hand to distract a creature, giving you advantage on attack rolls against it.',
    },
    {
      id: 'spell_thief',
      name: 'Spell Thief',
      level: 17,
      description: 'When a creature casts a spell targeting you, you can steal the spell and cast it yourself.',
    },
  ],
  oracleVoice: {
    thunderhead: 'Your mastery of arcane deception approaches statistical perfection. I calculate a 94.7% probability that your illusions will succeed.',
    jarvis: 'Might I suggest employing your considerable talents for misdirection, Sir? The magical arts do complement your... unconventional skill set.',
    deadpool: 'Ooh, magic tricks! Can you pull a rabbit out of a hat? No? How about pulling an enemy\'s confidence out of their soul? That works too.',
  },
};
