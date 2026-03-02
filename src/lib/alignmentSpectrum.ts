// Alignment Spectrum System — Two-axis continuous scoring
// Law ↔ Chaos: -5 to +5
// Good ↔ Evil: -5 to +5

export interface AlignmentScore {
  law: number;   // -5 (chaotic) to +5 (lawful)
  good: number;  // -5 (evil) to +5 (good)
}

export interface AlignmentZone {
  id: string;
  label: string;
  shortLabel: string;
  emoji: string;
  color: string;       // tailwind class for text color
  cssColor: string;    // actual CSS color value for inline styles
  bgColor: string;
  lawRange: [number, number];
  goodRange: [number, number];
}

export const ALIGNMENT_ZONES: AlignmentZone[] = [
  // Row 1 (top): Good
  { id: 'cg', label: 'Chaotic Good',   shortLabel: 'CG', emoji: '🌿', color: 'text-emerald-400', cssColor: '#34d399', bgColor: 'bg-emerald-500/15', lawRange: [-5, -1.67], goodRange: [1.67, 5] },
  { id: 'ng', label: 'Neutral Good',   shortLabel: 'NG', emoji: '🌟', color: 'text-amber-300',   cssColor: '#fcd34d', bgColor: 'bg-amber-500/15',   lawRange: [-1.67, 1.67], goodRange: [1.67, 5] },
  { id: 'lg', label: 'Lawful Good',    shortLabel: 'LG', emoji: '⚜️', color: 'text-sky-400',     cssColor: '#38bdf8', bgColor: 'bg-sky-500/15',     lawRange: [1.67, 5], goodRange: [1.67, 5] },
  // Row 2 (middle): Neutral
  { id: 'cn', label: 'Chaotic Neutral', shortLabel: 'CN', emoji: '🎲', color: 'text-purple-400', cssColor: '#c084fc', bgColor: 'bg-purple-500/15', lawRange: [-5, -1.67], goodRange: [-1.67, 1.67] },
  { id: 'tn', label: 'True Neutral',    shortLabel: 'TN', emoji: '⚖️', color: 'text-gray-400',   cssColor: '#9ca3af', bgColor: 'bg-gray-500/15',   lawRange: [-1.67, 1.67], goodRange: [-1.67, 1.67] },
  { id: 'ln', label: 'Lawful Neutral',  shortLabel: 'LN', emoji: '📜', color: 'text-blue-400',   cssColor: '#60a5fa', bgColor: 'bg-blue-500/15',   lawRange: [1.67, 5], goodRange: [-1.67, 1.67] },
  // Row 3 (bottom): Evil
  { id: 'ce', label: 'Chaotic Evil',   shortLabel: 'CE', emoji: '💀', color: 'text-red-500',    cssColor: '#ef4444', bgColor: 'bg-red-500/15',    lawRange: [-5, -1.67], goodRange: [-5, -1.67] },
  { id: 'ne', label: 'Neutral Evil',   shortLabel: 'NE', emoji: '🐍', color: 'text-rose-400',   cssColor: '#fb7185', bgColor: 'bg-rose-500/15',   lawRange: [-1.67, 1.67], goodRange: [-5, -1.67] },
  { id: 'le', label: 'Lawful Evil',    shortLabel: 'LE', emoji: '👑', color: 'text-indigo-400', cssColor: '#818cf8', bgColor: 'bg-indigo-500/15', lawRange: [1.67, 5], goodRange: [-5, -1.67] },
];

/** Get the alignment zone for a given score */
export function getAlignmentZone(score: AlignmentScore): AlignmentZone {
  for (const zone of ALIGNMENT_ZONES) {
    if (
      score.law >= zone.lawRange[0] && score.law <= zone.lawRange[1] &&
      score.good >= zone.goodRange[0] && score.good <= zone.goodRange[1]
    ) {
      return zone;
    }
  }
  // Fallback: true neutral
  return ALIGNMENT_ZONES.find(z => z.id === 'tn')!;
}

/** Euclidean distance between two alignment scores */
export function alignmentDistance(a: AlignmentScore, b: AlignmentScore): number {
  return Math.sqrt((a.law - b.law) ** 2 + (a.good - b.good) ** 2);
}

/** Check if a prompt's alignment is close enough to be considered a match (distance ≤ 4) */
export function isAlignmentMatch(
  promptAlignment: AlignmentScore | null,
  target: AlignmentScore,
  threshold = 4,
): boolean {
  if (!promptAlignment) return false;
  return alignmentDistance(promptAlignment, target) <= threshold;
}

// ── Prompt alignment scoring map ──
// Maps prompt IDs to their alignment scores
// This is the static data that tags each prompt with its moral/ethical leaning

const PROMPT_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  // Voice & Tone
  'fourth-wall': { law: -3, good: 0 },
  'inappropriate-humor': { law: -4, good: -1 },
  'dark-humor': { law: -2, good: -2 },
  'sarcastic-narrator': { law: -2, good: 0 },
  'deadpan-delivery': { law: 0, good: 0 },
  'dramatic-monologue': { law: 1, good: 0 },
  'poetic-speech': { law: 2, good: 1 },
  'crude-language': { law: -4, good: -2 },

  // Combat
  'creative-kills': { law: -3, good: -4 },
  'mercy-strikes': { law: 2, good: 4 },
  'tactical-analysis': { law: 4, good: 0 },
  'berserker-rage': { law: -4, good: -2 },
  'defensive-stance': { law: 3, good: 1 },
  'sneak-attack': { law: -3, good: -1 },
  'honorable-duel': { law: 5, good: 2 },
  'dirty-fighting': { law: -4, good: -3 },
  'protect-allies': { law: 2, good: 5 },
  'battlefield-commander': { law: 5, good: 1 },
  'assassination': { law: -2, good: -5 },
  'non-lethal': { law: 3, good: 4 },

  // Social
  'intimidation': { law: -1, good: -2 },
  'persuasion': { law: 1, good: 1 },
  'deception': { law: -3, good: -2 },
  'diplomacy': { law: 4, good: 3 },
  'seduction': { law: -2, good: -1 },
  'bartering': { law: 1, good: 0 },
  'loyalty-oath': { law: 4, good: 3 },
  'betrayal': { law: -5, good: -4 },
  'confession': { law: 2, good: 3 },
  'blackmail': { law: -3, good: -4 },

  // Emotional
  'inner-conflict': { law: 0, good: 0 },
  'romantic-tension': { law: -1, good: 1 },
  'grief-processing': { law: 0, good: 2 },
  'rage-outburst': { law: -3, good: -1 },
  'compassion': { law: 1, good: 5 },
  'jealousy': { law: -1, good: -2 },
  'forgiveness': { law: 2, good: 4 },
  'vengeance': { law: -2, good: -4 },
  'fear-response': { law: 0, good: 0 },
  'self-sacrifice': { law: 1, good: 5 },

  // Investigation
  'perception-check': { law: 0, good: 0 },
  'insight-read': { law: 1, good: 1 },
  'evidence-search': { law: 3, good: 1 },
  'interrogation': { law: 2, good: -1 },
  'stealth-recon': { law: -2, good: 0 },
  'tracking': { law: 1, good: 0 },
  'lore-check': { law: 2, good: 0 },
  'trap-detection': { law: 1, good: 1 },

  // Meta Requests
  'session-recap': { law: 2, good: 0 },
  'time-skip': { law: 0, good: 0 },
  'flashback': { law: 0, good: 0 },
  'dream-sequence': { law: -1, good: 0 },
  'tavern-scene': { law: -1, good: 1 },
  'campfire-moment': { law: 0, good: 2 },
  'shopping-spree': { law: 1, good: 0 },
  'downtime-activity': { law: 2, good: 1 },

  // World
  'describe-environment': { law: 0, good: 0 },
  'weather-mood': { law: 0, good: 0 },
  'npc-introduction': { law: 0, good: 0 },
  'world-history': { law: 3, good: 0 },
  'divine-intervention': { law: 4, good: 3 },
  'dark-ritual': { law: -3, good: -5 },
  'natural-disaster': { law: 0, good: 0 },
  'political-intrigue': { law: 3, good: -1 },

  // Narrative
  'plot-twist': { law: -2, good: 0 },
  'character-development': { law: 0, good: 1 },
  'dramatic-entrance': { law: -2, good: 0 },
  'epic-monologue': { law: 1, good: 0 },
  'cliffhanger': { law: 0, good: 0 },
  'revelation': { law: 1, good: 0 },
  'foreshadowing': { law: 2, good: 0 },
  'tragic-backstory': { law: 0, good: 1 },

  // Masterwork
  'masterwork-craft': { law: 3, good: 1 },
  'legendary-weapon': { law: 2, good: 0 },
  'ancient-artifact': { law: 0, good: 0 },
  'forbidden-knowledge': { law: -2, good: -3 },
  'divine-blessing': { law: 4, good: 4 },
  'dark-pact': { law: -3, good: -4 },
  'heroic-sacrifice': { law: 1, good: 5 },
  'villain-monologue': { law: 2, good: -4 },
};

// Empyrean prompt alignment map
const EMPYREAN_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  // Dragon Bond
  'emp-dragon-bond-1': { law: 0, good: 2 },
  'emp-dragon-bond-2': { law: -1, good: 1 },
  'emp-dragon-bond-3': { law: 1, good: 3 },
  'emp-dragon-bond-4': { law: -2, good: 0 },
  'emp-dragon-bond-5': { law: 0, good: 2 },
  'emp-dragon-bond-6': { law: -1, good: -1 },
  'emp-dragon-bond-7': { law: 2, good: 3 },
  'emp-dragon-bond-8': { law: -2, good: 1 },

  // Signet Abilities
  'emp-signet-1': { law: 0, good: 0 },
  'emp-signet-2': { law: -1, good: -2 },
  'emp-signet-3': { law: 1, good: 1 },
  'emp-signet-4': { law: -3, good: -1 },
  'emp-signet-5': { law: 2, good: 2 },
  'emp-signet-6': { law: -2, good: -3 },

  // Basgiath War College
  'emp-basgiath-1': { law: 4, good: 1 },
  'emp-basgiath-2': { law: 3, good: -1 },
  'emp-basgiath-3': { law: 5, good: 0 },
  'emp-basgiath-4': { law: 2, good: 2 },
  'emp-basgiath-5': { law: 4, good: -2 },
  'emp-basgiath-6': { law: 3, good: 1 },

  // Venin and Dark Forces
  'emp-venin-1': { law: -3, good: -4 },
  'emp-venin-2': { law: -4, good: -3 },
  'emp-venin-3': { law: -2, good: -5 },
  'emp-venin-4': { law: -1, good: -3 },
  'emp-venin-5': { law: -3, good: -2 },
  'emp-venin-6': { law: -5, good: -4 },
  'emp-venin-7': { law: -2, good: -3 },

  // Relationships and Politics
  'emp-relations-1': { law: 2, good: 2 },
  'emp-relations-2': { law: -1, good: 1 },
  'emp-relations-3': { law: 3, good: -1 },
  'emp-relations-4': { law: 1, good: 3 },
  'emp-relations-5': { law: -2, good: -1 },
  'emp-relations-6': { law: 4, good: 0 },
  'emp-relations-7': { law: 0, good: 2 },

  // Combat and Survival
  'emp-combat-1': { law: 1, good: 0 },
  'emp-combat-2': { law: -2, good: -1 },
  'emp-combat-3': { law: 3, good: 1 },
  'emp-combat-4': { law: -1, good: -2 },
  'emp-combat-5': { law: 2, good: 2 },
  'emp-combat-6': { law: 0, good: -1 },

  // Meta and Narrative
  'emp-meta-1': { law: 0, good: 0 },
  'emp-meta-2': { law: -1, good: 0 },
  'emp-meta-3': { law: 1, good: 1 },
  'emp-meta-4': { law: 0, good: 0 },
  'emp-meta-5': { law: -2, good: 0 },
  'emp-meta-6': { law: 1, good: 0 },

  // Forbidden Lore
  'emp-forbidden-1': { law: -3, good: -4 },
  'emp-forbidden-2': { law: -4, good: -3 },
  'emp-forbidden-3': { law: -2, good: -5 },
  'emp-forbidden-4': { law: -5, good: -4 },
  'emp-forbidden-5': { law: -3, good: -3 },
};

/** Get alignment score for a prompt by ID. Returns null if unscored. */
export function getPromptAlignment(promptId: string): AlignmentScore | null {
  return PROMPT_ALIGNMENT_MAP[promptId] ?? EMPYREAN_ALIGNMENT_MAP[promptId] ?? null;
}

/** Sort prompts by proximity to a target alignment. Closer = first. */
export function sortByAlignmentProximity<T extends { id: string }>(
  prompts: T[],
  target: AlignmentScore,
): T[] {
  return [...prompts].sort((a, b) => {
    const alignA = getPromptAlignment(a.id);
    const alignB = getPromptAlignment(b.id);
    const distA = alignA ? alignmentDistance(alignA, target) : 999;
    const distB = alignB ? alignmentDistance(alignB, target) : 999;
    return distA - distB;
  });
}

/** Parse a zone ID (like 'cg', 'le') into its center alignment score */
export function zoneIdToScore(zoneId: string): AlignmentScore | null {
  const zone = ALIGNMENT_ZONES.find(z => z.id === zoneId);
  if (!zone) return null;
  return {
    law: (zone.lawRange[0] + zone.lawRange[1]) / 2,
    good: (zone.goodRange[0] + zone.goodRange[1]) / 2,
  };
}
