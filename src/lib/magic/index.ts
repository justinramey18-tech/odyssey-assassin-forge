// ============================================
// MAGIC SYSTEM - MAIN EXPORT
// ============================================

// Core types
export * from './types';

// School visual configs
export * from './schools';

// Path definitions (for Rogue MagicPath system)
export * from './paths';

// Spell database
export * from './spells';

// Calculations (proficiency, preparation, scaling)
export * from './calculations';

// Duration tracking
export * from './durations';

// Range and area utilities
export * from './rangeUtils';

// Full caster slot progression (avoid re-exporting conflicting names)
export type { SpellSlotsByLevel } from './fullCasterSlots';
export { 
  FULL_CASTER_SLOTS,
  getSpellSlotsForLevel,
  getFullCasterMaxSpellLevel,
} from './fullCasterSlots';

// Pact magic (Warlock) slot progression (avoid re-exporting conflicting names)
export type { PactSlots as PactSlotsConfig } from './pactMagicSlots';
export { 
  PACT_MAGIC_SLOTS,
  getPactSlotsForLevel as getPactMagicSlotsForLevel,
  pactSlotsRegenerateOnShortRest,
} from './pactMagicSlots';

// Sorcery Points (Sorcerer) class resource
export type { SorceryPointsConfig, MetamagicOption } from './sorceryPoints';
export {
  SORCERY_POINTS_BY_LEVEL,
  SORCERY_POINT_SLOT_COST,
  METAMAGIC_OPTIONS,
  getSorceryPointsForLevel,
  getSlotCreationCost,
  getPointsFromSlotLevel,
  sorceryPointsRegenerateOnLongRest,
  getAvailableMetamagic,
  getTwinnedSpellCost,
} from './sorceryPoints';

// Channel Divinity (Cleric) class resource
export type { ChannelDivinityConfig, ChannelDivinityOption } from './channelDivinity';
export {
  CHANNEL_DIVINITY_BY_LEVEL,
  BASE_CHANNEL_DIVINITY_OPTIONS,
  DESTROY_UNDEAD_CR,
  getChannelDivinityForLevel,
  getChannelDivinityUses,
  getDestroyUndeadCR,
  channelDivinityRegeneratesOnShortRest,
  channelDivinityRegeneratesOnLongRest,
} from './channelDivinity';

// Wild Shape (Druid) class feature
export type { WildShapeConfig, WildShapeState, BeastForm } from './wildShape';
export {
  WILD_SHAPE_BY_LEVEL,
  BEAST_FORMS,
  getWildShapeForLevel,
  getWildShapeDuration,
  getAvailableBeastForms,
  getDefaultWildShapeState,
  formatCR,
  wildShapeRegeneratesOnShortRest,
  wildShapeRegeneratesOnLongRest,
} from './wildShape';

// Multiclass spell slot calculation
export type { MulticlassSpellSlots } from './multiclassSlots';
export { 
  getMulticlassSpellSlots,
  getMulticlassMaxSpellLevel,
  hasSpellcasting,
} from './multiclassSlots';
