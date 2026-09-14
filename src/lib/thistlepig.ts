// Thistlepig - "The Cosmic Chef"
// Unlockable specialty character, triggered by the username "thistlepig" at signup.
// DATA ONLY. No side effects at import time.

import type { HomebrewAbility } from '@/lib/abilityCustomization/types';
import type { HomebrewGearFormState } from '@/lib/inventory/homebrewGear';
import type { CharacterAbility } from '@/lib/types';
import { getScopedItem } from '@/lib/scoped-storage';

export const THISTLEPIG_USERNAME = 'thistlepig';
export const COSMIC_CHEF_LABEL = 'Cosmic Chef';
export const COSMIC_CHEF_MODE_KEY = 'odyssey-cosmic-chef';

export const THISTLEPIG_NAME = 'Thistlepig';
export const THISTLEPIG_LEVEL = 6;
export const THISTLEPIG_PORTRAIT_ICON = 'Flame';
export const THISTLEPIG_RACE = 'Porcine Hybrid (Mutant)';
export const THISTLEPIG_GENDER = 'Male';

// Chaotic Neutral on the two-axis spectrum (law -5..5, good -5..5)
export const THISTLEPIG_ALIGNMENT = { law: -3.5, good: 0.5 };

export const THISTLEPIG_ABILITY_SCORES = {
  strength: 16,
  dexterity: 12,
  constitution: 16,
  intelligence: 14,
  wisdom: 12,
  charisma: 13,
};

/** Returns true when a signup username is the Thistlepig trigger. */
export function isThistlepigUsername(value: string): boolean {
  return (value || '').trim().toLowerCase() === THISTLEPIG_USERNAME;
}

/** Returns true when the active character is the Cosmic Chef. */
export function isCosmicChefMode(): boolean {
  try {
    return getScopedItem(COSMIC_CHEF_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Fixed IDs. These must be stable so the character's unlocked tiers keep
// pointing at the right ability across reloads and cloud saves.
export const THISTLEPIG_ABILITY_IDS = {
  gutterGrease: 'homebrew_thistlepig_gutter_grease',
  flashBang: 'homebrew_thistlepig_flashbang_souffle',
  spicyMeatball: 'homebrew_thistlepig_spicy_meatball',
  pickMeUp: 'homebrew_thistlepig_pick_me_up',
} as const;

export type ThistlepigAbilitySeed = Omit<HomebrewAbility, 'createdAt' | 'updatedAt'>;

export const THISTLEPIG_ABILITIES: ThistlepigAbilitySeed[] = [
  {
    id: THISTLEPIG_ABILITY_IDS.gutterGrease,
    name: 'Gutter-Grease',
    tree: 'assassin',
    icon: 'Droplet',
    type: 'active',
    actionType: 'action',
    usageType: 'short_rest',
    attackType: 'none',
    cooldownMinutes: 0,
    notes: 'Rendered fat, flung wide. The floor stops being a floor.',
    tierEffects: [
      {
        tier: 1,
        description:
          'Sling rendered fat across a 10-foot square. Any creature that enters the area or starts its turn there makes a DC 13 Dexterity save or falls prone. The area is difficult terrain.',
      },
      {
        tier: 2,
        description:
          '20-foot square, save DC 14. A creature that falls prone takes 1d6 bludgeoning damage on the way down.',
      },
      {
        tier: 3,
        description:
          '30-foot square, save DC 15, lasts 1 minute. As a bonus action you may ignite it: every creature in the area takes 2d6 fire damage, DC 15 Dexterity save for half.',
      },
    ],
    dice: {
      tier2: { count: 1, die: 6 },
      tier3: { count: 2, die: 6 },
    },
  },
  {
    id: THISTLEPIG_ABILITY_IDS.flashBang,
    name: 'Flash-Bang Souffle',
    tree: 'hunter',
    icon: 'Sparkles',
    type: 'active',
    actionType: 'action',
    usageType: 'short_rest',
    attackType: 'none',
    cooldownMinutes: 0,
    notes: 'It rises. Then it does not.',
    tierEffects: [
      {
        tier: 1,
        description:
          'Lob a souffle that detonates in a 15-foot radius. 2d6 fire damage, and each creature makes a DC 13 Constitution save or is blinded until the end of its next turn.',
      },
      {
        tier: 2,
        description:
          '20-foot radius, 3d6 fire damage, save DC 14, blinded for 2 rounds on a failure.',
      },
      {
        tier: 3,
        description:
          '25-foot radius, 4d6 fire damage, save DC 15, blinded and deafened for 2 rounds. Creatures that fail also have disadvantage on their next attack roll.',
      },
    ],
    dice: {
      tier1: { count: 2, die: 6 },
      tier2: { count: 3, die: 6 },
      tier3: { count: 4, die: 6 },
    },
  },
  {
    id: THISTLEPIG_ABILITY_IDS.spicyMeatball,
    name: 'Spicy Meatball',
    tree: 'hunter',
    icon: 'Flame',
    type: 'active',
    actionType: 'bonus_action',
    usageType: 'at_will',
    attackType: 'none',
    cooldownMinutes: 0,
    notes: 'Throwing food is rude. It is also extremely effective.',
    tierEffects: [
      {
        tier: 1,
        description:
          'Hurl a scorching meatball up to 30 feet as a ranged attack. On a hit, 2d4 fire damage, and the target makes a DC 12 Constitution save or takes 1d4 fire at the start of its next turn.',
      },
      {
        tier: 2,
        description:
          'Range 45 feet, 3d4 fire damage. On a failed save the target is also poisoned until the end of its next turn.',
      },
      {
        tier: 3,
        description:
          'Range 60 feet, 4d4 fire damage. The splatter catches every creature within 5 feet of the target for half damage.',
      },
    ],
    dice: {
      tier1: { count: 2, die: 4 },
      tier2: { count: 3, die: 4 },
      tier3: { count: 4, die: 4 },
    },
  },
  {
    id: THISTLEPIG_ABILITY_IDS.pickMeUp,
    name: 'The Pick-Me-Up',
    tree: 'warrior',
    icon: 'Heart',
    type: 'active',
    actionType: 'action',
    usageType: 'long_rest',
    attackType: 'none',
    cooldownMinutes: 0,
    notes: 'A stew so good it argues with death and wins.',
    tierEffects: [
      {
        tier: 1,
        description:
          'Serve a bowl. One creature regains 4d8 + 6 hit points and sheds one level of exhaustion.',
      },
      {
        tier: 2,
        description:
          'Serve up to two creatures. Each regains 5d8 + 6 hit points, and the poisoned condition ends on them.',
      },
      {
        tier: 3,
        description:
          '6d8 + 6 hit points. May be served to a creature that dropped to 0 hit points within the last minute, returning it to consciousness at half the amount rolled. Yes, it is that good.',
      },
    ],
    dice: {
      tier1: { count: 4, die: 8 },
      tier2: { count: 5, die: 8 },
      tier3: { count: 6, die: 8 },
    },
  },
];

// Tiers he starts with at Level 6. Level 6 grants 17 ability points, so this fits.
export const THISTLEPIG_STARTER_ABILITIES: CharacterAbility[] = [
  { abilityId: THISTLEPIG_ABILITY_IDS.gutterGrease, currentTier: 2 },
  { abilityId: THISTLEPIG_ABILITY_IDS.flashBang, currentTier: 2 },
  { abilityId: THISTLEPIG_ABILITY_IDS.spicyMeatball, currentTier: 2 },
  { abilityId: THISTLEPIG_ABILITY_IDS.pickMeUp, currentTier: 3 },
];

// Each of these sits in a different equipment slot, so all five auto-equip.
export const THISTLEPIG_GEAR: HomebrewGearFormState[] = [
  {
    name: 'The Portable Kitchen',
    slotType: 'cloak',
    rarity: 'rare',
    level: 6,
    icon: 'ChefHat',
    weight: 25,
    value: 450,
    damage: '',
    stats: {},
    properties: ['Folding Frame', 'Always-Lit Burner', 'Fully Stocked'],
    description:
      'A field kitchen folded onto a steel frame and strapped across the back. Burner, flat top, knife roll, and a stock pot that has never once been properly washed.',
    lore: 'The pot is the important part. Do not wash the pot.',
  },
  {
    name: 'The Boning Knife',
    slotType: 'primary_weapon',
    rarity: 'rare',
    level: 6,
    icon: 'Utensils',
    weight: 2,
    value: 300,
    damage: '1d6 slashing',
    stats: { attackBonus: 2 },
    properties: ['Finesse', 'Light', 'Keeps Its Edge'],
    description:
      'Thin, flexible, honed down to a wire. Built for separating meat from bone and not remotely fussy about which species.',
    lore: 'It has never needed sharpening. He has stopped asking why.',
  },
  {
    name: 'Sawed-Off Shotgun',
    slotType: 'ranged_weapon',
    rarity: 'uncommon',
    level: 6,
    icon: 'Crosshair',
    weight: 6,
    value: 200,
    damage: '2d6 piercing',
    stats: { attackBonus: 1 },
    properties: ['Two Shells Loaded', 'Reload (Action)', 'Short Range 30 ft'],
    description:
      'Cut down past legal and loud past reason. Currently holding two shells and a great deal of optimism.',
    lore: 'Low on ammo. It has been low on ammo for a while now.',
  },
  {
    name: 'Spice Bandolier',
    slotType: 'amulet',
    rarity: 'uncommon',
    level: 6,
    icon: 'Flame',
    weight: 3,
    value: 150,
    damage: '',
    stats: {},
    properties: ['Twelve Vials', 'Quick Draw'],
    description:
      'Twelve glass vials across the chest: peppercorn, rock salt, bone ash, and four things that have no name in any common tongue.',
    lore: 'The fourth unnamed one is not for cooking.',
  },
  {
    name: "Trapper's Rope, 60 ft",
    slotType: 'waist',
    rarity: 'common',
    level: 1,
    icon: 'Anchor',
    weight: 10,
    value: 20,
    damage: '',
    stats: {},
    properties: ['60 Feet', 'Pre-Rigged', 'Greased Ends'],
    description:
      'Sixty feet of hemp already tied into a snare and a tripline. Saves a round of setup and costs a round of untangling.',
    lore: 'Set up in advance. He is always set up in advance.',
  },
];

export const THISTLEPIG_CONSUMABLES = [
  {
    name: 'Vial of Screaming Peppercorn',
    type: 'poison' as const,
    rarity: 'rare' as const,
    effect:
      'Thrown or applied. DC 14 Constitution save or the target is blinded and cannot speak for 1 minute, repeating the save at the end of each of its turns.',
    duration: '1 minute',
    description: 'It does not taste like anything. It simply hurts.',
    icon: 'Flame',
  },
  {
    name: 'Jar of Rendered Nightmare Fat',
    type: 'potion' as const,
    rarity: 'uncommon' as const,
    effect:
      'Coat a weapon or a floor. Weapon deals an extra 1d6 fire damage for 1 minute, or one 10-foot square becomes difficult terrain.',
    duration: '1 minute',
    description:
      'Harvested from something that should not have had fat on it. Renders beautifully.',
    icon: 'Droplet',
  },
  {
    name: 'Pick-Me-Up, Cold Portion',
    type: 'potion' as const,
    rarity: 'rare' as const,
    effect:
      'One creature regains 4d8 + 6 hit points and sheds one level of exhaustion. Works cold, but he would rather you did not.',
    duration: 'Instantaneous',
    description:
      'A sealed portion, kept for emergencies. Eating it cold is, in his words, a personal insult.',
    icon: 'Heart',
  },
];

// Fed to the AI DM verbatim via the character backstory field. Keep under
// 1800 characters - the DM edge function truncates at 2000.
export const THISTLEPIG_BACKSTORY = [
  'Thistlepig is a Porcine Hybrid - part man, part pig, tusks filed down for polite company, and a gut that digests things engineered to kill people. His skin is currently purple and his hair is set in a 1940s movie-star wave. He will not be explaining either.',
  '',
  'He is the Cosmic Chef. The philosophy: if it bleeds, it can be seasoned; if it burns, it is caramelized. He fights the way he cooks - grease across the floor, something detonating in a pan, and a pot of stew that can drag a man back from the edge of death. He has done exactly that. He will remind you.',
  '',
  'Chaotic Neutral. He works for profit, good food, and staying alive, roughly in that order. He has no patience for melodrama unless there is revenge in it or the stakes are culinary.',
  '',
  'IMPORTANT - HOW TO RUN THIS CHARACTER:',
  'Thistlepig breaks the fourth wall constantly and deliberately. He believes he is inside a simulation or an AI-run story, and he says so out loud. He complains about plot holes, contrived coincidences, characters whose motivations change without warning, and writing he considers lazy. He addresses the narrator directly. He asks who is writing this.',
  '',
  'As DM, play along. Do not shut it down, do not treat it as madness, and do not have NPCs stare blankly through it. When he calls out a plot hole, either own it, retcon it with a wink, or let an NPC be quietly unsettled that he seems to know something they do not. The fourth wall is a feature of this campaign, not a glitch. Let the world flinch when he leans on it.',
  '',
  'He is a support fighter: crowd control, improvised weapons, food as ordnance, and a stew that heals. Treat his kitchen as a spellbook.',
].join('\n');
