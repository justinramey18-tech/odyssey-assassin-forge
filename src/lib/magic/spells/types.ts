import { SpellDefinition, SpellSchool, MagicPath } from '../types';

// Re-export core types
export type { SpellDefinition, SpellSchool, MagicPath };

// Spell registry type
export type SpellRegistry = Record<string, SpellDefinition>;

// Spell filter options
export interface SpellFilter {
  level?: number | number[];
  school?: SpellSchool | SpellSchool[];
  path?: MagicPath | MagicPath[];
  concentration?: boolean;
  ritual?: boolean;
  searchTerm?: string;
}

// Spell list result
export interface SpellListResult {
  spell: SpellDefinition;
  isKnown: boolean;
  isPrepared: boolean;
  isFavorite: boolean;
  canLearn: boolean;
}
