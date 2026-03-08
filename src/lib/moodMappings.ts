import { CharacterPrompt } from './characterPrompts';

export interface MoodCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  promptIds: string[];
}

/**
 * Theatrical Acts — 6 mood categories that cross-cut all stones.
 * Each maps to curated prompt IDs. Prompts can appear in multiple moods.
 */
export const moodCategories: MoodCategory[] = [
  {
    id: 'comedy',
    name: 'Comedy',
    emoji: '🎭',
    color: '#eab308',
    description: 'Inject humor, absurdity, and slapstick into the scene',
    promptIds: [
      // Voice & Tone
      'fourth-wall', 'inappropriate-humor', 'internal-monologue',
      // Combat
      'banter-mid-combat', 'tactical-incompetence',
      // Social
      'negotiation-absurdity', 'alias-addiction',
      // Investigation
      'attention-roulette',
      // World
      'reputation-dissonance', 'loot-chaos',
      // Meta
      'meta-make-funnier', 'meta-comic-relief', 'meta-musical-number',
      'meta-nature-documentary', 'meta-straight-man', 'meta-injuries-hilarious',
      'meta-acknowledge-audience', 'meta-unreliable-protagonist',
      // Narrative
      'unreliable-narrator',
    ],
  },
  {
    id: 'tragedy',
    name: 'Tragedy',
    emoji: '🗡️',
    color: '#ef4444',
    description: 'Explore loss, consequence, and the weight of your choices',
    promptIds: [
      // Soul Stone — deep emotion
      'soul-moderate-2', 'soul-moderate-4', 'soul-extreme-2', 'soul-extreme-3',
      'soul-extreme-4', 'soul-extreme-5', 'soul-extreme-7', 'soul-extreme-9',
      'soul-generic-1', 'soul-generic-3',
      // Reality Stone — consequences
      'reality-extreme-1', 'reality-moderate-2', 'reality-moderate-3',
      'reality-agnostic-6', 'reality-agnostic-15',
      // Emotional originals
      'mask-slips', 'trauma-shield',
      // Meta — rare serious beats
      'meta-sad-backstory', 'meta-serious-moment',
      // Power
      'power-extreme-3',
    ],
  },
  {
    id: 'intrigue',
    name: 'Intrigue',
    emoji: '🔍',
    color: '#3b82f6',
    description: 'Investigate, deduce, and uncover hidden truths',
    promptIds: [
      // Mind Stone
      'mind-mild-1', 'mind-mild-2', 'mind-mild-3',
      'mind-moderate-1', 'mind-moderate-2', 'mind-moderate-3',
      'mind-extreme-1', 'mind-extreme-2', 'mind-extreme-3',
      'mind-agnostic-1', 'mind-agnostic-2', 'mind-agnostic-5',
      'mind-agnostic-8', 'mind-agnostic-12', 'mind-agnostic-15',
      // Investigation originals
      'chaotic-investigation', 'lateral-thinking',
      // Masterwork — Intelligence
      'masterwork-truth-reconstructor', 'masterwork-pattern-prophet',
      'masterwork-echo-reader', 'masterwork-inverse-analyst',
    ],
  },
  {
    id: 'drama',
    name: 'Drama',
    emoji: '💔',
    color: '#f97316',
    description: 'Emotional depth, relationships, and vulnerable moments',
    promptIds: [
      // Soul Stone — emotional range
      'soul-mild-1', 'soul-mild-3', 'soul-mild-5', 'soul-mild-8',
      'soul-moderate-1', 'soul-moderate-3',
      'soul-extreme-1', 'soul-extreme-6', 'soul-extreme-8',
      'soul-generic-2', 'soul-generic-4', 'soul-generic-5',
      'soul-generic-9', 'soul-generic-10',
      // Emotional originals
      'unexpected-loyalty',
      // Social originals
      'selective-morals',
      // Meta — character depth
      'meta-morality-pet', 'meta-morally-ambiguous',
      // Masterwork — Art & Healing
      'masterwork-wound-alchemist', 'masterwork-soul-mender',
      'masterwork-harmony-forger',
    ],
  },
  {
    id: 'spectacle',
    name: 'Spectacle',
    emoji: '⚡',
    color: '#a855f7',
    description: 'Epic combat, dramatic power displays, and cinematic moments',
    promptIds: [
      // Power Stone
      'power-mild-1', 'power-mild-3',
      'power-moderate-1', 'power-moderate-2',
      'power-extreme-1', 'power-extreme-2', 'power-extreme-3',
      // Combat originals
      'creative-kills',
      // Narrative / Space Stone
      'space-mild-2', 'space-moderate-1', 'space-extreme-1',
      'space-agnostic-1',
      // Meta — dramatic flair
      'meta-nerf-me', 'meta-worthy-opponent',
      'time-agnostic-11', 'time-agnostic-13',
      // Masterwork — Tactical & Leadership
      'masterwork-phantom-blade', 'masterwork-catalyst-excellence',
      'masterwork-tide-turner',
    ],
  },
  {
    id: 'unhinged',
    name: 'Unhinged',
    emoji: '🃏',
    color: '#ef4444',
    description: 'Fourth-wall breaks, meta-chaos, and Deadpool energy',
    promptIds: [
      // Pure Deadpool originals
      'fourth-wall', 'inappropriate-humor', 'internal-monologue',
      // Meta — the wildest ones
      'meta-talk-to-writer', 'meta-rewind', 'meta-acknowledge-audience',
      'meta-chaotic-options', 'meta-terrible-idea', 'meta-break-game',
      'meta-crossover', 'meta-crisis-faith-dm', 'meta-weapons-argue',
      'meta-unkillable-inconvenienced', 'meta-crowdsource',
      'meta-dm-for-5-minutes', 'meta-worst-case', 'meta-negotiate-dice',
      'meta-what-if-not', 'meta-plot-hole',
      // World — chaos
      'property-damage', 'loot-chaos',
      // Time — reality-bending
      'time-extreme-1', 'time-extreme-2', 'time-extreme-3',
      'time-agnostic-10', 'time-agnostic-14',
    ],
  },
];

/**
 * Get prompts for a given mood, resolved from the full prompt list.
 * Returns prompts in the order defined by the mood's promptIds.
 */
export function getMoodPrompts(moodId: string, allPrompts: CharacterPrompt[]): CharacterPrompt[] {
  const mood = moodCategories.find(m => m.id === moodId);
  if (!mood) return [];

  const promptMap = new Map(allPrompts.map(p => [p.id, p]));
  return mood.promptIds
    .map(id => promptMap.get(id))
    .filter((p): p is CharacterPrompt => p !== undefined);
}

/**
 * Get a random selection of prompts for a mood.
 */
export function getRandomMoodPrompts(
  moodId: string,
  allPrompts: CharacterPrompt[],
  count: number = 6
): CharacterPrompt[] {
  const prompts = getMoodPrompts(moodId, allPrompts);
  if (prompts.length <= count) return prompts;

  const shuffled = [...prompts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
