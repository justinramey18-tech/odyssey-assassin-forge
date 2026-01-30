// Tutorial Step Configuration

export type TutorialCategory = 'welcome' | 'navigation' | 'settings' | 'progression' | 'equipment' | 'advanced';

export interface TutorialStep {
  id: string;
  targetId: string;           // data-tutorial-id on target element
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  category: TutorialCategory;
  action?: 'tap' | 'drag' | 'hold';  // Optional action hint
  skipCondition?: string;            // Condition key for conditional display
}

// Category colors for visual distinction
export const CATEGORY_COLORS: Record<TutorialCategory, string> = {
  welcome: 'hsl(var(--primary))',
  navigation: 'hsl(var(--primary))',
  settings: 'hsl(45, 93%, 47%)',      // Amber
  progression: 'hsl(142, 76%, 36%)',  // Green
  equipment: 'hsl(280, 65%, 60%)',    // Purple
  advanced: 'hsl(190, 90%, 50%)',     // Cyan
};

export const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  welcome: 'Welcome',
  navigation: 'Navigation',
  settings: 'Settings',
  progression: 'Progression',
  equipment: 'Equipment',
  advanced: 'Advanced',
};

export const tutorialSteps: TutorialStep[] = [
  // Phase 1: Welcome & Navigation
  {
    id: 'welcome',
    targetId: 'tutorial-welcome',
    title: 'Welcome, Assassin!',
    description: 'This is Odyssey Assassin - your companion for tabletop roleplay. Let\'s take a quick tour of the key features!',
    position: 'center',
    category: 'welcome',
  },
  {
    id: 'home-screen',
    targetId: 'home-screen-zones',
    title: 'Your Command Center',
    description: 'The Home Screen is your hub. Tap the assassin silhouettes to access different features. Pan around to explore the full scene!',
    position: 'bottom',
    category: 'navigation',
    action: 'tap',
  },
  {
    id: 'floating-drawers',
    targetId: 'drawer-stats',
    title: 'Floating Quick Access',
    description: 'These floating buttons give instant access to stats, abilities, and prompts. Drag them anywhere on screen! Hold at the screen edge for 1 second to navigate between screens.',
    position: 'right',
    category: 'navigation',
    action: 'drag',
  },
  
  // Phase 2: Settings & Modes
  {
    id: 'settings-button',
    targetId: 'settings-button',
    title: 'Settings & Configuration',
    description: 'Access your settings to customize your experience. Let\'s look at the key options available!',
    position: 'bottom',
    category: 'settings',
    action: 'tap',
  },
  {
    id: 'game-modes',
    targetId: 'game-mode-section',
    title: 'Choose Your Play Style',
    description: 'Infinity Pool mode gives full sandbox access. Honest Mode enforces earned progression with toggleable rules like "No Rerolls" and "Organic Leveling".',
    position: 'bottom',
    category: 'settings',
  },
  {
    id: 'dice-odds',
    targetId: 'dice-odds-widget',
    title: 'Customize Your Luck',
    description: 'Choose Fair for true randomness, Heroic for better odds, Dramatic for wild swings, or Cursed for maximum suffering!',
    position: 'top',
    category: 'settings',
  },
  {
    id: 'xp-progression',
    targetId: 'xp-progression-widget',
    title: 'Leveling Speed',
    description: 'Control how fast you level: Slow (2x XP required), Natural (standard D&D 5e), or Fast Track (0.5x requirements).',
    position: 'top',
    category: 'settings',
  },
  
  // Phase 3: Character Progression
  {
    id: 'skills-tab',
    targetId: 'tab-skills',
    title: 'Ability Trees',
    description: 'Spend ability points across three trees: Hunter (ranged), Warrior (melee), and Assassin (stealth). Unlock tiers 1-3 for each skill!',
    position: 'bottom',
    category: 'progression',
    action: 'tap',
  },
  {
    id: 'xp-tracker',
    targetId: 'xp-tracker',
    title: 'Experience & Leveling',
    description: 'Earn XP from combat, quests, and roleplay moments. Watch your progress bar fill as you work toward the next level!',
    position: 'bottom',
    category: 'progression',
  },
  {
    id: 'prestige-badge',
    targetId: 'prestige-badge',
    title: 'Prestige Mode',
    description: 'At Level 20, enter Prestige! Earn Prestige XP for additional ability points. The golden badge shows your Prestige rank (P1, P2...).',
    position: 'bottom',
    category: 'progression',
    skipCondition: 'notMaxLevel',
  },
  {
    id: 'legacy-tab',
    targetId: 'tab-legacy',
    title: "Drizzt's Legacy",
    description: 'Master all 24 base abilities to unlock legendary powers from Drizzt Do\'Urden! Four branches await: Dual Wielding, Guenhwyvar, Drow Abilities, and Monk techniques.',
    position: 'bottom',
    category: 'progression',
    action: 'tap',
  },
  
  // Phase 4: Equipment & Achievements
  {
    id: 'gear-tab',
    targetId: 'tab-gear',
    title: 'Equipment & Legendaries',
    description: 'Equip gear across 8 slots. Legendary sets provide powerful bonuses when you wear multiple pieces!',
    position: 'bottom',
    category: 'equipment',
    action: 'tap',
  },
  {
    id: 'feats-tab',
    targetId: 'tab-feats',
    title: 'Achievement Tracking',
    description: 'Complete 40 achievement categories tied to 8 legendary sets. Hit milestones (25%, 50%, 75%, 100%) to unlock gear and earn bonus XP!',
    position: 'bottom',
    category: 'equipment',
    action: 'tap',
  },
  {
    id: 'stars-tab',
    targetId: 'tab-stars',
    title: 'Constellation Map',
    description: 'Visualize your legendary set bonuses as stars in the night sky. Complete sets to illuminate your constellation!',
    position: 'bottom',
    category: 'equipment',
    action: 'tap',
  },
  
  // Phase 5: Advanced Features
  {
    id: 'scribe-drawer',
    targetId: 'drawer-scribe',
    title: 'The Narrative Forge',
    description: 'Transform your game logs into dramatic prose! Paste session notes and let the Scribe rewrite them as epic narrative.',
    position: 'right',
    category: 'advanced',
    action: 'tap',
  },
  {
    id: 'infinity-gauntlet',
    targetId: 'zone-gauntlet',
    title: 'The Infinity Gauntlet',
    description: 'At Level 20, access the Gauntlet! Each Infinity Stone contains roleplay prompts to inspire your adventures. (Locked until max level in Honest Mode)',
    position: 'bottom',
    category: 'advanced',
    action: 'tap',
    skipCondition: 'gauntletLocked',
  },
  {
    id: 'tutorial-complete',
    targetId: 'tutorial-complete',
    title: 'You\'re Ready!',
    description: 'That\'s the basics! You can replay this tutorial anytime from Settings. Now go forth and create legendary stories, assassin!',
    position: 'center',
    category: 'welcome',
  },
];

// Tutorial storage keys
export const TUTORIAL_STORAGE_KEY = 'odyssey-tutorial-completed';
export const TUTORIAL_STEP_KEY = 'odyssey-tutorial-last-step';
