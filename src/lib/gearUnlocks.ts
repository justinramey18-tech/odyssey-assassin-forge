/**
 * Gear Unlock Configuration
 * Maps each gear piece to its required feat and progress threshold
 */

import { Achievement, achievementCategories, AchievementPrerequisite } from './achievements';

export interface GearUnlockMapping {
  itemId: string;
  itemName: string;
  setId: string;
  achievementId: string;
  achievementName: string;
  requiredValue: number;
  maxValue: number;
}

// Complete mapping of all 8 legendary sets (40 pieces total)
export const gearUnlockMappings: GearUnlockMapping[] = [
  // SET 1: THE MERC WITH A MOUTH'S REGALIA
  {
    itemId: 'mask-perpetual-commentary',
    itemName: 'Mask of Perpetual Commentary',
    setId: 'merc-with-mouth',
    achievementId: 'distract-enemies',
    achievementName: 'Distracting Enemies with Dialogue',
    requiredValue: 20,
    maxValue: 100,
  },
  {
    itemId: 'cuirass-regenerative-nonsense',
    itemName: 'Cuirass of Regenerative Nonsense',
    setId: 'merc-with-mouth',
    achievementId: 'survive-zero-hp',
    achievementName: 'Surviving After Being Reduced to 0 HP',
    requiredValue: 10,
    maxValue: 50,
  },
  {
    itemId: 'gauntlets-gratuitous-violence',
    itemName: 'Gauntlets of Gratuitous Violence',
    setId: 'merc-with-mouth',
    achievementId: 'overkill-strikes',
    achievementName: 'Overkill Strikes on Low-Health Enemies',
    requiredValue: 50,
    maxValue: 100,
  },
  {
    itemId: 'belt-infinite-pouches',
    itemName: 'Belt of Infinite Pouches',
    setId: 'merc-with-mouth',
    achievementId: 'collect-items',
    achievementName: 'Collecting Unique Items',
    requiredValue: 100,
    maxValue: 200,
  },
  {
    itemId: 'greaves-inexplicable-acrobatics',
    itemName: 'Greaves of Inexplicable Acrobatics',
    setId: 'merc-with-mouth',
    achievementId: 'successful-leaps',
    achievementName: 'Performing Successful Leaps',
    requiredValue: 50,
    maxValue: 100,
  },
  // Weapons for Set 1 (no prerequisites - always accessible)
  {
    itemId: 'katana-meta-awareness',
    itemName: 'Katana of Meta-Awareness',
    setId: 'merc-with-mouth',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'pistol-anachronistic-mayhem',
    itemName: 'Pistol of Anachronistic Mayhem',
    setId: 'merc-with-mouth',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'bow-self-aware-arrows',
    itemName: 'Bow of Self-Aware Arrows',
    setId: 'merc-with-mouth',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 2: ARSENAL OF CHAOTIC CONTRACTS
  {
    itemId: 'cowl-constant-quipping',
    itemName: 'Cowl of Constant Quipping',
    setId: 'chaotic-contracts',
    achievementId: 'post-kill-oneliners',
    achievementName: 'Delivering Post-Kill One-Liners',
    requiredValue: 100,
    maxValue: 200,
  },
  {
    itemId: 'armor-questionable-sponsorships',
    itemName: 'Armor of Questionable Sponsorships',
    setId: 'chaotic-contracts',
    achievementId: 'faction-quests',
    achievementName: 'Completing Side Quests for Factions',
    requiredValue: 20,
    maxValue: 50,
  },
  {
    itemId: 'bracers-excessive-reloading',
    itemName: 'Bracers of Excessive Reloading',
    setId: 'chaotic-contracts',
    achievementId: 'shots-no-miss',
    achievementName: 'Firing Shots Without Missing',
    requiredValue: 500,
    maxValue: 1000,
  },
  {
    itemId: 'sash-taco-trucks',
    itemName: 'Sash of Taco Trucks',
    setId: 'chaotic-contracts',
    achievementId: 'food-in-combat',
    achievementName: 'Consuming Food During Combat',
    requiredValue: 30,
    maxValue: 50,
  },
  {
    itemId: 'boots-inappropriate-timing',
    itemName: 'Boots of Inappropriate Timing',
    setId: 'chaotic-contracts',
    achievementId: 'arrive-late',
    achievementName: 'Arriving Late to Battles',
    requiredValue: 25,
    maxValue: 50,
  },
  // Weapons for Set 2
  {
    itemId: 'dual-swords-self-referential',
    itemName: 'Dual Swords of Self-Referential Humor',
    setId: 'chaotic-contracts',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'grenade-questionable-legality',
    itemName: 'Grenade of Questionable Legality',
    setId: 'chaotic-contracts',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'crossbow-improbable-trick-shots',
    itemName: 'Crossbow of Improbable Trick Shots',
    setId: 'chaotic-contracts',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 3: REGALIA OF REGENERATIVE RIDICULOUSNESS
  {
    itemId: 'helmet-scarred-memories',
    itemName: 'Helmet of Scarred Memories',
    setId: 'regenerative-ridiculousness',
    achievementId: 'fail-wisdom-save',
    achievementName: 'Failing Wisdom Saving Throws',
    requiredValue: 10,
    maxValue: 30,
  },
  {
    itemId: 'plate-persistent-healing',
    itemName: 'Plate of Persistent Healing',
    setId: 'regenerative-ridiculousness',
    achievementId: 'zero-to-full',
    achievementName: 'Healing from 0 to Full HP',
    requiredValue: 3,
    maxValue: 20,
  },
  {
    itemId: 'gauntlets-gratuitous-gestures',
    itemName: 'Gauntlets of Gratuitous Gestures',
    setId: 'regenerative-ridiculousness',
    achievementId: 'nonverbal-combat',
    achievementName: 'Using Non-Verbal Communication',
    requiredValue: 30,
    maxValue: 50,
  },
  {
    itemId: 'belt-holsters',
    itemName: 'Belt of Holsters',
    setId: 'regenerative-ridiculousness',
    achievementId: 'quick-draw-attack',
    achievementName: 'Drawing Weapons and Attacking Quickly',
    requiredValue: 50,
    maxValue: 100,
  },
  {
    itemId: 'greaves-unstoppable-momentum',
    itemName: 'Greaves of Unstoppable Momentum',
    setId: 'regenerative-ridiculousness',
    achievementId: 'dash-action',
    achievementName: 'Using Dash Action',
    requiredValue: 100,
    maxValue: 200,
  },
  // Weapons for Set 3
  {
    itemId: 'katanas-slice-dice',
    itemName: 'Katanas of Slice and Dice',
    setId: 'regenerative-ridiculousness',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'pistols-punchline-delivery',
    itemName: 'Pistols of Punchline Delivery',
    setId: 'regenerative-ridiculousness',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'rocket-launcher-reasonable',
    itemName: 'Rocket Launcher of Reasonable Response',
    setId: 'regenerative-ridiculousness',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 4: THE MERCENARY'S SELF-AWARE ARSENAL
  {
    itemId: 'mask-medium-awareness',
    itemName: 'Mask of Medium Awareness',
    setId: 'self-aware-arsenal',
    achievementId: 'predict-plot',
    achievementName: 'Predicting Plot Twists',
    requiredValue: 3,
    maxValue: 10,
  },
  {
    itemId: 'breastplate-breaking-tension',
    itemName: 'Breastplate of Breaking Tension',
    setId: 'self-aware-arsenal',
    achievementId: 'survive-meant-lose',
    achievementName: 'Surviving Meant-to-Lose Encounters',
    requiredValue: 5,
    maxValue: 20,
  },
  {
    itemId: 'vambraces-violence-escalation',
    itemName: 'Vambraces of Violence Escalation',
    setId: 'self-aware-arsenal',
    achievementId: 'recognize-tropes',
    achievementName: 'Recognizing Narrative Tropes',
    requiredValue: 10,
    maxValue: 30,
  },
  {
    itemId: 'belt-budget-constraints',
    itemName: 'Belt of Budget Constraints',
    setId: 'self-aware-arsenal',
    achievementId: 'reverse-situations',
    achievementName: 'Reversing Situations with Improbable Actions',
    requiredValue: 5,
    maxValue: 20,
  },
  {
    itemId: 'boots-sequel-hooks',
    itemName: 'Boots of Sequel Hooks',
    setId: 'self-aware-arsenal',
    achievementId: 'hidden-paths',
    achievementName: 'Discovering Hidden Paths',
    requiredValue: 10,
    maxValue: 30,
  },
  // Weapons for Set 4
  {
    itemId: 'blade-borrowed-references',
    itemName: 'Blade of Borrowed References',
    setId: 'self-aware-arsenal',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'gun-genre-confusion',
    itemName: 'Gun of Genre Confusion',
    setId: 'self-aware-arsenal',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'explosive-uncertain-origin',
    itemName: 'Explosive of Uncertain Origin',
    setId: 'self-aware-arsenal',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 5: VESTMENTS OF VIOLENT COMEDY
  {
    itemId: 'crown-conscious-incompetence',
    itemName: 'Crown of Conscious Incompetence',
    setId: 'violent-comedy',
    achievementId: 'humor-defuse',
    achievementName: 'Defusing Tension with Humor',
    requiredValue: 20,
    maxValue: 50,
  },
  {
    itemId: 'armor-acceptable-losses',
    itemName: 'Armor of Acceptable Losses',
    setId: 'violent-comedy',
    achievementId: 'minor-injuries',
    achievementName: 'Enduring Battles with Minor Injuries',
    requiredValue: 30,
    maxValue: 100,
  },
  {
    itemId: 'gloves-gratuitous-gestures',
    itemName: 'Gloves of Gratuitous Gestures',
    setId: 'violent-comedy',
    achievementId: 'combat-flourishes',
    achievementName: 'Performing Unnecessary Combat Flourishes',
    requiredValue: 50,
    maxValue: 100,
  },
  {
    itemId: 'sash-snack-storage',
    itemName: 'Sash of Snack Storage',
    setId: 'violent-comedy',
    achievementId: 'share-food-enemies',
    achievementName: 'Sharing Food with Enemies',
    requiredValue: 10,
    maxValue: 30,
  },
  {
    itemId: 'pants-improbable-pockets',
    itemName: 'Pants of Improbable Pockets',
    setId: 'violent-comedy',
    achievementId: 'lucky-items',
    achievementName: 'Finding Useful Items Against Odds',
    requiredValue: 20,
    maxValue: 50,
  },
  // Weapons for Set 5
  {
    itemId: 'swords-surgical-sarcasm',
    itemName: 'Swords of Surgical Sarcasm',
    setId: 'violent-comedy',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'firearms-flexible-legality',
    itemName: 'Firearms of Flexible Legality',
    setId: 'violent-comedy',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'throwing-whatever-handy',
    itemName: 'Throwing Whatever\'s Handy',
    setId: 'violent-comedy',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 6: THE UNKILLABLE MERC'S LOADOUT
  {
    itemId: 'helm-helpful-hallucinations',
    itemName: 'Helm of Helpful Hallucinations',
    setId: 'unkillable-merc',
    achievementId: 'survive-lethal',
    achievementName: 'Surviving Lethal Damage',
    requiredValue: 15,
    maxValue: 40,
  },
  {
    itemId: 'cuirass-continuous-carnage',
    itemName: 'Cuirass of Continuous Carnage',
    setId: 'unkillable-merc',
    achievementId: 'come-back-death',
    achievementName: 'Coming Back from Death',
    requiredValue: 5,
    maxValue: 15,
  },
  {
    itemId: 'bracers-boundary-breaking',
    itemName: 'Bracers of Boundary Breaking',
    setId: 'unkillable-merc',
    achievementId: 'counterattack-hit',
    achievementName: 'Counterattacking After Being Hit',
    requiredValue: 75,
    maxValue: 150,
  },
  {
    itemId: 'belt-unnecessary-buckles',
    itemName: 'Belt of Unnecessary Buckles',
    setId: 'unkillable-merc',
    achievementId: 'reverse-time',
    achievementName: 'Reversing Time or Outcomes',
    requiredValue: 3,
    maxValue: 10,
  },
  {
    itemId: 'greaves-gravity-defiance',
    itemName: 'Greaves of Gravity Defiance',
    setId: 'unkillable-merc',
    achievementId: 'avoid-area-effects',
    achievementName: 'Avoiding Area Effects',
    requiredValue: 40,
    maxValue: 80,
  },
  // Weapons for Set 6
  {
    itemId: 'katanas-killing-jokes',
    itemName: 'Katanas of Killing Jokes',
    setId: 'unkillable-merc',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'guns-gratuitous-firepower',
    itemName: 'Guns of Gratuitous Firepower',
    setId: 'unkillable-merc',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'launcher-disproportionate-response',
    itemName: 'Launcher of Disproportionate Response',
    setId: 'unkillable-merc',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 7: ARSENAL OF ABSOLUTE ABSURDITY
  {
    itemId: 'mask-mixed-messages',
    itemName: 'Mask of Mixed Messages',
    setId: 'absolute-absurdity',
    achievementId: 'break-fourth-wall',
    achievementName: 'Breaking the Fourth Wall',
    requiredValue: 25,
    maxValue: 50,
  },
  {
    itemId: 'breastplate-borrowed-time',
    itemName: 'Breastplate of Borrowed Time',
    setId: 'absolute-absurdity',
    achievementId: 'befriend-enemies',
    achievementName: 'Befriending Enemies',
    requiredValue: 15,
    maxValue: 40,
  },
  {
    itemId: 'gauntlets-gratuitous-gore',
    itemName: 'Gauntlets of Gratuitous Gore',
    setId: 'absolute-absurdity',
    achievementId: 'defeat-with-words',
    achievementName: 'Defeating Enemies with Words Alone',
    requiredValue: 20,
    maxValue: 50,
  },
  {
    itemId: 'belt-bottomless-pouches',
    itemName: 'Belt of Bottomless Pouches',
    setId: 'absolute-absurdity',
    achievementId: 'lucky-accidents',
    achievementName: 'Benefiting from Lucky Accidents',
    requiredValue: 30,
    maxValue: 75,
  },
  {
    itemId: 'boots-bizarre-locomotion',
    itemName: 'Boots of Bizarre Locomotion',
    setId: 'absolute-absurdity',
    achievementId: 'dramatic-entrances',
    achievementName: 'Making Dramatic Entrances',
    requiredValue: 35,
    maxValue: 70,
  },
  // Weapons for Set 7
  {
    itemId: 'blades-bloody-banter',
    itemName: 'Blades of Bloody Banter',
    setId: 'absolute-absurdity',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'pistols-probability-violation',
    itemName: 'Pistols of Probability Violation',
    setId: 'absolute-absurdity',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'explosives-escalating-mayhem',
    itemName: 'Explosives of Escalating Mayhem',
    setId: 'absolute-absurdity',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },

  // SET 8: THE SELF-AWARE SLAYER'S KIT
  {
    itemId: 'cowl-cosmic-awareness',
    itemName: 'Cowl of Cosmic Awareness',
    setId: 'self-aware-slayer',
    achievementId: 'perceive-meta',
    achievementName: 'Perceiving Meta-Narrative Elements',
    requiredValue: 10,
    maxValue: 25,
  },
  {
    itemId: 'armor-authorial-intent',
    itemName: 'Armor of Authorial Intent',
    setId: 'self-aware-slayer',
    achievementId: 'survive-impossible',
    achievementName: 'Surviving Impossible Odds',
    requiredValue: 8,
    maxValue: 20,
  },
  {
    itemId: 'gloves-genre-savviness',
    itemName: 'Gloves of Genre Savviness',
    setId: 'self-aware-slayer',
    achievementId: 'influence-story',
    achievementName: 'Influencing Story Outcomes',
    requiredValue: 12,
    maxValue: 30,
  },
  {
    itemId: 'sash-script-flipping',
    itemName: 'Sash of Script Flipping',
    setId: 'self-aware-slayer',
    achievementId: 'deus-ex-machina',
    achievementName: 'Resolving Conflicts Through Improbable Means',
    requiredValue: 6,
    maxValue: 15,
  },
  {
    itemId: 'boots-boundary-crossing',
    itemName: 'Boots of Boundary Crossing',
    setId: 'self-aware-slayer',
    achievementId: 'escape-last-second',
    achievementName: 'Escaping at the Last Second',
    requiredValue: 20,
    maxValue: 50,
  },
  // Weapons for Set 8
  {
    itemId: 'swords-surgical-storytelling',
    itemName: 'Swords of Surgical Storytelling',
    setId: 'self-aware-slayer',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'guns-guaranteed-payoff',
    itemName: 'Guns of Guaranteed Payoff',
    setId: 'self-aware-slayer',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
  {
    itemId: 'device-deus-ex-machina',
    itemName: 'Device of Deus Ex Machina',
    setId: 'self-aware-slayer',
    achievementId: '',
    achievementName: '',
    requiredValue: 0,
    maxValue: 0,
  },
];

// Build a lookup map for quick access
export const gearUnlockMap: Record<string, GearUnlockMapping> = {};
gearUnlockMappings.forEach(mapping => {
  gearUnlockMap[mapping.itemId] = mapping;
});

// Get unlock status for an item
export function getItemUnlockStatus(
  itemId: string,
  achievements: Achievement[]
): {
  isUnlocked: boolean;
  hasRequirement: boolean;
  achievement?: Achievement;
  requiredValue: number;
  currentValue: number;
  progressPercent: number;
} {
  const mapping = gearUnlockMap[itemId];
  
  // No mapping or no requirement = always unlocked
  if (!mapping || !mapping.achievementId) {
    return {
      isUnlocked: true,
      hasRequirement: false,
      requiredValue: 0,
      currentValue: 0,
      progressPercent: 100,
    };
  }

  const achievement = achievements.find(a => a.id === mapping.achievementId);
  const currentValue = achievement?.currentValue ?? 0;
  const isUnlocked = currentValue >= mapping.requiredValue;
  const progressPercent = Math.min(100, (currentValue / mapping.requiredValue) * 100);

  return {
    isUnlocked,
    hasRequirement: true,
    achievement,
    requiredValue: mapping.requiredValue,
    currentValue,
    progressPercent,
  };
}

// Check if an entire set has any locked items
export function getSetUnlockStatus(
  setId: string,
  achievements: Achievement[]
): {
  unlockedCount: number;
  totalWithRequirements: number;
  allUnlocked: boolean;
} {
  const setMappings = gearUnlockMappings.filter(m => m.setId === setId && m.achievementId);
  let unlockedCount = 0;

  setMappings.forEach(mapping => {
    const status = getItemUnlockStatus(mapping.itemId, achievements);
    if (status.isUnlocked) {
      unlockedCount++;
    }
  });

  return {
    unlockedCount,
    totalWithRequirements: setMappings.length,
    allUnlocked: unlockedCount >= setMappings.length,
  };
}

// Get all unlockable gear for a specific achievement
export function getGearForAchievement(achievementId: string): GearUnlockMapping[] {
  return gearUnlockMappings.filter(m => m.achievementId === achievementId);
}
