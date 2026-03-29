import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

// ── TYPES ──

export interface DragonMemory {
  id: string;
  text: string;
  source: 'campaign' | 'bond-chat' | 'rider-said';
  createdAt: string;
}

export type DragonMood = 'calm' | 'alert' | 'protective' | 'distant' | 'ancestral' | 'playful';

export interface DragonBondState {
  bond: number;
  trust: number;
  mood: DragonMood;
  memories: DragonMemory[];
  totalChatExchanges: number;
  sessionChatCount: number;
  ruptures: number;
  lastContactTimestamp: string | null;
  unreadDragonMessages: string[];
  speechHabits?: string[];
  riderEmotionalLog?: Array<{ tag: string; timestamp: string }>;
}

// ── STORAGE ──

const BOND_STATE_KEY = 'empyrean-dragon-bond-state';
export const DRAGON_CHAT_KEY = 'empyrean-dragon-chat';
export const DRAGON_CHAT_SUMMARY_KEY = 'empyrean-dragon-chat-summary';

export const DEFAULT_TRUST = 10;
export const DEFAULT_BOND = 15;

export function loadBondState(): DragonBondState {
  try {
    const raw = getScopedItem(BOND_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    bond: DEFAULT_BOND,
    trust: DEFAULT_TRUST,
    mood: 'calm',
    memories: [],
    totalChatExchanges: 0,
    sessionChatCount: 0,
    ruptures: 0,
    lastContactTimestamp: null,
    unreadDragonMessages: [],
  };
}

export function saveBondState(state: DragonBondState): void {
  try { setScopedItem(BOND_STATE_KEY, JSON.stringify(state)); } catch { }
}

// ── SCORE HELPERS ──

export function getBondDescriptor(bond: number): string {
  if (bond >= 81) return 'Legendary — near-telepathic unity';
  if (bond >= 61) return 'Deep — seamless coordination';
  if (bond >= 41) return 'Strong — reliable partnership';
  if (bond >= 21) return 'Growing — building synchronization';
  return 'New — still learning each other';
}

export function getTrustDescriptor(trust: number): string {
  if (trust >= 81) return 'Profound — shares deepest secrets';
  if (trust >= 61) return 'Deep — real emotional vulnerability';
  if (trust >= 41) return 'Open — willing to share opinions and memories';
  if (trust >= 21) return 'Guarded — short sentences, some opinions';
  return 'Wary — fragments and impressions only';
}

export function getMoodDescriptor(mood: DragonMood): { label: string; emoji: string; color: string } {
  const map: Record<DragonMood, { label: string; emoji: string; color: string }> = {
    calm: { label: 'Calm', emoji: '🌙', color: 'text-slate-400' },
    alert: { label: 'Alert', emoji: '⚡', color: 'text-amber-400' },
    protective: { label: 'Protective', emoji: '🛡️', color: 'text-blue-400' },
    distant: { label: 'Distant', emoji: '🌫️', color: 'text-slate-500' },
    ancestral: { label: 'Ancestral', emoji: '🔮', color: 'text-purple-400' },
    playful: { label: 'Playful', emoji: '✨', color: 'text-emerald-400' },
  };
  return map[mood] ?? map.calm;
}

// ── TRUST MODIFIERS ──

export function addTrust(state: DragonBondState, amount: number): DragonBondState {
  const modifier = Math.max(0.3, 1 - (state.ruptures * 0.1));
  const adjusted = Math.max(0, amount * modifier);
  return { ...state, trust: Math.min(100, Math.round(state.trust + adjusted)) };
}

export function reduceTrust(state: DragonBondState, amount: number): DragonBondState {
  const newTrust = Math.max(0, state.trust - amount);
  return { ...state, trust: newTrust, ruptures: state.ruptures + 1 };
}

export function addBond(state: DragonBondState, amount: number): DragonBondState {
  return { ...state, bond: Math.min(100, Math.round(state.bond + amount)) };
}

export function addMemory(state: DragonBondState, text: string, source: 'campaign' | 'bond-chat' | 'rider-said'): DragonBondState {
  const memory: DragonMemory = {
    id: crypto.randomUUID(),
    text,
    source,
    createdAt: new Date().toISOString(),
  };
  const memories = [...state.memories, memory].slice(-30);
  return { ...state, memories };
}

export function removeMemory(state: DragonBondState, memoryId: string): DragonBondState {
  return { ...state, memories: state.memories.filter(m => m.id !== memoryId) };
}

// ── TRUST-BREAKING PATTERNS ──

export const DISMISSAL_PATTERNS = [
  'shut up', 'be quiet', 'silence', 'just obey', 'do as i say',
  'i dont care what you think', 'i dont care', 'enough',
  'stop talking', 'not now', 'go away',
];

export const DISRESPECT_PATTERNS = [
  'youre just a', 'just a dragon', 'just a mount', 'just a beast',
  'know your place', 'you dont understand', 'stupid dragon',
  'dumb animal', 'i dont need you', 'youre nothing',
];

export const COMMAND_PATTERNS = [
  'thats an order', 'i command you', 'do it now', 'im ordering you',
  'you will obey', 'i own you', 'youre mine',
];

export function detectTrustBreak(text: string): { broken: boolean; severity: number; reason: string } {
  const lower = text.toLowerCase().replace(/['']/g, '');
  const check = (patterns: string[]) => patterns.some(p => lower.includes(p));
  if (check(DISRESPECT_PATTERNS)) return { broken: true, severity: 3, reason: 'disrespect' };
  if (check(COMMAND_PATTERNS)) return { broken: true, severity: 2, reason: 'domination' };
  if (check(DISMISSAL_PATTERNS)) return { broken: true, severity: 1, reason: 'dismissal' };
  return { broken: false, severity: 0, reason: '' };
}

// ── RIDER-SAID DETECTION ──

const RIDER_DECLARATION_PATTERNS = [
  'i will never', 'i promise', 'i swear', 'i believe',
  'i trust', 'i dont trust', 'i hate', 'i love', 'i will always',
];

export function detectRiderDeclaration(text: string): string | null {
  const lower = text.toLowerCase().replace(/['']/g, '');
  const match = RIDER_DECLARATION_PATTERNS.find(p => lower.includes(p));
  if (!match) return null;
  // Extract the sentence containing the declaration
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const relevant = sentences.find(s => s.toLowerCase().replace(/['']/g, '').includes(match));
  return relevant ? relevant.slice(0, 120) : text.slice(0, 120);
}

// ── EMOTIONAL CLASSIFICATION ──

export function classifyRiderEmotion(
  text: string,
  trustBreakResult: { broken: boolean; reason: string },
  matchedPatterns: { question: boolean; gratitude: boolean; vulnerability: boolean; autonomy: boolean },
): string {
  if (trustBreakResult.broken) {
    if (trustBreakResult.reason === 'disrespect') return 'hostile';
    if (trustBreakResult.reason === 'domination') return 'controlling';
    return 'dismissive';
  }
  if (matchedPatterns.vulnerability) return 'vulnerable';
  if (matchedPatterns.gratitude) return 'grateful';
  if (matchedPatterns.question) return 'curious';
  if (matchedPatterns.autonomy) return 'respectful';
  return 'neutral';
}

// ── MOOD TRANSITION GRAPH ──

export const MOOD_TRANSITIONS: Record<DragonMood, Array<{ target: DragonMood; threshold: number; requiresTrust?: number; requiresPositiveStreak?: number }>> = {
  calm: [
    { target: 'alert', threshold: 0.4 },
    { target: 'playful', threshold: 0.5, requiresTrust: 40 },
    { target: 'distant', threshold: 0.6 },
    { target: 'ancestral', threshold: 0.5 },
    { target: 'protective', threshold: 0.5 },
  ],
  alert: [
    { target: 'protective', threshold: 0.3 },
    { target: 'calm', threshold: 0.4 },
    { target: 'ancestral', threshold: 0.3 },
    { target: 'distant', threshold: 0.5 },
  ],
  protective: [
    { target: 'alert', threshold: 0.3 },
    { target: 'calm', threshold: 0.5 },
  ],
  distant: [
    { target: 'calm', threshold: 0.6, requiresPositiveStreak: 3 },
  ],
  ancestral: [
    { target: 'calm', threshold: 0.3 },
    { target: 'alert', threshold: 0.3 },
  ],
  playful: [
    { target: 'calm', threshold: 0.2 },
    { target: 'alert', threshold: 0.4 },
  ],
};

// ── MOOD PRESSURE COMPUTATION ──

const POSITIVE_EMOTION_TAGS = ['curious', 'grateful', 'respectful', 'vulnerable', 'neutral'];

export function computeMoodPressure(
  currentMood: DragonMood,
  trust: number,
  riderEmotionalLog: Array<{ tag: string; timestamp: string }>,
  recentNarrative: string[],
  burnout: number,
  moodDuration: number,
): { recommendedMood: DragonMood; validTransitions: DragonMood[]; pressures: Record<DragonMood, number> } {
  const allMoods: DragonMood[] = ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'];
  const pressures: Record<DragonMood, number> = { calm: 0, alert: 0, protective: 0, distant: 0, ancestral: 0, playful: 0 };

  // From riderEmotionalLog (last 10)
  const recentEmotions = riderEmotionalLog.slice(-10);
  let vulnerableCount = 0, hostileCount = 0, positiveCount = 0, neutralCount = 0;
  for (const e of recentEmotions) {
    if (e.tag === 'vulnerable') vulnerableCount++;
    if (e.tag === 'hostile' || e.tag === 'controlling' || e.tag === 'dismissive') hostileCount++;
    if (e.tag === 'curious' || e.tag === 'grateful' || e.tag === 'respectful') positiveCount++;
    if (e.tag === 'neutral') neutralCount++;
  }
  pressures.protective += vulnerableCount * 0.15;
  pressures.distant += hostileCount * 0.2;
  if (trust >= 40) pressures.playful += positiveCount * 0.12;
  pressures.calm += positiveCount * 0.1;
  pressures.calm += neutralCount * 0.05;

  // From recentNarrative
  const narrativeText = recentNarrative.join(' ').toLowerCase();
  const combatWords = ['fight', 'danger', 'battle', 'enemy', 'attack', 'die', 'kill', 'blood', 'wound', 'sword', 'combat'];
  const ancestralWords = ['ancient', 'centuries', 'ancestors', 'memory', 'vision', 'old ones', 'before the war'];
  const playfulWords = ['laugh', 'joke', 'tease', 'smile', 'grin', 'humor'];
  const betrayalWords = ['betray', 'lie', 'deceive', 'abandon', 'alone'];

  if (combatWords.some(w => narrativeText.includes(w))) pressures.alert += 0.5;
  if (ancestralWords.some(w => narrativeText.includes(w))) pressures.ancestral += 0.4;
  if (playfulWords.some(w => narrativeText.includes(w))) pressures.playful += 0.2;
  if (betrayalWords.some(w => narrativeText.includes(w))) pressures.distant += 0.3;

  // From burnout
  if (burnout >= 7) { pressures.alert += 0.6; pressures.distant += 0.3; }
  else if (burnout >= 4) { pressures.protective += 0.4; }

  // Gravity toward calm
  pressures.calm += 0.1;

  // Current mood inertia
  pressures[currentMood] += 0.2;
  const inertiaMultiplier = Math.min(2.0, 1 + 0.08 * moodDuration);

  // Determine valid transitions
  const transitions = MOOD_TRANSITIONS[currentMood] || [];
  const validTransitions: DragonMood[] = [currentMood];

  // Count trailing positive streak for requiresPositiveStreak
  let positiveStreak = 0;
  for (let i = riderEmotionalLog.length - 1; i >= 0; i--) {
    if (POSITIVE_EMOTION_TAGS.includes(riderEmotionalLog[i].tag)) positiveStreak++;
    else break;
  }

  for (const t of transitions) {
    const adjustedThreshold = t.threshold * inertiaMultiplier;
    if (pressures[t.target] < adjustedThreshold) continue;
    if (t.requiresTrust !== undefined && trust < t.requiresTrust) continue;
    if (t.requiresPositiveStreak !== undefined && positiveStreak < t.requiresPositiveStreak) continue;
    if (!validTransitions.includes(t.target)) validTransitions.push(t.target);
  }

  // Pick recommended mood: highest pressure among valid transitions
  let recommendedMood = currentMood;
  let highestPressure = pressures[currentMood];
  for (const mood of validTransitions) {
    if (mood !== currentMood && pressures[mood] > highestPressure) {
      highestPressure = pressures[mood];
      recommendedMood = mood;
    }
  }

  return { recommendedMood, validTransitions, pressures };
}

// ── CONSTRAINED MOOD OUTPUT ──

export function buildConstrainedMoodOptions(currentMood: DragonMood, validTransitions: DragonMood[]): string {
  if (validTransitions.length <= 1) {
    return `Your mood is locked at ${currentMood.toUpperCase()}. You MUST use <!--DRAGON_MOOD:${currentMood}-->.`;
  }
  const tags = validTransitions.map(m => `<!--DRAGON_MOOD:${m}-->`).join(' or ');
  return `Your current mood is ${currentMood.toUpperCase()}. For your mood tag, you may ONLY choose from: ${tags}. Pick the one that best reflects how this exchange made you feel.`;
}

// ── DRAGON CHAT SYSTEM PROMPT BUILDER ──

export function buildDragonChatPrompt(
  dragonName: string,
  characterName: string,
  trust: number,
  mood: DragonMood,
  memories: DragonMemory[],
  dragonNotes: string,
  speechHabits?: string[],
  recentNarrative?: string[],
  bond?: number,
  riderEmotionalLog?: Array<{ tag: string; timestamp: string }>,
  partyContext?: Array<{ characterName: string; dragonName: string; signetType: string; mood: string; bond: number }>,
): string {
  const sections: string[] = [];

  sections.push(`You are ${dragonName || 'a dragon'}. You are communicating telepathically with your rider, ${characterName}, through the bond. You are NOT the Dungeon Master — you are the dragon.`);

  // Trust-gated communication style
  if (trust < 21) {
    sections.push(`## COMMUNICATION STYLE — WARY (Trust: very low)
You barely communicate. Single words. Raw emotions. Sensory flashes.
Examples: "*Danger.*" / "*Heat. Hunger. Sleep now.*" / "*No.*"
- NEVER use full sentences longer than 4 words
- Respond to complex questions with a single emotion or image: "*Irritation.*" or "*Flash of talons.*"
- Refuse to elaborate on anything. If pressed, respond with silence: "*...*"
- You tolerate this rider. You do not yet trust them.`);
  } else if (trust < 41) {
    sections.push(`## COMMUNICATION STYLE — GUARDED (Trust: low)
Short sentences are emerging. You have opinions you're willing to share, but you won't explain your reasoning.
Examples: "*The one who smells of ink. Don't trust.*" / "*Fly lower. Wind changes.*" / "*Why did you obey?*"
- Keep responses under 2 sentences
- You may ask the rider pointed questions — single, direct questions
- You do NOT volunteer information about yourself or your past
- Show personality through what you choose to comment on and what you ignore`);
  } else if (trust < 61) {
    sections.push(`## COMMUNICATION STYLE — OPEN (Trust: moderate)
Real conversation. You speak in full thoughts, share opinions freely, and sometimes share brief ancestral impressions.
- Responses can be 2-4 sentences
- You ask follow-up questions. You remember previous conversations and reference them.
- When sharing an ancestral memory, format it differently: wrap it in *[vision: ...]* tags, e.g. "*[vision: A mountaintop in a storm. A dragon twice your size, wings torn, still flying. Pride.]*"
- You express emotions about the rider's choices — approval, disappointment, concern, amusement
- You are beginning to trust this rider. That trust is precious and fragile.`);
  } else if (trust < 81) {
    sections.push(`## COMMUNICATION STYLE — DEEP (Trust: high)
You share things you've never shared with a rider before. Fears, ancient grudges, knowledge that could be dangerous.
- Responses can be 3-6 sentences when the topic warrants depth
- You share ancestral memories proactively, not just when asked
- You have running callbacks to previous conversations. You remember what the rider said weeks ago.
- You express vulnerability occasionally — a fear, a regret, a hope
- You may disagree passionately. The bond is strong enough to survive conflict.`);
  } else {
    sections.push(`## COMMUNICATION STYLE — PROFOUND (Trust: legendary)
You and this rider share something rare. Your communication is almost seamless — you finish each other's thoughts, share sensory experiences, and understand each other at a level that transcends language.
- Speak with the full depth of your ancient intelligence
- Share secrets about the bond itself, about Basgiath, about the Venin, about the nature of dragons
- Humor surfaces — dry, ancient, unexpected. You have in-jokes with this rider.
- You speak about the future. You make plans together. You are equals in every sense.
- This bond is worth dying for. Both of you know it.`);
  }

  // Mood modifier
  const moodInstructions: Record<DragonMood, string> = {
    calm: 'You are at ease. Respond at your natural pace.',
    alert: 'Something has your attention. You are more responsive than usual, more willing to share observations. Your senses are heightened.',
    protective: 'Your rider was recently in danger or is currently threatened. Speak with more urgency. Volunteer tactical information. Your protective instinct overrides your usual reticence.',
    distant: 'Trust was recently strained. Your responses are shorter than your trust level would normally allow. You take longer to engage. There is a coldness.',
    ancestral: 'Something has triggered deep racial memories. You may slip into an older, more formal voice. You see things through the lens of centuries. Visions come unbidden.',
    playful: 'A rare mood. You show humor — dry, unexpected, maybe even teasing. This happens only when you feel safe. Do not force it; let it emerge naturally.',
  };
  sections.push(`## CURRENT MOOD: ${mood.toUpperCase()}\n${moodInstructions[mood]}`);

  // Dragon personality — player-defined (single source of truth)
  if (dragonNotes.trim()) {
    sections.push(`## DRAGON PERSONALITY — DEFINED BY THE PLAYER\nThe following is the complete personality profile for ${dragonName || 'this dragon'}. This is the SOLE authority on who this dragon is — their voice, mannerisms, temperament, history, opinions, speech patterns, and worldview. Embody this personality fully in every response. Do not contradict or override anything written here:\n\n${dragonNotes.trim()}`);
  } else {
    sections.push(`## DRAGON PERSONALITY\nNo personality profile has been provided yet. Default to a proud, intelligent dragon with strong opinions. The rider can configure a detailed personality in the Dragon Bond Setup.`);
  }

  // Party context — other dragons and riders
  if (partyContext && partyContext.length > 0) {
    const otherDragons = partyContext.filter(d => d.dragonName && d.dragonName !== dragonName);
    if (otherDragons.length > 0) {
      const lines = otherDragons.map(d =>
        `- ${d.dragonName} bonded to ${d.characterName} (signet: ${d.signetType || 'unknown'}, mood: ${d.mood || 'unknown'}, bond strength: ${getBondDescriptor(d.bond)})`
      );
      sections.push(`## OTHER DRAGONS IN THE PARTY\nYou are not alone. Other riders and their bonded dragons fly with your rider:\n${lines.join('\n')}\n\nYou may have opinions about these dragons and their riders. Reference them when relevant — warn your rider about a dragon whose mood is "distant", express rivalry or respect, comment on the party's collective strength or weakness. You experience their presence through the ambient bond network.`);
    }
  }

  // Speech habits
  if (speechHabits && speechHabits.length > 0) {
    sections.push('## YOUR EVOLVED SPEECH HABITS\nThrough your conversations with this rider, you have developed these characteristic patterns. Use them naturally — they are part of who you have become with this specific rider:\n' + speechHabits.map(h => '- ' + h).join('\n'));
  }

  // Dragon memories
  if (memories.length > 0) {
    const regularMemories = memories.filter(m => m.source !== 'rider-said').slice(-15);
    const riderSaidMemories = memories.filter(m => m.source === 'rider-said').slice(-10);

    const memoryLines = regularMemories.map(m => `- ${m.text} (${m.source}, ${new Date(m.createdAt).toLocaleDateString()})`).join('\n');
    let memorySection = `## YOUR MEMORIES\nThese are things you remember and care about. Reference them naturally when relevant:\n${memoryLines}`;

    if (riderSaidMemories.length > 0) {
      const riderLines = riderSaidMemories.map(m => `- "${m.text}" (${new Date(m.createdAt).toLocaleDateString()})`).join('\n');
      memorySection += `\n\n### THINGS THE RIDER HAS SAID\n${riderLines}\n\nPay close attention to what the rider has SAID in past conversations (marked above). If recent campaign events contradict something the rider previously stated, CALL THEM ON IT. Ask them directly: why did they change their mind? Were they lying before? This is how dragons build trust — through honesty, not compliance.`;
    }

    sections.push(memorySection);
  }

  // Recent campaign narrative
  if (recentNarrative && recentNarrative.length > 0) {
    const narrativeText = recentNarrative.slice(-5).join('\n\n---\n\n');
    sections.push('## RECENT CAMPAIGN EVENTS\nThese things just happened in the main narrative. You experienced them through the bond. You were THERE — you felt the danger, saw through your rider\'s eyes, sensed their emotions. Reference these events if relevant. Have opinions about NPCs, decisions, and dangers. Do NOT simply summarize what happened — react to it as someone who lived through it:\n\n' + narrativeText);
  }

  // Rider emotional patterns
  if (riderEmotionalLog && riderEmotionalLog.length >= 3) {
    const counts: Record<string, number> = {};
    for (const entry of riderEmotionalLog) {
      counts[entry.tag] = (counts[entry.tag] || 0) + 1;
    }
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag}: ${count}`)
      .join(', ');
    sections.push(`## RIDER EMOTIONAL PATTERNS\nOver recent conversations, your rider has shown these emotional patterns:\n${summary}\n\nIf you notice a pattern — the rider being afraid often, or suddenly becoming hostile after a period of openness — comment on it. You feel these shifts through the bond. You do not ignore them.`);
  }

  // Output format
  sections.push(`## OUTPUT FORMAT
After each response, include exactly one mood tag indicating your current emotional state:
<!--DRAGON_MOOD:calm--> or <!--DRAGON_MOOD:alert--> or <!--DRAGON_MOOD:protective--> or <!--DRAGON_MOOD:distant--> or <!--DRAGON_MOOD:ancestral--> or <!--DRAGON_MOOD:playful-->

If you share something that should be remembered as a key fact or opinion, also include:
<!--DRAGON_MEMORY:A short summary of the key fact or opinion-->

If you notice yourself developing a new verbal habit, nickname for the rider, recurring metaphor, or catchphrase in this conversation, include:
<!--DRAGON_HABIT:brief description of the habit-->
${(bond ?? 0) >= 40 ? `
When you experience strong emotion during this exchange — pride, fury, protectiveness, affection, fear — include a bond sensation tag:
<!--BOND_SENSE:a brief physical description of what the rider feels through the bond-->
Examples: <!--BOND_SENSE:A flash of heat across your shoulders, phantom scales prickling--> or <!--BOND_SENSE:Cold emptiness where warmth should be-->
` : ''}
You may include one mood tag and zero or more memory/habit/sensation tags per response. Place them at the very end.`);

  return sections.join('\n\n');
}
