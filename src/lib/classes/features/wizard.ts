// Wizard Class Features
// D&D 5e Wizard - Intelligence-based arcane caster

import { ClassFeature } from './types';

export const WIZARD_FEATURES: ClassFeature[] = [
  {
    id: 'wizard-spellcasting',
    classId: 'wizard',
    name: 'Spellcasting',
    level: 1,
    description: 'You can cast wizard spells using Intelligence as your spellcasting ability. You prepare spells from your spellbook each day.',
    mechanicalEffect: 'INT-based prepared spellcasting',
    isSubclassFeature: false,
    iconName: 'BookOpen',
  },
  {
    id: 'wizard-arcane-recovery',
    classId: 'wizard',
    name: 'Arcane Recovery',
    level: 1,
    description: 'Once per day during a short rest, you can recover expended spell slots with a combined level equal to or less than half your wizard level (rounded up).',
    mechanicalEffect: 'Short rest: recover spell slots ≤ half level',
    usageType: 'long_rest',
    uses: 1,
    isSubclassFeature: false,
    iconName: 'RotateCcw',
  },
  {
    id: 'wizard-arcane-tradition',
    classId: 'wizard',
    name: 'Arcane Tradition',
    level: 2,
    description: 'Choose an arcane tradition that shapes your magical practice: School of Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, or Transmutation.',
    mechanicalEffect: 'Subclass selection',
    isSubclassFeature: true,
    iconName: 'Sparkles',
  },
  {
    id: 'wizard-spell-mastery',
    classId: 'wizard',
    name: 'Spell Mastery',
    level: 18,
    description: 'Choose a 1st-level and a 2nd-level wizard spell. You can cast them at their lowest level without expending a spell slot.',
    mechanicalEffect: 'At-will casting of one 1st and one 2nd level spell',
    usageType: 'at_will',
    isSubclassFeature: false,
    iconName: 'Infinity',
  },
  {
    id: 'wizard-signature-spells',
    classId: 'wizard',
    name: 'Signature Spells',
    level: 20,
    description: 'Choose two 3rd-level wizard spells as signature spells. You always have them prepared and can cast each once without a slot, regaining this ability on a short or long rest.',
    mechanicalEffect: 'Two 3rd-level spells: always prepared, 1 free cast each',
    usageType: 'short_rest',
    uses: 2,
    isSubclassFeature: false,
    iconName: 'PenTool',
  },
];

/**
 * Calculate max spell slot levels recoverable via Arcane Recovery
 */
export function getArcaneRecoverySlots(wizardLevel: number): number {
  return Math.ceil(wizardLevel / 2);
}
