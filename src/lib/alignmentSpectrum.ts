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
// Uses ACTUAL prompt IDs from characterPrompts.ts, empyreanPrompts.ts, etc.

const PROMPT_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  // Voice & Tone (from characterPrompts.ts)
  'fourth-wall': { law: -3, good: 0 },
  'inappropriate-humor': { law: -4, good: -1 },
  'internal-monologue': { law: -2, good: 0 },

  // Combat (from characterPrompts.ts)
  'creative-kills': { law: -3, good: -4 },
  'tactical-incompetence': { law: -3, good: -1 },
  'banter-mid-combat': { law: -2, good: 0 },

  // Social (from characterPrompts.ts)
  'negotiation-absurdity': { law: -3, good: 0 },
  'selective-morals': { law: -2, good: -1 },
  'alias-addiction': { law: -3, good: -1 },

  // Investigation (from characterPrompts.ts)
  'chaotic-investigation': { law: -3, good: 0 },
  'lateral-thinking': { law: -2, good: 0 },
  'attention-roulette': { law: -3, good: 0 },

  // Emotional (from characterPrompts.ts)
  'mask-slips': { law: 0, good: 1 },
  'unexpected-loyalty': { law: 1, good: 3 },
  'trauma-shield': { law: -1, good: 0 },

  // World (from characterPrompts.ts)
  'property-damage': { law: -4, good: -1 },
  'reputation-dissonance': { law: -2, good: 0 },
  'loot-chaos': { law: -3, good: -1 },

  // Narrative (from characterPrompts.ts)
  'unreliable-narrator': { law: -3, good: 0 },
  'genre-savvy': { law: -2, good: 0 },

  // Meta Requests (from characterPrompts.ts)
  'meta-make-funnier': { law: -3, good: 0 },
  'meta-talk-to-writer': { law: -4, good: 0 },
  'meta-rewind': { law: -2, good: 0 },
  'meta-acknowledge-audience': { law: -3, good: 0 },
  'meta-skip-boring': { law: -2, good: 0 },
  'meta-chaotic-options': { law: -5, good: -1 },
  'meta-nerf-me': { law: 1, good: 1 },
  'meta-dramatic-irony': { law: -1, good: 0 },
  'meta-musical-number': { law: -3, good: 1 },
  'meta-morally-ambiguous': { law: 0, good: 0 },
  'meta-terrible-idea': { law: -4, good: -1 },
  'meta-comic-relief': { law: -3, good: 0 },
  'meta-fail-forward': { law: -1, good: 1 },
  'meta-plot-hole': { law: -3, good: 0 },
  'meta-nemesis': { law: -2, good: -1 },
  'meta-injuries-hilarious': { law: -3, good: -1 },
  'meta-morality-pet': { law: 0, good: 3 },
  'meta-unreliable-protagonist': { law: -3, good: 0 },
  'meta-sad-backstory': { law: 0, good: 1 },
  'meta-voice-of-reason': { law: 2, good: 1 },
  'meta-dm-for-5-minutes': { law: -3, good: 0 },
  'meta-trolley-problem': { law: 0, good: 0 },
  'meta-npc-hates-me': { law: -2, good: -1 },
  'meta-serious-moment': { law: 0, good: 2 },
  'meta-what-if-not': { law: -4, good: 0 },
  'meta-nature-documentary': { law: -2, good: 0 },
  'meta-dramatic-backfire': { law: -3, good: 0 },
  'meta-montage': { law: 0, good: 0 },
  'meta-weapons-argue': { law: -3, good: 0 },
  'meta-worst-case': { law: -3, good: -1 },
  'meta-negotiate-dice': { law: -3, good: 0 },
  'meta-unkillable-inconvenienced': { law: -2, good: 0 },
  'meta-worthy-opponent': { law: -2, good: 0 },
  'meta-crowdsource': { law: -1, good: 0 },
  'meta-break-game': { law: -4, good: 0 },
  'meta-villain-therapist': { law: -1, good: 2 },
  'meta-crossover': { law: -4, good: 0 },
  'meta-crisis-faith-dm': { law: -3, good: 0 },
  'meta-special-episode': { law: -2, good: 1 },
  'meta-see-behind-curtain': { law: -2, good: 0 },
  'meta-fail-successfully': { law: -1, good: 0 },
  'meta-bottle-episode': { law: 0, good: 0 },
  'meta-straight-man': { law: 2, good: 0 },
  'meta-choose-adventure': { law: 0, good: 0 },
};

// Empyrean prompt alignment map — uses ACTUAL IDs from empyreanPrompts.ts
const EMPYREAN_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  // Dragon Bond
  'emp-dragon-conscription': { law: 0, good: 2 },
  'emp-dragon-threshing': { law: -1, good: 1 },
  'emp-dragon-bonding': { law: 1, good: 3 },
  'emp-dragon-flight': { law: -2, good: 0 },
  'emp-dragon-injury': { law: 0, good: 2 },
  'emp-dragon-second': { law: -1, good: -1 },
  'emp-dragon-disagree': { law: 2, good: 3 },
  'emp-dragon-hatching': { law: -2, good: 1 },

  // Signet Abilities
  'emp-signet-manifest': { law: 0, good: 0 },
  'emp-signet-overreach': { law: -1, good: -2 },
  'emp-signet-training': { law: 1, good: 1 },
  'emp-signet-combo': { law: -3, good: -1 },
  'emp-signet-malfunction': { law: -2, good: -2 },
  'emp-signet-conceal': { law: -2, good: -1 },
  'emp-signet-evolve': { law: 2, good: 2 },

  // Basgiath War College
  'emp-basgiath-gauntlet': { law: 4, good: 1 },
  'emp-basgiath-brief': { law: 3, good: -1 },
  'emp-basgiath-mess': { law: 2, good: 0 },
  'emp-basgiath-spar': { law: 2, good: 2 },
  'emp-basgiath-wargames': { law: 5, good: 0 },
  'emp-basgiath-summons': { law: 4, good: -2 },
  'emp-basgiath-archives': { law: -1, good: 0 },
  'emp-basgiath-leadership': { law: 3, good: 1 },

  // Venin and Dark Forces
  'emp-venin-first': { law: -3, good: -4 },
  'emp-venin-wyvern': { law: -4, good: -3 },
  'emp-venin-ward': { law: -2, good: -5 },
  'emp-venin-temptation': { law: -1, good: -3 },
  'emp-venin-intel': { law: -3, good: -2 },
  'emp-venin-infected': { law: -5, good: -4 },
  'emp-venin-beyond': { law: -2, good: -3 },

  // Relationships and Politics
  'emp-rel-alliance': { law: -2, good: 1 },
  'emp-rel-romantic': { law: -1, good: 1 },
  'emp-rel-betrayal': { law: -3, good: -2 },
  'emp-rel-legacy': { law: 3, good: 0 },
  'emp-rel-cross': { law: -1, good: 2 },
  'emp-rel-loyalty': { law: 1, good: 3 },
  'emp-rel-powerplay': { law: 4, good: -1 },
  'emp-rel-truth': { law: -2, good: 2 },

  // Combat and Survival
  'emp-combat-ambush': { law: 1, good: 0 },
  'emp-combat-defense': { law: 3, good: 1 },
  'emp-combat-recon': { law: -1, good: 0 },
  'emp-combat-retreat': { law: 0, good: 3 },
  'emp-combat-dogfight': { law: -1, good: -1 },
  'emp-combat-grounded': { law: 0, good: -1 },
  'emp-combat-last': { law: 1, good: 2 },

  // Meta and Narrative
  'emp-meta-dragon-pov': { law: 0, good: 1 },
  'emp-meta-history': { law: -1, good: 0 },
  'emp-meta-dream': { law: -1, good: 0 },
  'emp-meta-montage': { law: 0, good: 0 },
  'emp-meta-codex': { law: 2, good: 0 },
  'emp-meta-villain-pov': { law: -1, good: -1 },
  'emp-meta-scribe-account': { law: 2, good: 0 },
  'emp-meta-campfire': { law: 0, good: 2 },
  'emp-meta-what-if': { law: -1, good: 0 },
  'emp-meta-bystander': { law: 0, good: 0 },
  'emp-meta-fourth-wall': { law: -3, good: 0 },
  'emp-meta-post-credits': { law: 0, good: 0 },
  'emp-meta-narrator-lies': { law: -2, good: 0 },
  'emp-meta-enemy-debrief': { law: -1, good: -2 },
  'emp-meta-parallel': { law: 0, good: 0 },

  // Forbidden Lore
  'emp-lore-cipher': { law: -3, good: -3 },
  'emp-lore-burned': { law: -4, good: -3 },
  'emp-lore-thesis': { law: -2, good: -4 },
  'emp-lore-memory-stone': { law: -2, good: -2 },
  'emp-lore-heretic-map': { law: -3, good: -2 },
  'emp-lore-living-doc': { law: -3, good: -1 },
  'emp-lore-price': { law: -5, good: -4 },
  'emp-lore-oral': { law: -2, good: -1 },
  'emp-lore-redacted': { law: -4, good: -3 },

  // Dragon Bond — NEW
  'emp-dragon-council': { law: 2, good: 1 },
  'emp-dragon-grooming': { law: 1, good: 3 },
  'emp-dragon-ancient-memory': { law: 0, good: 1 },
  'emp-dragon-rivalry': { law: -1, good: -1 },
  'emp-dragon-feeding': { law: -2, good: -2 },
  'emp-dragon-humor': { law: -2, good: 2 },
  'emp-dragon-den': { law: 0, good: 2 },

  // Signet Abilities — NEW
  'emp-signet-resonance': { law: 0, good: 1 },
  'emp-signet-oath': { law: 3, good: 0 },
  'emp-signet-null': { law: 0, good: -1 },
  'emp-signet-inheritance': { law: 1, good: 1 },
  'emp-signet-weaponize': { law: 2, good: -3 },
  'emp-signet-bleed': { law: -2, good: -2 },
  'emp-signet-duel': { law: 1, good: 0 },

  // Basgiath War College — NEW
  'emp-basgiath-night-exam': { law: 4, good: 0 },
  'emp-basgiath-transfer': { law: 2, good: 0 },
  'emp-basgiath-instructor-secret': { law: -1, good: 1 },
  'emp-basgiath-infirmary': { law: 0, good: 1 },
  'emp-basgiath-graduation': { law: 3, good: 1 },
  'emp-basgiath-black-market': { law: -3, good: -1 },
  'emp-basgiath-riot': { law: -4, good: -2 },

  // Venin and Dark Forces — NEW
  'emp-venin-trap': { law: -3, good: -3 },
  'emp-venin-turned-friend': { law: -2, good: -3 },
  'emp-venin-corruption-creep': { law: -3, good: -4 },
  'emp-venin-nest': { law: -4, good: -4 },
  'emp-venin-dark-witness': { law: -3, good: -2 },
  'emp-venin-wyvern-taming': { law: -2, good: 1 },
  'emp-venin-sage': { law: -1, good: -1 },

  // Relationships and Politics — NEW
  'emp-rel-ex': { law: -1, good: 1 },
  'emp-rel-marriage': { law: 3, good: 0 },
  'emp-rel-squad-fracture': { law: -2, good: -1 },
  'emp-rel-mentor-fall': { law: -1, good: 1 },
  'emp-rel-enemy-respect': { law: 1, good: 2 },
  'emp-rel-correspondence': { law: -2, good: -1 },
  'emp-rel-favor': { law: 2, good: -2 },

  // Combat and Survival — NEW
  'emp-combat-night-raid': { law: -2, good: -1 },
  'emp-combat-siege': { law: 2, good: 0 },
  'emp-combat-honor-duel': { law: 3, good: 1 },
  'emp-combat-false-flag': { law: -3, good: -3 },
  'emp-combat-multi-wing': { law: 3, good: 0 },
  'emp-combat-assassination': { law: -4, good: -3 },
  'emp-combat-no-magic': { law: 1, good: 0 },
};

// ── DM Quick Actions ──
const DM_ACTION_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  'dm-combat-encounter': { law: 0, good: -1 },
  'dm-explore-dungeon': { law: 1, good: 0 },
  'dm-visit-tavern': { law: 0, good: 1 },
  'dm-wilderness-journey': { law: 0, good: 0 },
  'dm-mystery-quest': { law: 1, good: 1 },
  'dm-look-around': { law: 1, good: 0 },
  'dm-attack': { law: -1, good: -2 },
  'dm-talk-npc': { law: 1, good: 2 },
  'dm-check-traps': { law: 2, good: 0 },
  'dm-cast-spell': { law: 0, good: 0 },
  'dm-stealth': { law: -2, good: 0 },
  'dm-investigate': { law: 2, good: 1 },
  'dm-rest': { law: 1, good: 1 },
};

// ── Geralt Prompts ──
const GERALT_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  // Disdain
  'disdain-1': { law: -1, good: -2 }, 'disdain-2': { law: -2, good: -1 },
  'disdain-3': { law: -1, good: -1 }, 'disdain-4': { law: -2, good: -2 },
  'disdain-5': { law: -1, good: -3 }, 'disdain-6': { law: -3, good: -1 },
  'disdain-7': { law: -2, good: -2 }, 'disdain-8': { law: -1, good: -1 },
  'disdain-9': { law: -2, good: -3 },
  // Affection
  'affection-1': { law: 1, good: 3 }, 'affection-2': { law: 0, good: 4 },
  'affection-3': { law: 1, good: 2 }, 'affection-4': { law: -1, good: 3 },
  'affection-5': { law: 0, good: 5 }, 'affection-6': { law: 1, good: 4 },
  'affection-7': { law: 0, good: 3 }, 'affection-8': { law: -1, good: 2 },
  'affection-9': { law: 0, good: 3 },
  // Hunting
  'hunting-1': { law: -2, good: -3 }, 'hunting-2': { law: -3, good: -2 },
  'hunting-3': { law: -1, good: -4 }, 'hunting-4': { law: -2, good: -2 },
  'hunting-5': { law: -3, good: -3 }, 'hunting-6': { law: -1, good: -2 },
  'hunting-7': { law: -4, good: -3 }, 'hunting-8': { law: -2, good: -1 },
  'hunting-9': { law: -2, good: -3 },
  // Preening
  'preening-1': { law: 0, good: 0 }, 'preening-2': { law: -1, good: -1 },
  'preening-3': { law: 0, good: 0 }, 'preening-4': { law: -1, good: 0 },
  'preening-5': { law: 0, good: -1 }, 'preening-6': { law: -1, good: 0 },
  'preening-7': { law: 0, good: 0 }, 'preening-8': { law: -1, good: -1 },
  // Chaos
  'chaos-1': { law: -4, good: -1 }, 'chaos-2': { law: -5, good: -2 },
  'chaos-3': { law: -3, good: 0 }, 'chaos-4': { law: -4, good: -3 },
  'chaos-5': { law: -5, good: -1 }, 'chaos-6': { law: -3, good: -2 },
  'chaos-7': { law: -4, good: -1 }, 'chaos-8': { law: -5, good: -3 },
  'chaos-9': { law: -4, good: -2 },
  // Nap & Territory
  'nap-1': { law: 1, good: 0 }, 'nap-2': { law: 0, good: 0 },
  'nap-3': { law: -1, good: 0 }, 'nap-4': { law: 0, good: 1 },
  'nap-5': { law: 1, good: 0 }, 'nap-6': { law: -1, good: -1 },
  'nap-7': { law: 0, good: 0 }, 'nap-8': { law: 1, good: 0 },
  'nap-9': { law: 0, good: 0 },
  // Battle
  'battle-1': { law: -1, good: -2 }, 'battle-2': { law: 0, good: 2 },
  'battle-3': { law: -3, good: -4 }, 'battle-4': { law: -2, good: -1 },
  'battle-5': { law: 1, good: 3 }, 'battle-6': { law: -2, good: -3 },
  'battle-7': { law: -1, good: -1 }, 'battle-8': { law: 0, good: 1 },
  // Social
  'social-1': { law: -2, good: -1 }, 'social-2': { law: -1, good: 0 },
  'social-3': { law: -3, good: -2 }, 'social-4': { law: 0, good: 1 },
  'social-5': { law: -2, good: -1 }, 'social-6': { law: -1, good: -2 },
  'social-7': { law: -3, good: -1 }, 'social-8': { law: -2, good: 0 },
  // Environment
  'environment-1': { law: 0, good: 0 }, 'environment-2': { law: 0, good: 1 },
  'environment-3': { law: -1, good: -1 }, 'environment-4': { law: 1, good: 0 },
  'environment-5': { law: 0, good: 0 }, 'environment-6': { law: -1, good: 0 },
  'environment-7': { law: 0, good: 1 }, 'environment-8': { law: 1, good: 0 },
  // Party Dynamics
  'party-1': { law: -2, good: -1 }, 'party-2': { law: -1, good: 1 },
  'party-3': { law: -3, good: -2 }, 'party-4': { law: 0, good: 2 },
  'party-5': { law: -2, good: 0 }, 'party-6': { law: -1, good: -1 },
  'party-7': { law: -2, good: -2 }, 'party-8': { law: -1, good: 0 },
};

// ── Dice Roller Prompts ──
const DICE_ROLLER_ALIGNMENT_MAP: Record<string, AlignmentScore> = {
  'describe_attack': { law: -1, good: -2 },
  'describe_damage': { law: -2, good: -3 },
  'enemy_reaction': { law: 0, good: -1 },
  'perception_check': { law: 1, good: 0 },
  'investigate_area': { law: 2, good: 1 },
  'environment_description': { law: 0, good: 0 },
  'persuasion_outcome': { law: 1, good: 1 },
  'deception_outcome': { law: -3, good: -2 },
  'intimidation_outcome': { law: -1, good: -2 },
  'stealth_result': { law: -2, good: 0 },
  'luck_moment': { law: -1, good: 1 },
  'generic_outcome': { law: 0, good: 0 },
};

// ── Prefix-based alignment inference for Infinity Stone prompts ──
// Covers the 200+ soul-*, reality-*, power-*, time-*, mind-*, space-* prompts
const PREFIX_ALIGNMENT_RULES: Array<{ prefix: string; score: AlignmentScore }> = [
  // Soul Stone — emotional/social
  { prefix: 'soul-mild-', score: { law: 0, good: 2 } },
  { prefix: 'soul-moderate-', score: { law: 0, good: 1 } },
  { prefix: 'soul-extreme-', score: { law: 0, good: 0 } },
  { prefix: 'soul-generic-', score: { law: 0, good: 1 } },
  // Reality Stone — world interaction
  { prefix: 'reality-mild-', score: { law: 0, good: 0 } },
  { prefix: 'reality-moderate-', score: { law: 1, good: -1 } },
  { prefix: 'reality-extreme-', score: { law: -1, good: -2 } },
  { prefix: 'reality-agnostic-', score: { law: 0, good: 0 } },
  // Power Stone — combat/force
  { prefix: 'power-mild-', score: { law: 0, good: -1 } },
  { prefix: 'power-moderate-', score: { law: -1, good: -2 } },
  { prefix: 'power-extreme-', score: { law: -2, good: -3 } },
  { prefix: 'power-agnostic-', score: { law: -1, good: -1 } },
  // Time Stone — meta/fourth wall
  { prefix: 'time-mild-', score: { law: -1, good: 0 } },
  { prefix: 'time-moderate-', score: { law: -2, good: 0 } },
  { prefix: 'time-extreme-', score: { law: -3, good: 0 } },
  { prefix: 'time-agnostic-', score: { law: -2, good: 0 } },
  // Mind Stone — investigation/insight
  { prefix: 'mind-mild-', score: { law: 1, good: 0 } },
  { prefix: 'mind-moderate-', score: { law: 2, good: 0 } },
  { prefix: 'mind-extreme-', score: { law: 1, good: -1 } },
  { prefix: 'mind-agnostic-', score: { law: 1, good: 0 } },
  // Space Stone — voice/tone/narrative
  { prefix: 'space-mild-', score: { law: -1, good: 0 } },
  { prefix: 'space-moderate-', score: { law: -2, good: 0 } },
  { prefix: 'space-extreme-', score: { law: -3, good: -1 } },
  { prefix: 'space-agnostic-', score: { law: -1, good: 0 } },
];

function getAlignmentByPrefix(promptId: string): AlignmentScore | null {
  for (const rule of PREFIX_ALIGNMENT_RULES) {
    if (promptId.startsWith(rule.prefix)) return rule.score;
  }
  return null;
}

/** Get alignment score for a prompt by ID. Returns null if unscored. */
export function getPromptAlignment(promptId: string): AlignmentScore | null {
  return (
    PROMPT_ALIGNMENT_MAP[promptId] ??
    EMPYREAN_ALIGNMENT_MAP[promptId] ??
    DM_ACTION_ALIGNMENT_MAP[promptId] ??
    GERALT_ALIGNMENT_MAP[promptId] ??
    DICE_ROLLER_ALIGNMENT_MAP[promptId] ??
    getAlignmentByPrefix(promptId) ??
    null
  );
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
