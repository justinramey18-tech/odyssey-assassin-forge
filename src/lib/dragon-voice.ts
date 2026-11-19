// The dragon's voice in solo Empyrean: WHEN a bonded dragon pushes a thought into its rider's mind
// unasked, and how what passed between them reaches the DM. Pure rules and small storage helpers,
// no React. The app decides when; the AI only writes the words (the same split as npc-urge.ts).
//
// Canon: a rider's dragon can push past the rider's mental shields. It is rare: big moments
// (Signet Strain near its limit, the rider badly hurt) and when the dragon strongly disagrees with,
// or has a firm opinion about, what just happened in the story.
import { tableEnergy } from '@/lib/npc-urge';

export type DragonVoiceMode = 'rare' | 'off';
export type DragonVoiceMust = 'strain' | 'hp';

/** Every tunable number in one place. */
export const DRAGON_VOICE_RULES = {
  /** At least this long between two pushes… */
  cooldownMs: 300_000,
  /** …and at least this many DM posts. */
  postsBetween: 3,
  /** At most this many pushes in one calendar day. */
  perDay: 12,
  /** Signet Strain at this share of its limit is a big moment. */
  strainShare: 0.75,
  /** So is Strain rising by this much between two DM posts. */
  strainJump: 2,
  /** HP at or under this share of its maximum is a big moment. */
  hpShare: 0.25,
  /** He speaks when he rates his own feeling at this or more, out of 10… */
  feelBar: 8,
  /** …or this, after a tense DM post. */
  tenseFeelBar: 6,
  /** Short DM posts are not worth asking him about. */
  minPostChars: 200,
  /** Typing within this long counts as "the rider is typing"… */
  typingRecentMs: 3000,
  /** …and the forced turn waits for this much quiet. */
  typingQuietMs: 2000,
  /** One pushed line is cut at a sentence end past this length. */
  maxLineChars: 420,
  /** What the DM is told: at most this many lines, each this long. */
  noteLines: 8,
  noteLineChars: 300,
} as const;

/** What is remembered between DM posts (kept on the phone, per campaign). */
export interface DragonVoiceState {
  lastPushAt: number;
  postsSince: number;
  day: string;
  pushesToday: number;
  /** He has already spoken about the Strain being this high / the rider being this hurt. Cleared when it passes. */
  spokeStrain: boolean;
  spokeHp: boolean;
  lastStrain: number;
}

export function freshVoiceState(): DragonVoiceState {
  return { lastPushAt: 0, postsSince: DRAGON_VOICE_RULES.postsBetween, day: '', pushesToday: 0, spokeStrain: false, spokeHp: false, lastStrain: 0 };
}

const dayOf = (now: number) => new Date(now).toDateString();

export interface DragonVoiceMoment {
  now: number;
  /** The DM post that just finished. */
  dmText: string;
  strain: number;
  strainMax: number;
  hp: number;
  hpMax: number;
  mode: DragonVoiceMode;
  bonded: boolean;
  fightOpen: boolean;
}

export interface DragonVoiceDecision {
  /** The state to save, whatever happens next. */
  state: DragonVoiceState;
  /** Ask the dragon (one cheap AI call). */
  ask: boolean;
  /** A big moment: he speaks whatever number he gives. */
  must: DragonVoiceMust | null;
  /** Otherwise he speaks only at this feeling or more. */
  bar: number;
}

/** Called once per finished DM post. */
export function dragonVoiceDecision(prev: DragonVoiceState, m: DragonVoiceMoment): DragonVoiceDecision {
  const R = DRAGON_VOICE_RULES;
  const today = dayOf(m.now);
  const strainHigh = m.strainMax > 0 && m.strain >= Math.ceil(m.strainMax * R.strainShare);
  const strainJumped = m.strainMax > 0 && m.strain - prev.lastStrain >= R.strainJump;
  const hpLow = m.hpMax > 0 && m.hp > 0 && m.hp / m.hpMax <= R.hpShare;
  const state: DragonVoiceState = {
    ...prev,
    postsSince: prev.postsSince + 1,
    day: today,
    pushesToday: prev.day === today ? prev.pushesToday : 0,
    // Once the danger has passed he may speak about it again next time.
    spokeStrain: prev.spokeStrain && strainHigh,
    spokeHp: prev.spokeHp && hpLow,
    lastStrain: m.strain,
  };
  const bar = tableEnergy(m.dmText) === 'tense' ? R.tenseFeelBar : R.feelBar;
  const quiet = { state, ask: false, must: null, bar };
  if (m.mode === 'off' || !m.bonded || m.fightOpen) return quiet;
  if (state.pushesToday >= R.perDay) return quiet;
  if (state.postsSince < R.postsBetween) return quiet;
  if (m.now - state.lastPushAt < R.cooldownMs) return quiet;
  const must: DragonVoiceMust | null = hpLow && !state.spokeHp ? 'hp' : (strainHigh || strainJumped) && !state.spokeStrain ? 'strain' : null;
  if (!must && m.dmText.trim().length < R.minPostChars) return quiet;
  return { state, ask: true, must, bar };
}

/** Called once he has actually spoken. */
export function dragonVoiceSpoke(prev: DragonVoiceState, now: number, must: DragonVoiceMust | null): DragonVoiceState {
  const today = dayOf(now);
  return {
    ...prev,
    lastPushAt: now,
    postsSince: 0,
    day: today,
    pushesToday: (prev.day === today ? prev.pushesToday : 0) + 1,
    spokeStrain: prev.spokeStrain || must === 'strain',
    spokeHp: prev.spokeHp || must === 'hp',
  };
}

const MUST_TEXT: Record<DragonVoiceMust, string> = {
  strain: 'Right now you feel your rider burning with power, close to burning out. You WILL speak.',
  hp: 'Right now you feel your rider badly hurt. You WILL speak.',
};

/** Added to the dragon's own prompt for the one call that asks whether he pushes in. */
export function dragonVoiceAsk(must: DragonVoiceMust | null): string {
  return [
    '',
    '',
    '## PUSHING INTO YOUR RIDER\'S MIND',
    'Nobody is speaking to you. Something has just happened in the story (the most recent events above). You can push a thought past your rider\'s mental shields whenever you choose, but you rarely do.',
    'Speak only from what you could know: what you sensed yourself, and what you feel through the bond (your rider\'s emotions, pain and power). If you were not there, you do not know the facts, only how your rider felt.',
    'Decide how strongly you feel, from 0 (nothing worth saying) to 10 (you cannot stay silent: you strongly disagree with what your rider did or is about to do, or you hold a firm opinion about what just happened).',
    must ? MUST_TEXT[must] : '',
    'Answer in exactly this form and nothing else:',
    'FEEL: <a number from 0 to 10>',
    'LINE: <what you push into your rider\'s mind, one or two sentences, in your own voice; or the single word NONE>',
  ].filter((line, i) => i < 2 || line !== '').join('\n');
}

/** Cuts a line at a sentence end once it passes the limit. */
function trimLine(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return end > max * 0.4 ? cut.slice(0, end + 1).trim() : `${cut.trim()}…`;
}

/** Reads his answer. null = unreadable, which counts as silence. */
export function readDragonVoice(reply: string | null | undefined): { feel: number; line: string } | null {
  const text = (reply || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!text) return null;
  const feel = text.match(/FEEL:\s*(\d{1,2})/i);
  const line = text.match(/LINE:\s*([\s\S]+)$/i);
  if (!feel || !line) return null;
  const n = Math.max(0, Math.min(10, parseInt(feel[1], 10)));
  let said = line[1].trim().replace(/^["“]+|["”]+$/g, '').trim();
  if (/^none\.?$/i.test(said)) said = '';
  return { feel: n, line: trimLine(said, DRAGON_VOICE_RULES.maxLineChars) };
}

/** Whether that answer becomes a pushed line. */
export function dragonSpeaks(said: { feel: number; line: string } | null, decision: Pick<DragonVoiceDecision, 'must' | 'bar'>): boolean {
  if (!said || !said.line) return false;
  return decision.must !== null || said.feel >= decision.bar;
}

/** The forced turn waits while the rider is typing. */
export function riderIsTyping(lastInputAt: number, now: number): boolean {
  return now - lastInputAt < DRAGON_VOICE_RULES.typingRecentMs;
}
export function quietEnoughToTurn(lastInputAt: number, now: number): boolean {
  return now - lastInputAt >= DRAGON_VOICE_RULES.typingQuietMs;
}

// ── What the DM is told (private mind-speech) ──

export interface BondLine { who: 'dragon' | 'rider'; text: string }

export function addBondLine(log: BondLine[], line: BondLine): BondLine[] {
  const text = line.text.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return log;
  return [...log, { who: line.who, text }].slice(-DRAGON_VOICE_RULES.noteLines);
}

/** The note sent with the rider's next Send to DM. Empty when nothing was said. */
export function bondNoteForDm(log: BondLine[], dragonName: string, riderName: string): string {
  if (log.length === 0) return '';
  const dragon = dragonName.trim() || 'The dragon';
  const rider = riderName.trim() || 'The rider';
  const cut = (t: string) => (t.length > DRAGON_VOICE_RULES.noteLineChars ? `${t.slice(0, DRAGON_VOICE_RULES.noteLineChars).trim()}…` : t);
  return [
    '## THE BOND (PRIVATE MIND-SPEECH)',
    `Since your last post, ${rider} and ${dragon} spoke mind to mind. Nobody else heard or sensed any of it: no other character may know it, react to it or guess at it. Let it colour what ${rider} and ${dragon} do and feel next. Do not repeat it back.`,
    ...log.map(l => `${l.who === 'dragon' ? dragon : rider}: ${cut(l.text)}`),
  ].join('\n');
}

// ── Storage (the phone; a missing or broken value is the default) ──

const MODE_KEY = 'empyrean-dragon-voice';

export function readVoiceMode(): DragonVoiceMode {
  try { return localStorage.getItem(MODE_KEY) === 'off' ? 'off' : 'rare'; } catch { return 'rare'; }
}
export function saveVoiceMode(mode: DragonVoiceMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage full or blocked: the default stays */ }
}

export function readVoiceState(key: string): DragonVoiceState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return freshVoiceState();
    const v = JSON.parse(raw) as Partial<DragonVoiceState>;
    const base = freshVoiceState();
    return {
      lastPushAt: typeof v.lastPushAt === 'number' ? v.lastPushAt : base.lastPushAt,
      postsSince: typeof v.postsSince === 'number' ? v.postsSince : base.postsSince,
      day: typeof v.day === 'string' ? v.day : base.day,
      pushesToday: typeof v.pushesToday === 'number' ? v.pushesToday : base.pushesToday,
      spokeStrain: v.spokeStrain === true,
      spokeHp: v.spokeHp === true,
      lastStrain: typeof v.lastStrain === 'number' ? v.lastStrain : base.lastStrain,
    };
  } catch { return freshVoiceState(); }
}
export function saveVoiceState(key: string, state: DragonVoiceState): void {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* as above */ }
}
