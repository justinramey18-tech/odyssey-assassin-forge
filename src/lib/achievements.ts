// Achievement Categories and Tracking System

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxValue: number;
  currentValue: number;
}

export interface AchievementPrerequisite {
  achievementId: string;
  requiredValue: number;
}

export const achievementCategories: Achievement[] = [
  {
    id: 'distract-enemies',
    name: 'Distracting Enemies with Dialogue',
    description: 'Distract enemies during combat with witty dialogue',
    icon: 'MessageSquare',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'survive-zero-hp',
    name: 'Surviving After Being Reduced to 0 HP',
    description: 'Survive being reduced to 0 HP in different battles',
    icon: 'HeartPulse',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'overkill-strikes',
    name: 'Overkill Strikes on Low-Health Enemies',
    description: 'Achieve overkill strikes on low-health enemies',
    icon: 'Skull',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'collect-items',
    name: 'Collecting Unique Items',
    description: 'Collect unique items in your inventory',
    icon: 'Package',
    maxValue: 200,
    currentValue: 0,
  },
  {
    id: 'successful-leaps',
    name: 'Performing Successful Leaps',
    description: 'Perform successful leaps from high points',
    icon: 'ArrowUp',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'post-kill-oneliners',
    name: 'Delivering Post-Kill One-Liners',
    description: 'Deliver post-kill one-liners that amuse allies',
    icon: 'Laugh',
    maxValue: 200,
    currentValue: 0,
  },
  {
    id: 'faction-quests',
    name: 'Completing Side Quests for Factions',
    description: 'Complete side quests for different factions',
    icon: 'Flag',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'shots-no-miss',
    name: 'Firing Shots Without Missing',
    description: 'Fire consecutive shots without missing',
    icon: 'Target',
    maxValue: 1000,
    currentValue: 0,
  },
  {
    id: 'food-in-combat',
    name: 'Consuming Food During Combat',
    description: 'Consume food during different combat encounters',
    icon: 'UtensilsCrossed',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'arrive-late',
    name: 'Arriving Late to Battles',
    description: 'Arrive late to battles and still achieve victory',
    icon: 'Clock',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'fail-wisdom-save',
    name: 'Failing Wisdom Saving Throws and Surviving',
    description: 'Fail Wisdom saving throws and survive the consequences',
    icon: 'Brain',
    maxValue: 30,
    currentValue: 0,
  },
  {
    id: 'zero-to-full',
    name: 'Healing from 0 to Full HP',
    description: 'Heal from 0 HP to full HP in a single session',
    icon: 'Heart',
    maxValue: 20,
    currentValue: 0,
  },
  {
    id: 'nonverbal-combat',
    name: 'Using Non-Verbal Communication in Combat',
    description: 'Use non-verbal communication in combat',
    icon: 'Hand',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'quick-draw-attack',
    name: 'Drawing Weapons and Attacking Quickly',
    description: 'Draw weapon and attack in same turn',
    icon: 'Zap',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'dash-action',
    name: 'Using Dash Action',
    description: 'Use Dash action in combat',
    icon: 'Wind',
    maxValue: 200,
    currentValue: 0,
  },
  {
    id: 'predict-plot',
    name: 'Predicting Plot Twists',
    description: 'Correctly predict major plot twists',
    icon: 'Lightbulb',
    maxValue: 10,
    currentValue: 0,
  },
  {
    id: 'survive-meant-lose',
    name: 'Surviving Meant-to-Lose Encounters',
    description: 'Survive encounters where you\'re meant to lose',
    icon: 'Trophy',
    maxValue: 20,
    currentValue: 0,
  },
  {
    id: 'recognize-tropes',
    name: 'Recognizing Narrative Tropes',
    description: 'Recognize and call out narrative tropes used by the DM',
    icon: 'BookOpen',
    maxValue: 30,
    currentValue: 0,
  },
  {
    id: 'reverse-situations',
    name: 'Reversing Situations with Improbable Actions',
    description: 'Successfully reverse situations by attempting the impossible',
    icon: 'RefreshCw',
    maxValue: 20,
    currentValue: 0,
  },
  {
    id: 'hidden-paths',
    name: 'Discovering Hidden Paths',
    description: 'Discover and explore hidden or secret paths',
    icon: 'Map',
    maxValue: 30,
    currentValue: 0,
  },
  {
    id: 'humor-defuse',
    name: 'Defusing Tension with Humor',
    description: 'Survive encounters by using humor to defuse tension',
    icon: 'Smile',
    maxValue: 50,
    currentValue: 0,
  },
  {
    id: 'minor-injuries',
    name: 'Enduring Battles with Minor Injuries',
    description: 'Endure battles while suffering minor injuries',
    icon: 'Bandage',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'combat-flourishes',
    name: 'Performing Unnecessary Combat Flourishes',
    description: 'Perform unnecessary flourishes in combat',
    icon: 'Sparkles',
    maxValue: 100,
    currentValue: 0,
  },
  {
    id: 'share-food-enemies',
    name: 'Sharing Food with Enemies',
    description: 'Share food with enemies, creating temporary truces',
    icon: 'Cookie',
    maxValue: 30,
    currentValue: 0,
  },
  {
    id: 'lucky-items',
    name: 'Finding Useful Items Against Odds',
    description: 'Pull useful items from inventory despite low odds',
    icon: 'Dice5',
    maxValue: 50,
    currentValue: 0,
  },
];

// Map of item IDs to their prerequisites
export const itemPrerequisites: Record<string, AchievementPrerequisite> = {
  // SET 1: THE MERC WITH A MOUTH'S REGALIA
  'mask-perpetual-commentary': { achievementId: 'distract-enemies', requiredValue: 20 },
  'cuirass-regenerative-nonsense': { achievementId: 'survive-zero-hp', requiredValue: 10 },
  'gauntlets-gratuitous-violence': { achievementId: 'overkill-strikes', requiredValue: 50 },
  'belt-infinite-pouches': { achievementId: 'collect-items', requiredValue: 100 },
  'greaves-inexplicable-acrobatics': { achievementId: 'successful-leaps', requiredValue: 50 },
  
  // SET 2: ARSENAL OF CHAOTIC CONTRACTS
  'cowl-constant-quipping': { achievementId: 'post-kill-oneliners', requiredValue: 100 },
  'armor-questionable-sponsorships': { achievementId: 'faction-quests', requiredValue: 20 },
  'bracers-excessive-reloading': { achievementId: 'shots-no-miss', requiredValue: 500 },
  'sash-taco-trucks': { achievementId: 'food-in-combat', requiredValue: 30 },
  'boots-inappropriate-timing': { achievementId: 'arrive-late', requiredValue: 25 },
  
  // SET 3: REGALIA OF REGENERATIVE RIDICULOUSNESS
  'helmet-scarred-memories': { achievementId: 'fail-wisdom-save', requiredValue: 10 },
  'plate-persistent-healing': { achievementId: 'zero-to-full', requiredValue: 3 },
  'gauntlets-gratuitous-gestures': { achievementId: 'nonverbal-combat', requiredValue: 30 },
  'belt-holsters': { achievementId: 'quick-draw-attack', requiredValue: 50 },
  'greaves-unstoppable-momentum': { achievementId: 'dash-action', requiredValue: 100 },
  
  // SET 4: THE SELF-AWARE SLAYER'S KIT
  'mask-medium-awareness': { achievementId: 'predict-plot', requiredValue: 3 },
  'breastplate-breaking-tension': { achievementId: 'survive-meant-lose', requiredValue: 5 },
  'vambraces-violence-escalation': { achievementId: 'recognize-tropes', requiredValue: 10 },
  'belt-budget-constraints': { achievementId: 'reverse-situations', requiredValue: 5 },
  'boots-sequel-hooks': { achievementId: 'hidden-paths', requiredValue: 10 },
  
  // SET 5: VESTMENTS OF VIOLENT COMEDY
  'crown-conscious-incompetence': { achievementId: 'humor-defuse', requiredValue: 20 },
  'armor-acceptable-losses': { achievementId: 'minor-injuries', requiredValue: 30 },
  'gloves-gratuitous-gestures': { achievementId: 'combat-flourishes', requiredValue: 50 },
  'sash-snack-storage': { achievementId: 'share-food-enemies', requiredValue: 10 },
  'pants-improbable-pockets': { achievementId: 'lucky-items', requiredValue: 20 },
};

// Helper function to check if item is unlocked
export function isItemUnlocked(itemId: string, achievements: Achievement[]): boolean {
  const prerequisite = itemPrerequisites[itemId];
  if (!prerequisite) return true; // No prerequisite = always unlocked
  
  const achievement = achievements.find(a => a.id === prerequisite.achievementId);
  if (!achievement) return false;
  
  return achievement.currentValue >= prerequisite.requiredValue;
}

// Helper function to get prerequisite info for an item
export function getItemPrerequisite(itemId: string): { achievement: Achievement | undefined; required: number } | null {
  const prerequisite = itemPrerequisites[itemId];
  if (!prerequisite) return null;
  
  const achievement = achievementCategories.find(a => a.id === prerequisite.achievementId);
  return { achievement, required: prerequisite.requiredValue };
}

// Get progress percentage for an achievement
export function getAchievementProgress(achievement: Achievement): number {
  return Math.min(100, (achievement.currentValue / achievement.maxValue) * 100);
}
