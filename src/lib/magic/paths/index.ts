import { PathConfig, MagicPath } from '../types';
import { ARCANE_TRICKSTER } from './arcane-trickster';
import { SHADOW_BLADE } from './shadow-blade';
import { ELDRITCH_KNIGHT } from './eldritch-knight';
import { HEXBLADE } from './hexblade';

// ============================================
// PATH REGISTRY
// ============================================

export const MAGIC_PATHS: Record<MagicPath, PathConfig> = {
  arcane_trickster: ARCANE_TRICKSTER,
  shadow_blade: SHADOW_BLADE,
  eldritch_knight: ELDRITCH_KNIGHT,
  hexblade: HEXBLADE,
};

export const PATH_LIST: PathConfig[] = Object.values(MAGIC_PATHS);

// ============================================
// PATH UTILITIES
// ============================================

export function getPathConfig(pathId: MagicPath): PathConfig {
  return MAGIC_PATHS[pathId];
}

export function getPathName(pathId: MagicPath): string {
  return MAGIC_PATHS[pathId].name;
}

export function getPathAbility(pathId: MagicPath): 'INT' | 'CHA' | 'WIS' {
  return MAGIC_PATHS[pathId].spellcastingAbility;
}

export function getPathProgression(pathId: MagicPath): 'third' | 'half' | 'pact' {
  return MAGIC_PATHS[pathId].slotProgression;
}

export function isPathAvailable(pathId: MagicPath, characterLevel: number): boolean {
  // Most paths unlock at level 3 (when subclasses are chosen)
  // Hexblade (Warlock) is available from level 1
  if (pathId === 'hexblade') return characterLevel >= 1;
  return characterLevel >= 3;
}

// Re-export individual paths
export { ARCANE_TRICKSTER } from './arcane-trickster';
export { SHADOW_BLADE } from './shadow-blade';
export { ELDRITCH_KNIGHT } from './eldritch-knight';
export { HEXBLADE } from './hexblade';
