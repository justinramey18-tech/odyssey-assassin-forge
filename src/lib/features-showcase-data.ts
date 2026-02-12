export interface FeatureItem {
  id: string;
  name: string;
  description: string;
  iconName: string;
  navigateTo?: string; // tab ID for deep-linking via /?tab=
}

export interface FeatureCategory {
  id: string;
  label: string;
  iconName: string;
  color: string; // tailwind color prefix e.g. 'green', 'red'
  borderColor: string; // tailwind border class
  textColor: string; // tailwind text class
  bgAccent: string; // tailwind bg class for icon badge
  description: string;
  features: FeatureItem[];
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'character',
    label: 'Character & Progression',
    iconName: 'User',
    color: 'green',
    borderColor: 'border-green-500/40',
    textColor: 'text-green-400',
    bgAccent: 'bg-green-500/20',
    description: 'Build, level, and evolve your character from creation to legend.',
    features: [
      { id: 'char-wizard', name: 'Character Wizard', description: 'Step-by-step guided character creation with race, class, and ability score selection.', iconName: 'Wand2' },
      { id: 'char-classes', name: 'Multi-Class Support', description: 'Choose from 8+ classes including Fighter, Wizard, Rogue, Cleric, and more with full progression.', iconName: 'Shield' },
      { id: 'char-level', name: 'XP & Leveling', description: 'Earn XP from sessions, quests, and milestones. Level up with automatic stat and feature unlocks.', iconName: 'TrendingUp' },
      { id: 'char-abilities', name: 'Ability Score Management', description: 'Track all six ability scores with modifiers, saving throws, and skill proficiencies.', iconName: 'BarChart3', navigateTo: 'abilities' },
      { id: 'char-hp', name: 'Dynamic HP Tracking', description: 'Real-time health bar with current HP, max HP, and temporary HP tracking on the home screen.', iconName: 'Heart' },
      { id: 'char-rest', name: 'Short & Long Rests', description: 'One-tap short rest and hold-to-activate long rest with resource recovery and cooldown resets.', iconName: 'Moon' },
      { id: 'char-prestige', name: 'Prestige / Legacy System', description: 'Unlock prestige tiers for bonus ability points and exclusive legacy abilities.', iconName: 'Crown', navigateTo: 'legacy' },
      { id: 'char-saves', name: 'Character Saves', description: 'Multiple save slots with auto-save, manual save, and cloud backup support.', iconName: 'Save' },
      { id: 'char-wild', name: 'Wild Shape', description: 'Transform into beasts with custom backgrounds, CR-scaled effects, and dragon element particles.', iconName: 'PawPrint' },
      { id: 'char-conditions', name: 'Status Conditions', description: 'Track active conditions, debuffs, and concentration spells with real-time indicators.', iconName: 'AlertTriangle' },
      { id: 'char-feats', name: 'Feats & Achievements', description: 'Unlock and track character feats and in-app achievements for milestones.', iconName: 'Trophy', navigateTo: 'feats' },
      { id: 'char-stars', name: 'Star Rating', description: 'Visual star-based progression system tied to character growth.', iconName: 'Star', navigateTo: 'stars' },
    ],
  },
  {
    id: 'combat',
    label: 'Combat & Fighting',
    iconName: 'Swords',
    color: 'red',
    borderColor: 'border-red-500/40',
    textColor: 'text-red-400',
    bgAccent: 'bg-red-500/20',
    description: 'Engage in tactical combat with a HUD-style interface.',
    features: [
      { id: 'combat-tab', name: 'Combat Dashboard', description: 'Iron Man-style red/black HUD showing all combat-relevant stats, actions, and quick rolls.', iconName: 'Crosshair', navigateTo: 'combat' },
      { id: 'combat-init', name: 'Initiative Tracker', description: 'Roll and track initiative order with automatic modifier calculation.', iconName: 'ArrowUpDown', navigateTo: 'combat' },
      { id: 'combat-skills', name: 'Skill Trees', description: 'Three branching skill trees (Hunter, Warrior, Assassin) with tiered upgrades and visual glow effects.', iconName: 'GitBranch', navigateTo: 'skills' },
      { id: 'combat-actions', name: 'Quick Actions', description: 'Drawer of all equipped abilities for instant access during combat encounters.', iconName: 'ListChecks' },
      { id: 'combat-dice', name: 'Dice Roller', description: 'Full-featured dice roller with d4 through d20, advantage/disadvantage, and custom expressions.', iconName: 'Dices' },
      { id: 'combat-loadout', name: 'Combat Loadout', description: 'Equip abilities into loadout slots for quick access during encounters.', iconName: 'Layers' },
      { id: 'combat-homebrew', name: 'Homebrew Abilities', description: 'Create custom abilities with uploaded images, action types, recovery mechanics, and AI balance feedback.', iconName: 'Paintbrush' },
      { id: 'combat-cooldowns', name: 'Cooldown Tracking', description: 'Visual cooldown timers for abilities that refresh on short rest, long rest, or custom triggers.', iconName: 'Timer' },
      { id: 'combat-map', name: 'Battle Map', description: 'Standalone battle map for positioning tokens and visualizing encounters.', iconName: 'Map' },
      { id: 'combat-log', name: 'Combat Log', description: 'Party-shared combat log tracking attacks, damage, healing, and critical hits in real-time.', iconName: 'ScrollText' },
    ],
  },
  {
    id: 'arcana',
    label: 'Arcana & Spellcasting',
    iconName: 'Wand2',
    color: 'indigo',
    borderColor: 'border-indigo-500/40',
    textColor: 'text-indigo-400',
    bgAccent: 'bg-indigo-500/20',
    description: 'Manage your magical arsenal with full spellbook support.',
    features: [
      { id: 'arcana-book', name: 'Spellbook', description: 'Browse, search, and manage your full spell list organized by level with detailed descriptions.', iconName: 'BookOpen', navigateTo: 'arcana' },
      { id: 'arcana-slots', name: 'Spell Slot Tracking', description: 'Visual spell slot tracker by level with expenditure and recovery on rests.', iconName: 'Layers', navigateTo: 'arcana' },
      { id: 'arcana-prep', name: 'Spell Preparation', description: 'Prepare spells for the day based on class rules and ability modifier limits.', iconName: 'CheckSquare', navigateTo: 'arcana' },
      { id: 'arcana-cantrips', name: 'Cantrip Management', description: 'Separate cantrip list with at-will casting and scaling damage calculations.', iconName: 'Sparkles', navigateTo: 'arcana' },
      { id: 'arcana-conc', name: 'Concentration Tracking', description: 'Active concentration spell indicator with automatic conflict warnings.', iconName: 'Focus' },
      { id: 'arcana-multi', name: 'Multiclass Spellcasting', description: 'Automatic spell slot calculation for multiclass characters using 5e rules.', iconName: 'Combine', navigateTo: 'arcana' },
      { id: 'arcana-class', name: 'Class Spell Lists', description: 'Curated spell lists for each spellcasting class with personality quips and lore.', iconName: 'Library', navigateTo: 'arcana' },
      { id: 'arcana-search', name: 'Spell Search & Filter', description: 'Search spells by name, school, level, or component with instant results.', iconName: 'Search', navigateTo: 'arcana' },
      { id: 'arcana-ritual', name: 'Ritual Casting', description: 'Mark and cast ritual spells without expending spell slots.', iconName: 'Scroll', navigateTo: 'arcana' },
      { id: 'arcana-half', name: 'Half/Third Caster Support', description: 'Proper progression for Paladins, Rangers, Eldritch Knights, and Arcane Tricksters.', iconName: 'SplitSquareHorizontal', navigateTo: 'arcana' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Gear',
    iconName: 'Backpack',
    color: 'amber',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    bgAccent: 'bg-amber-500/20',
    description: 'Manage equipment, consumables, loot, and your gold purse.',
    features: [
      { id: 'inv-consumables', name: 'Consumables Tracker', description: 'Track potions, scrolls, and limited-use items with quantity and usage history.', iconName: 'FlaskConical', navigateTo: 'consumables' },
      { id: 'inv-shop', name: 'Item Shop', description: 'Browse and purchase items detected from session logs with gold tracking.', iconName: 'Store', navigateTo: 'shop' },
      { id: 'inv-loot', name: 'Loot Management', description: 'Collect and distribute party loot with rarity indicators and claiming system.', iconName: 'Package', navigateTo: 'loot' },
      { id: 'inv-gear', name: 'Equipment Slots', description: 'Equip armor, weapons, and accessories with stat modifier calculations.', iconName: 'Shield', navigateTo: 'gear' },
      { id: 'inv-gold', name: 'Gold Tracking', description: 'Track gold earned and spent with automatic updates from session parsing.', iconName: 'Coins' },
      { id: 'inv-stats', name: 'Equipment Stats', description: 'View combined bonuses from all equipped gear including AC, attack, and damage modifiers.', iconName: 'BarChart3', navigateTo: 'gear' },
      { id: 'inv-rarity', name: 'Rarity System', description: 'Items classified by D&D rarity tiers: Common, Uncommon, Rare, Very Rare, Legendary.', iconName: 'Gem', navigateTo: 'loot' },
      { id: 'inv-party-loot', name: 'Party Loot Queue', description: 'Shared loot pool where party members can claim items in real-time.', iconName: 'Users', navigateTo: 'loot' },
      { id: 'inv-weight', name: 'Carry Capacity', description: 'Track encumbrance and carrying limits based on Strength score.', iconName: 'Weight', navigateTo: 'gear' },
      { id: 'inv-attune', name: 'Attunement Slots', description: 'Manage the three attunement slots for magical items requiring attunement.', iconName: 'Link', navigateTo: 'gear' },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Intelligence',
    iconName: 'Sparkles',
    color: 'purple',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
    bgAccent: 'bg-purple-500/20',
    description: 'AI-powered tools for storytelling, balance, and automation.',
    features: [
      { id: 'ai-dm', name: 'AI Dungeon Master', description: 'Full AI-powered DM with campaign memory, narrative generation, and encounter management.', iconName: 'Crown' },
      { id: 'ai-parse', name: 'Session Parsing', description: 'Paste session notes and let AI extract XP, gold, items, kills, and combat stats automatically.', iconName: 'FileText', navigateTo: 'chronicle' },
      { id: 'ai-balance', name: 'Homebrew Balance Check', description: 'AI evaluates custom abilities for balance using Gemini-powered analysis and feedback.', iconName: 'Scale' },
      { id: 'ai-prompts', name: 'RP Prompt Generator', description: 'AI-generated roleplay prompts and narrative hooks tailored to your character.', iconName: 'MessageSquare' },
      { id: 'ai-scribe', name: 'AI Scribe', description: 'Intelligent note-taking assistant that summarizes and organizes session content.', iconName: 'PenTool', navigateTo: 'scribe' },
      { id: 'ai-campaigns', name: 'Campaign Management', description: 'Save and manage multiple AI DM campaigns with persistent story memory.', iconName: 'FolderOpen' },
      { id: 'ai-party-dm', name: 'Party AI DM', description: 'Multiplayer AI DM mode where all party members contribute prompts for collaborative storytelling.', iconName: 'Users' },
      { id: 'ai-guides', name: 'GM Guides', description: 'Upload reference documents as context for the AI DM to follow specific campaign rules.', iconName: 'BookMarked' },
    ],
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer & Party',
    iconName: 'Users',
    color: 'sky',
    borderColor: 'border-sky-500/40',
    textColor: 'text-sky-400',
    bgAccent: 'bg-sky-500/20',
    description: 'Play together with real-time party sync and communication.',
    features: [
      { id: 'mp-create', name: 'Create & Join Parties', description: 'Create a party with a unique link code or join an existing one instantly.', iconName: 'UserPlus' },
      { id: 'mp-sync', name: 'Real-time Status Sync', description: 'Party members see each other\'s HP, level, and conditions updated in real-time.', iconName: 'RefreshCw' },
      { id: 'mp-chat', name: 'Party Chat', description: 'Full-featured chat with message reactions, pinning, image uploads, and reply threads.', iconName: 'MessageCircle' },
      { id: 'mp-dice', name: 'Shared Dice Rolls', description: 'Roll dice and automatically share results with your party in real-time.', iconName: 'Dices' },
      { id: 'mp-actions', name: 'Party Actions', description: 'Send healing, buffs, and items to party members with approval workflows.', iconName: 'SendHorizontal' },
      { id: 'mp-loot', name: 'Shared Loot Queue', description: 'DM or players add loot to a shared queue for fair distribution among party members.', iconName: 'Package' },
      { id: 'mp-online', name: 'Online Status', description: 'See which party members are currently online with green indicators and counts.', iconName: 'Wifi' },
      { id: 'mp-pings', name: 'Party Pings', description: 'Send quick pings and alerts to get your party\'s attention during sessions.', iconName: 'Bell' },
    ],
  },
  {
    id: 'utility',
    label: 'Utility & Tools',
    iconName: 'Wrench',
    color: 'cyan',
    borderColor: 'border-cyan-500/40',
    textColor: 'text-cyan-400',
    bgAccent: 'bg-cyan-500/20',
    description: 'Session tools, cloud sync, analytics, and app settings.',
    features: [
      { id: 'util-scribe', name: 'Session Scribe', description: 'Take structured notes during sessions with AI-powered summarization and organization.', iconName: 'BookOpen', navigateTo: 'scribe' },
      { id: 'util-chronicle', name: 'Chronicle', description: 'Import full session recaps to automatically extract stats, items, and progression changes.', iconName: 'Search', navigateTo: 'chronicle' },
      { id: 'util-cloud', name: 'Cloud Sync', description: 'Save and load character data to the cloud with automatic backup and multi-device support.', iconName: 'Cloud', navigateTo: 'cloud' },
      { id: 'util-analytics', name: 'Campaign Analytics', description: 'Track lifetime stats: total damage dealt, kills, gold earned, spells cast, and more.', iconName: 'BarChart3' },
      { id: 'util-settings', name: 'App Settings', description: 'Configure XP presets, game mode, display preferences, and background customization.', iconName: 'Settings', navigateTo: 'settings' },
      { id: 'util-install', name: 'Install as App', description: 'Install as a Progressive Web App for offline access and native-like experience.', iconName: 'Download' },
      { id: 'util-clock', name: 'Session Clock', description: 'Built-in clock widget on the home screen for tracking session duration.', iconName: 'Clock' },
      { id: 'util-bg', name: 'Custom Backgrounds', description: 'Upload custom home screen backgrounds to personalize your character\'s aesthetic.', iconName: 'Image' },
    ],
  },
];
