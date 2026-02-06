// Enhanced Chronicle Sync Patterns - Barrel Export
// Re-exports all pattern modules for easy importing

// Original patterns from patterns.ts
export * from '../patterns';

// New enhanced patterns
export * from './spellSlots';
export * from './rests';
export * from './deathSaves';
export * from './checks';
export * from './initiative';
export * from './inspiration';
export * from './enemies';
export * from './enemyUpdates';

// Convenience aggregate parser
import { parseSpellSlotMatches, SpellSlotMatch } from './spellSlots';
import { parseRestMatches, parseDowntimeMatches, RestMatch, DowntimeMatch } from './rests';
import { parseDeathSaveMatches, DeathSaveMatch } from './deathSaves';
import { parseSkillCheckMatches, parseSavingThrowMatches, SkillCheckMatch, SavingThrowMatch } from './checks';
import { parseInitiativeMatches, InitiativeMatch } from './initiative';
import { parseInspirationMatches, InspirationMatch } from './inspiration';
import { parseEnemyMatches, ParsedEnemy } from './enemies';
import { parseAllEnemyUpdates, ParsedEnemyUpdate } from './enemyUpdates';

export interface EnhancedPatternResults {
  spellSlots: SpellSlotMatch[];
  rests: RestMatch[];
  downtime: DowntimeMatch[];
  deathSaves: DeathSaveMatch[];
  skillChecks: SkillCheckMatch[];
  savingThrows: SavingThrowMatch[];
  initiative: InitiativeMatch[];
  inspiration: InspirationMatch[];
  enemies: ParsedEnemy[];
  enemyUpdates: ParsedEnemyUpdate[];
}

/**
 * Runs all enhanced pattern matchers on the given text.
 * Use this for comprehensive session log parsing.
 */
export function parseEnhancedPatterns(text: string): EnhancedPatternResults {
  return {
    spellSlots: parseSpellSlotMatches(text),
    rests: parseRestMatches(text),
    downtime: parseDowntimeMatches(text),
    deathSaves: parseDeathSaveMatches(text),
    skillChecks: parseSkillCheckMatches(text),
    savingThrows: parseSavingThrowMatches(text),
    initiative: parseInitiativeMatches(text),
    inspiration: parseInspirationMatches(text),
    enemies: parseEnemyMatches(text),
    enemyUpdates: parseAllEnemyUpdates(text),
  };
}
