// Channel Divinity - Cleric Class Resource
// Uses regenerate on SHORT REST (unlike Sorcery Points which regen on long rest)
// Per 5e PHB: 1 use at level 2, 2 uses at level 6, 3 uses at level 18

export interface ChannelDivinityConfig {
  maxUses: number;
}

/**
 * Channel Divinity uses progression by Cleric level
 * Level 2: 1 use
 * Level 6: 2 uses
 * Level 18: 3 uses
 */
export const CHANNEL_DIVINITY_BY_LEVEL: Record<number, ChannelDivinityConfig> = {
  1:  { maxUses: 0 },
  2:  { maxUses: 1 },
  3:  { maxUses: 1 },
  4:  { maxUses: 1 },
  5:  { maxUses: 1 },
  6:  { maxUses: 2 },
  7:  { maxUses: 2 },
  8:  { maxUses: 2 },
  9:  { maxUses: 2 },
  10: { maxUses: 2 },
  11: { maxUses: 2 },
  12: { maxUses: 2 },
  13: { maxUses: 2 },
  14: { maxUses: 2 },
  15: { maxUses: 2 },
  16: { maxUses: 2 },
  17: { maxUses: 2 },
  18: { maxUses: 3 },
  19: { maxUses: 3 },
  20: { maxUses: 3 },
};

/**
 * Get Channel Divinity configuration for a cleric level
 */
export function getChannelDivinityForLevel(clericLevel: number): ChannelDivinityConfig | null {
  if (clericLevel < 2) return null; // No Channel Divinity before level 2
  const clampedLevel = Math.min(clericLevel, 20);
  return CHANNEL_DIVINITY_BY_LEVEL[clampedLevel] ?? null;
}

/**
 * Get the number of Channel Divinity uses for a cleric level
 */
export function getChannelDivinityUses(clericLevel: number): number {
  if (clericLevel < 2) return 0;
  if (clericLevel < 6) return 1;
  if (clericLevel < 18) return 2;
  return 3;
}

/**
 * Check if Channel Divinity regenerates on short rest
 * Per 5e: Channel Divinity regenerates on SHORT rest
 */
export function channelDivinityRegeneratesOnShortRest(): boolean {
  return true;
}

/**
 * Check if Channel Divinity regenerates on long rest
 */
export function channelDivinityRegeneratesOnLongRest(): boolean {
  return true; // Also regenerates on long rest (which includes short rest benefits)
}

/**
 * Base Channel Divinity options available to all Clerics
 */
export interface ChannelDivinityOption {
  id: string;
  name: string;
  description: string;
  unlockedAtLevel: number;
  isSubclassFeature: boolean;
}

export const BASE_CHANNEL_DIVINITY_OPTIONS: ChannelDivinityOption[] = [
  {
    id: 'turn-undead',
    name: 'Turn Undead',
    description: 'As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead that can see or hear you within 30 feet must make a Wisdom saving throw. If the creature fails, it is turned for 1 minute or until it takes any damage.',
    unlockedAtLevel: 2,
    isSubclassFeature: false,
  },
];

/**
 * Destroy Undead CR thresholds by cleric level
 * When undead fails Turn Undead save and has CR at or below threshold, it is destroyed
 */
export const DESTROY_UNDEAD_CR: Record<number, string> = {
  5: 'CR 1/2',
  8: 'CR 1',
  11: 'CR 2',
  14: 'CR 3',
  17: 'CR 4',
};

/**
 * Get the Destroy Undead CR threshold for a cleric level
 */
export function getDestroyUndeadCR(clericLevel: number): string | null {
  if (clericLevel < 5) return null;
  if (clericLevel < 8) return 'CR 1/2';
  if (clericLevel < 11) return 'CR 1';
  if (clericLevel < 14) return 'CR 2';
  if (clericLevel < 17) return 'CR 3';
  return 'CR 4';
}
