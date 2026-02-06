// Chronicle Sync Barrel Exports

// Core types
export * from './types';
export * from './enhancedTypes';

// Original pattern matching
export * from './patterns';
export * from './enhancedPatterns';

// Enhanced patterns (new - exported under namespace to avoid conflicts)
export { 
  parseSpellSlotMatches,
  parseRestMatches,
  parseDowntimeMatches,
  parseDeathSaveMatches,
  parseSkillCheckMatches,
  parseSavingThrowMatches,
  parseInitiativeMatches,
  parseInspirationMatches,
  parseEnemyMatches,
  parseAllEnemyUpdates,
  parseEnhancedPatterns as parseAllEnhancedPatterns,
  countActiveEnemies,
  countDefeatedEnemies,
  type SpellSlotMatch,
  type RestMatch,
  type DowntimeMatch,
  type DeathSaveMatch,
  type SkillCheckMatch,
  type SavingThrowMatch,
  type InitiativeMatch,
  type InspirationMatch,
  type ParsedEnemy,
  type ParsedEnemyUpdate,
  type EnhancedPatternResults as AllEnhancedPatternResults,
  SKILLS,
  ABILITIES,
  ABILITY_FULL,
} from './patterns/index';

// Multi-session processing
export * from './multiSession';

// AI capabilities
export * from './aiCapabilities';

// Utilities
export * from './achievementMatcher';
export * from './fuzzyMatch';
export * from './processor';
export * from './validation';
