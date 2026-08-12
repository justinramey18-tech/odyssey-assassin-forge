// Resolves how far a character can move on their turn.
//
// The character model has no speed field, so every surface in the app hardcodes
// 30ft. That is wrong the moment a druid wild-shapes into a horse (60ft) or a
// giant fire beetle (30ft, but 0ft walking in some forms). Wild Shape forms DO
// carry a speed string, so we parse it here and fall back to 30 otherwise.

import { DEFAULT_MAX_MOVEMENT } from './economyStore';

/** One parsed movement mode, e.g. { mode: 'climb', feet: 30 }. */
export interface SpeedMode {
  mode: string;
  feet: number;
}

const SPEED_SEGMENT = /(?:([a-z]+)\s+)?(\d{1,3})\s*(?:ft|feet|')/i;

/**
 * Parse a stat-block speed string into its modes.
 * "40 ft., climb 30 ft." -> [{ mode: 'walk', feet: 40 }, { mode: 'climb', feet: 30 }]
 * "10 ft., fly 50 ft."   -> [{ mode: 'walk', feet: 10 }, { mode: 'fly',   feet: 50 }]
 */
export function parseSpeedModes(raw: string | null | undefined): SpeedMode[] {
  if (!raw || typeof raw !== 'string') return [];

  const modes: SpeedMode[] = [];
  for (const chunk of raw.split(',')) {
    const match = SPEED_SEGMENT.exec(chunk.trim());
    if (!match) continue;
    const feet = Number(match[2]);
    if (!Number.isFinite(feet) || feet < 0) continue;
    modes.push({ mode: (match[1] || 'walk').toLowerCase(), feet: Math.floor(feet) });
  }
  return modes;
}

/**
 * The number that belongs in the movement box.
 *
 * Walking speed wins. If walking is 0 — a shark, a giant octopus — the creature
 * is not immobile, so we fall back to its fastest other mode rather than
 * showing a movement box that can never be used.
 */
export function speedFeetFrom(raw: string | null | undefined): number | null {
  const modes = parseSpeedModes(raw);
  if (modes.length === 0) return null;

  const walk = modes.find(m => m.mode === 'walk');
  if (walk && walk.feet > 0) return walk.feet;

  const best = modes.reduce((max, m) => (m.feet > max ? m.feet : max), 0);
  return best > 0 ? best : 0;
}

export interface ResolveMovementOptions {
  /** Speed string of the currently assumed Wild Shape form, when transformed. */
  wildShapeSpeed?: string | null;
  /** True only while the character is actually in beast form. */
  isTransformed?: boolean;
  /** Manual override the player has set in the UI. Wins over everything. */
  override?: number | null;
}

/**
 * Single entry point for "what is this character's max movement right now".
 * Always returns a usable positive number; never throws.
 */
export function resolveMaxMovement(opts: ResolveMovementOptions = {}): number {
  const { wildShapeSpeed, isTransformed, override } = opts;

  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  if (isTransformed) {
    const feet = speedFeetFrom(wildShapeSpeed);
    if (feet !== null && feet > 0) return feet;
  }
  return DEFAULT_MAX_MOVEMENT;
}

/** Movement picker steps, always ending on the true maximum. */
export function movementSteps(maxMovement: number): number[] {
  const max = Math.max(0, Math.floor(maxMovement));
  const steps = new Set<number>([0]);
  for (let v = 5; v < max; v += 5) steps.add(v);
  steps.add(max);
  return Array.from(steps).sort((a, b) => a - b);
}
