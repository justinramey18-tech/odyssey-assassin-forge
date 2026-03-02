// ============================================================
// Encounter Difficulty Calculator — 5e DMG p.82
// Pure functions, zero side effects, no external dependencies.
// ============================================================

// --- Types ---

export type DifficultyPreference = 'easy' | 'normal' | 'hard' | 'deadly';
export type EncounterDifficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

export interface XPThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface EncounterResult {
  difficulty: EncounterDifficulty;
  adjustedXP: number;
  rawXP: number;
  multiplier: number;
  thresholds: XPThresholds;
  xpPerPlayer: number;
  partySize: number;
}

// --- Data Tables ---

/** DMG p.82 — XP thresholds per character level (1-indexed, index 0 unused) */
const XP_THRESHOLDS: readonly XPThresholds[] = [
  { easy: 0, medium: 0, hard: 0, deadly: 0 },       // 0 — unused
  { easy: 25, medium: 50, hard: 75, deadly: 100 },   // 1
  { easy: 50, medium: 100, hard: 150, deadly: 200 }, // 2
  { easy: 75, medium: 150, hard: 225, deadly: 400 }, // 3
  { easy: 125, medium: 250, hard: 375, deadly: 500 },// 4
  { easy: 250, medium: 500, hard: 750, deadly: 1100 },// 5
  { easy: 300, medium: 600, hard: 900, deadly: 1400 },// 6
  { easy: 350, medium: 750, hard: 1100, deadly: 1700 },// 7
  { easy: 450, medium: 900, hard: 1400, deadly: 2100 },// 8
  { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },// 9
  { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },// 10
  { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },// 11
  { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },// 12
  { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },// 13
  { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },// 14
  { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },// 15
  { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },// 16
  { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },// 17
  { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },// 18
  { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },// 19
  { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },// 20
];

/** CR → XP mapping (DMG p.274) */
const CR_TO_XP: ReadonlyMap<number, number> = new Map([
  [0, 10],
  [0.125, 25],
  [0.25, 50],
  [0.5, 100],
  [1, 200],
  [2, 450],
  [3, 700],
  [4, 1100],
  [5, 1800],
  [6, 2300],
  [7, 2900],
  [8, 3900],
  [9, 5000],
  [10, 5900],
  [11, 7200],
  [12, 8400],
  [13, 10000],
  [14, 11500],
  [15, 13000],
  [16, 15000],
  [17, 18000],
  [18, 20000],
  [19, 22000],
  [20, 25000],
  [21, 33000],
  [22, 41000],
  [23, 50000],
  [24, 62000],
  [25, 75000],
  [26, 90000],
  [27, 105000],
  [28, 120000],
  [29, 135000],
  [30, 155000],
]);

/** Encounter multipliers by monster count (DMG p.82) */
const ENCOUNTER_MULTIPLIER_BRACKETS: readonly { maxMonsters: number; multiplier: number }[] = [
  { maxMonsters: 1, multiplier: 1 },
  { maxMonsters: 2, multiplier: 1.5 },
  { maxMonsters: 6, multiplier: 2 },
  { maxMonsters: 10, multiplier: 2.5 },
  { maxMonsters: 14, multiplier: 3 },
  { maxMonsters: Infinity, multiplier: 4 },
];

// --- Core Functions ---

/** Get XP thresholds for a single character level (clamped 1-20). */
export function getXPThresholds(level: number): XPThresholds {
  const clamped = Math.max(1, Math.min(20, Math.floor(level)));
  return { ...XP_THRESHOLDS[clamped] };
}

/** Sum thresholds across an entire party. */
export function getPartyThresholds(partyLevels: number[]): XPThresholds {
  const result: XPThresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const level of partyLevels) {
    const t = getXPThresholds(level);
    result.easy += t.easy;
    result.medium += t.medium;
    result.hard += t.hard;
    result.deadly += t.deadly;
  }
  return result;
}

/** Convert a CR number to its XP value. Returns 0 for unknown CRs. */
export function crToXP(cr: number): number {
  return CR_TO_XP.get(cr) ?? 0;
}

/**
 * Get the encounter multiplier for a given monster count and party size.
 * Adjusts bracket per DMG: parties < 3 shift up one bracket, parties > 5 shift down one.
 */
export function getEncounterMultiplier(monsterCount: number, partySize: number): number {
  if (monsterCount <= 0) return 0;

  let bracketIndex = ENCOUNTER_MULTIPLIER_BRACKETS.findIndex(
    (b) => monsterCount <= b.maxMonsters
  );
  if (bracketIndex === -1) bracketIndex = ENCOUNTER_MULTIPLIER_BRACKETS.length - 1;

  // Party size adjustments
  if (partySize < 3) {
    bracketIndex = Math.min(bracketIndex + 1, ENCOUNTER_MULTIPLIER_BRACKETS.length - 1);
  } else if (partySize > 5) {
    bracketIndex = Math.max(bracketIndex - 1, 0);
  }

  return ENCOUNTER_MULTIPLIER_BRACKETS[bracketIndex].multiplier;
}

/** Calculate encounter difficulty from party levels and monster CRs. */
export function calculateEncounterDifficulty(
  partyLevels: number[],
  monsterCRs: number[]
): EncounterResult {
  const partySize = partyLevels.length;
  const thresholds = getPartyThresholds(partyLevels);
  const rawXP = monsterCRs.reduce((sum, cr) => sum + crToXP(cr), 0);
  const multiplier = getEncounterMultiplier(monsterCRs.length, partySize);
  const adjustedXP = Math.floor(rawXP * multiplier);

  let difficulty: EncounterDifficulty;
  if (adjustedXP >= thresholds.deadly) {
    difficulty = 'deadly';
  } else if (adjustedXP >= thresholds.hard) {
    difficulty = 'hard';
  } else if (adjustedXP >= thresholds.medium) {
    difficulty = 'medium';
  } else if (adjustedXP >= thresholds.easy) {
    difficulty = 'easy';
  } else {
    difficulty = 'trivial';
  }

  return {
    difficulty,
    adjustedXP,
    rawXP,
    multiplier,
    thresholds,
    xpPerPlayer: partySize > 0 ? Math.floor(rawXP / partySize) : 0,
    partySize,
  };
}

/** Get the maximum XP budget for a target difficulty tier. */
export function getEncounterBudget(
  partyLevels: number[],
  difficulty: keyof XPThresholds
): number {
  const thresholds = getPartyThresholds(partyLevels);
  return thresholds[difficulty];
}

// --- Prompt-Facing Functions ---

/** Map difficulty preference to a tier name for display. */
const PREFERENCE_TO_TIER: Record<DifficultyPreference, keyof XPThresholds> = {
  easy: 'easy',
  normal: 'medium',
  hard: 'hard',
  deadly: 'deadly',
};

/** Get recommended CR ranges for each difficulty tier relative to a party. */
export function getRecommendedCRRange(
  partyLevels: number[],
  preference: DifficultyPreference = 'normal'
): { tier: string; minCR: number; maxCR: number; xpBudget: number }[] {
  const thresholds = getPartyThresholds(partyLevels);
  const partySize = partyLevels.length || 1;

  // Build ordered budget ranges
  const tiers: { name: string; min: number; max: number }[] = [
    { name: 'Easy', min: 0, max: thresholds.easy },
    { name: 'Medium', min: thresholds.easy, max: thresholds.medium },
    { name: 'Hard', min: thresholds.medium, max: thresholds.hard },
    { name: 'Deadly', min: thresholds.hard, max: thresholds.deadly },
  ];

  // Shift based on preference
  const targetTier = PREFERENCE_TO_TIER[preference];
  const targetBudget = thresholds[targetTier];

  const crEntries = Array.from(CR_TO_XP.entries()).sort((a, b) => a[0] - b[0]);

  return tiers.map((tier) => {
    // Find CR range that fits within this tier's XP budget (for a single monster vs party)
    const multiplier = getEncounterMultiplier(1, partySize);
    const minCR = crEntries.find(([, xp]) => xp * multiplier >= tier.min)?.[0] ?? 0;
    const maxCR = [...crEntries].reverse().find(([, xp]) => xp * multiplier <= tier.max)?.[0] ?? 0;

    return {
      tier: tier.name + (thresholds[tier.name.toLowerCase() as keyof XPThresholds] === targetBudget ? ' ← TARGET' : ''),
      minCR,
      maxCR,
      xpBudget: tier.max,
    };
  });
}

/** Format a complete encounter calibration block for injection into the AI system prompt. */
export function formatPartyPowerForPrompt(
  partyLevels: number[],
  preference: DifficultyPreference = 'normal'
): string {
  const partySize = partyLevels.length;
  if (partySize === 0) return '';

  const avgLevel = Math.round(partyLevels.reduce((a, b) => a + b, 0) / partySize);
  const thresholds = getPartyThresholds(partyLevels);
  const targetTier = PREFERENCE_TO_TIER[preference];
  const ranges = getRecommendedCRRange(partyLevels, preference);

  const levelStr = partySize === 1
    ? `1 player, Level ${partyLevels[0]}`
    : `${partySize} players, Avg Level ${avgLevel} (${partyLevels.join(', ')})`;

  const tierLines = ranges
    .map((r) => `- ${r.tier}: ≤${r.xpBudget.toLocaleString()} XP (CR ${formatCR(r.minCR)}–${formatCR(r.maxCR)} creatures)`)
    .join('\n');

  const tacticsMap: Record<DifficultyPreference, string> = {
    easy: 'Keep encounters forgiving. Enemies make tactical mistakes, flee early, or fight in small numbers. Focus on narrative momentum over combat pressure.',
    normal: 'Balanced encounters. Enemies use reasonable tactics and present a fair challenge without overwhelming the party.',
    hard: 'Challenging encounters. Enemies use intelligent tactics, exploit terrain, and coordinate attacks. Include environmental hazards or reinforcements to maintain pressure.',
    deadly: 'Brutal encounters. Enemies fight ruthlessly with optimal tactics, action economy advantage, and lethal combinations. Death is a real possibility.',
  };

  return [
    `Party: ${levelStr}`,
    `Difficulty Preference: ${preference.toUpperCase()}`,
    '',
    'XP Budget Targets:',
    tierLines,
    '',
    `Calibrate combat encounters to the ${targetTier.toUpperCase()} tier.`,
    tacticsMap[preference],
  ].join('\n');
}

/** Format a CR number for display (e.g. 0.125 → "1/8"). */
function formatCR(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}
