// Canonical list of localStorage keys that are scoped per character (by cloud save ID).
// Shared between cloud-save capture and auto-sync migration logic.

export const SCOPED_KEYS = [
  // Shop & Inventory
  'odyssey-shop',
  'odyssey-loot',
  'odyssey-pending-dm-items',
  'odyssey-misc-items',
  'odyssey-consumables-inventory',
  // Character stats & HP
  'odyssey-hp-state',
  'odyssey-death-saves',
  'odyssey-short-rests-remaining',
  'odyssey-inspiration',
  'odyssey-ability-scores',
  // Progression
  'odyssey-prestige-data',
  'odyssey-prestige-tree',
  'odyssey-xp-progression',
  // Proficiencies & Expertise
  'odyssey-proficient-skills',
  'odyssey-proficient-saves',
  'odyssey-expertise-skills',
  // Combat
  'odyssey-combat-settings',
  'odyssey-cooldown-state',
  'odyssey-cooldown-settings',
  'odyssey-conditions-state',
  'odyssey-combat-log',
  // Magic
  'odyssey-spellcasting',
  'odyssey-active-spells',
  // Custom images
  'odyssey-equipment-custom-images',
  'odyssey-ability-custom-images',
  // Dice modifiers (synced from ability scores)
  'odyssey-dice-modifiers',
  'odyssey-initiative',
  'odyssey-ability-customization',
  'odyssey-assassin-dice-odds',
  // Class-specific
  'dnd-druid-circle',
  'dnd-cleric-domain',
  'dnd-cleric-deity',
  'dnd-wild-shape-state',
  'odyssey-wild-shape-backgrounds',
  // Party
  // NOTE: 'odyssey-active-party-id' is deliberately NOT scoped. Party membership
  // belongs to the ACCOUNT, not to one character — scoping it meant switching
  // character silently dropped you out of your own party.
  'odyssey-party-chat-background',
  'odyssey-party-chat-background-settings',
  'odyssey-narration-style',

  // Narrative & AI
  'narrative-forge-saved-stories',
  'narrative-forge-active-story-id',
  'odyssey-chronicle-sessions',
  'odyssey-chronicle-analytics',
  'dnd-ai-dm-campaign-summary',
  'dnd-novel-builder-campaign-summary',
  // Play mode & UI
  // NOTE: 'odyssey-play-mode' is deliberately NOT scoped. Solo vs party is a
  // session-level choice; scoping it meant a character switch reset you to solo
  // and locked the party host out of their own session.

  'dnd-protagonist-cards',
  // Novel/Scribe context
  'novel-ctx-state',
  'scribe-ctx-state',
  'novel-style',
  'scribe-style',
  'novel-tone-intensity',
  'scribe-tone-intensity',
  'scribe-custom-style-prompt',
  'novel-npc-master-enabled',
  'novel-protagonist-master-enabled',
  'scribe-last-processor',
  // Monolithic autosave snapshot (scoped per character)
  'odyssey-character-autosave',
  // Alignment drift tracking
  'odyssey-alignment-drift',
  // DM input drafts
  'odyssey-solo-dm-draft',
  'odyssey-party-dm-draft',
  // DM chat theme
  'odyssey-dm-chat-theme',
  // Character Identity
  'dnd-character-gender',
  'dnd-character-race',
  'dnd-character-backstory',
  'dnd-character-relationships',
  // Narrative synthesis
  'odyssey-synthesis-recent-modes',
  // DM response mode
  'odyssey-dm-response-mode',
  // Empyrean unbonded status
  'empyrean-unbonded-status',
] as const;
