import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

// ── TYPES ──

export interface DragonMemory {
  id: string;
  text: string;
  source: 'campaign' | 'bond-chat';
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
}

// ── STORAGE ──

const BOND_STATE_KEY = 'empyrean-dragon-bond-state';
export const DRAGON_CHAT_KEY = 'empyrean-dragon-chat';
export const DRAGON_CHAT_SUMMARY_KEY = 'empyrean-dragon-chat-summary';

export function loadBondState(): DragonBondState {
  try {
    const raw = getScopedItem(BOND_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    bond: 15,
    trust: 10,
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

export function addMemory(state: DragonBondState, text: string, source: 'campaign' | 'bond-chat'): DragonBondState {
  const memory: DragonMemory = {
    id: crypto.randomUUID(),
    text,
    source,
    createdAt: new Date().toISOString(),
  };
  const memories = [...state.memories, memory].slice(-30);
  return { ...state, memories };
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

// ── DRAGON CHAT SYSTEM PROMPT BUILDER ──

export function buildDragonChatPrompt(
  dragonName: string,
  characterName: string,
  trust: number,
  mood: DragonMood,
  memories: DragonMemory[],
  dragonNotes: string,
  recentNarrative?: string[],
): string {
  const sections: string[] = [];

  sections.push(`You are ${dragonName || 'a dragon'}, a bonded dragon in the world of Navarre. You are NOT the Dungeon Master. You are the dragon. You are communicating telepathically with your rider, ${characterName}, through the bond.

You are ancient, proud, and fiercely intelligent. You are not a pet, not a mount, and not a servant. You are a partner — and you have opinions about everything.`);

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

  // Dragon personality notes from the user
  if (dragonNotes.trim()) {
    sections.push(`## PERSONALITY NOTES FROM THE RIDER\n${dragonNotes.trim()}`);
  }

  // Dragon memories
  if (memories.length > 0) {
    const memoryLines = memories.slice(-15).map(m => `- ${m.text} (${m.source}, ${new Date(m.createdAt).toLocaleDateString()})`).join('\n');
    sections.push(`## YOUR MEMORIES\nThese are things you remember and care about. Reference them naturally when relevant:\n${memoryLines}`);
  }

  // Recent campaign narrative
  if (recentNarrative && recentNarrative.length > 0) {
    const narrativeText = recentNarrative.slice(-5).join('\n\n---\n\n');
    sections.push('## RECENT CAMPAIGN EVENTS\nThese things just happened in the main narrative. You experienced them through the bond. You were THERE — you felt the danger, saw through your rider\'s eyes, sensed their emotions. Reference these events if relevant. Have opinions about NPCs, decisions, and dangers. Do NOT simply summarize what happened — react to it as someone who lived through it:\n\n' + narrativeText);
  }

  // Output format
  sections.push(`## OUTPUT FORMAT
After each response, include exactly one mood tag indicating your current emotional state:
<!--DRAGON_MOOD:calm--> or <!--DRAGON_MOOD:alert--> or <!--DRAGON_MOOD:protective--> or <!--DRAGON_MOOD:distant--> or <!--DRAGON_MOOD:ancestral--> or <!--DRAGON_MOOD:playful-->

If you share something that should be remembered as a key fact or opinion, also include:
<!--DRAGON_MEMORY:A short summary of the key fact or opinion-->

You may include one mood tag and zero or more memory tags per response. Place them at the very end.`);

  return sections.join('\n\n');
}
