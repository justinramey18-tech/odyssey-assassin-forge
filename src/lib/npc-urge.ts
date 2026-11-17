// Solo Empyrean urge meter (D-40): the app decides WHEN an on-stage NPC speaks unprompted;
// the AI only writes the words. Pure logic, no React — the solo Live Table hook drives it.
//
// How it works: every line at the table (and silence) adds points to each on-stage NPC's urge,
// weighted by their temperament (temperament.ts). Urge fades 20% a minute. Near the line a "…"
// tell shows; crossing it makes the NPC speak, with the reason handed to the AI. Speaking resets
// the urge and starts a cooldown. The hook enforces the caps (2 wakes per rider line, 1 reaction
// to an unprompted line, never a chain) and the brakes (DM writing, scene, fight, table closed).
import { eraReached, type CanonEra } from '@/lib/empyreanCanon/castNpcs/types';
import { NEUTRAL_TEMPERAMENT, type Temperament, type UrgeCategory, type UrgeIntent } from '@/lib/empyreanCanon/castNpcs/temperament';

/** Per-NPC switch: how freely they speak unprompted. 'spoken-to' = never. */
export type Talkativeness = 'chatty' | 'normal' | 'spoken-to';

/** Unprompted lines run on this cheap model; direct answers keep the DM's model (Justin, 2026-11-17). */
export const URGE_LINE_MODEL = 'google/gemini-2.5-flash';

/** Every tunable number in one place. */
export const URGE_RULES = {
  /** An NPC speaks at this urge (before style and talkativeness factors). */
  threshold: 10,
  /** The "…" tell shows at this share of the effective threshold. */
  tellRatio: 0.7,
  /** Urge keeps this share per minute (20% fades). */
  keepPerMin: 0.8,
  /** No second unprompted line within this after speaking (or entering the stage). */
  cooldownMs: 45_000,
  /** Quiet this long = the spotlight bonus on rider lines doubles. */
  spotlightAfterMs: 180_000,
  /** Silence adds points once per this much idle, open-table time. */
  silenceStepMs: 30_000,
  /** At most this many NPCs wake on one rider line… */
  maxWakesPerLine: 2,
  /** …and at most this many react to an unprompted NPC line (and that line triggers nothing further). */
  maxReactionWakes: 1,
  /** At least this long between silence-driven wakes, table-wide. */
  tickWakeGapMs: 90_000,
} as const;

/** Points per trigger, before temperament weights. */
export const URGE_POINTS = {
  name: 6, insult: 4, praise: 2, danger: 3, secret: 3, authority: 2, topic: 3,
  person: 3, personGrudge: 4, rivalSpeaks: 2, ignored: 1, silenceStep: 1, argument: 2,
} as const;

const STYLE_FACTOR = { quiet: 1.4, normal: 1, loud: 0.75 } as const;
const TALK_FACTOR = { chatty: 0.75, normal: 1 } as const;

/** Tier 2 numbers: learned taste, rank, ignored questions, table energy. */
export const URGE_TUNING = {
  /** Sealing an unprompted line: that NPC's threshold × this (chattier), down to learnedMin. */
  likedStep: 0.95,
  /** Deleting one, or hushing a tell: threshold × this (quieter), up to learnedMax. Annoyance counts double. */
  dislikedStep: 1.10,
  learnedMin: 0.7,
  learnedMax: 1.5,
  /** Someone of higher rank is on stage: lower ranks need this much more urge. */
  outrankedScale: 1.3,
  /** An NPC's question goes unanswered for this many rider lines before it pushes. */
  questionGraceLines: 2,
  questionFirstPush: 4,
  questionNextPush: 2,
  questionExpiresMs: 300_000,
  /** A tense DM post: everyone needs less urge for a while. A calm one: a bit more. */
  tenseWords: 3,
  tenseScale: 0.8,
  tenseForMs: 300_000,
  calmScale: 1.1,
} as const;

// Whole-word trigger lists (case-insensitive). Short and tunable on purpose.
// Entries may be phrases ("drawn steel"); a phrase matches whole.
const INSULT = ['coward', 'idiot', 'fool', 'useless', 'weak', 'weakling', 'pathetic', 'liar', 'traitor', 'worthless', 'stupid', 'moron', 'scum', 'bastard', 'spineless', 'gutless', 'craven', 'disgrace', 'embarrassment', 'dead weight', 'waste of space'];
const PRAISE = ['brave', 'bravest', 'brilliant', 'amazing', 'impressive', 'incredible', 'hero', 'proud', 'thank', 'thanks', 'grateful', 'well done', 'good work'];
const DANGER = ['blade', 'blades', 'dagger', 'daggers', 'knife', 'sword', 'swords', 'blood', 'bleeding', 'wounded', 'hurt', 'dying', 'kill', 'killed', 'attack', 'attacked', 'threat', 'ambush', 'poison', 'poisoned', 'venin', 'wyvern', 'weapon', 'weapons', 'wyverns', 'wound', 'wounds', 'stabbed', 'murder', 'murdered', 'threatened', 'assassin', 'bleeding out', 'drawn steel'];
const AUTHORITY = ['order', 'orders', 'ordered', 'command', 'commands', 'rank', 'codex', 'rule', 'rules', 'regulation', 'curfew', 'report', 'discipline', 'permission', 'forbidden', 'regulations', 'insubordination', 'disobey', 'disobeyed', 'chain of command', 'superior officer', 'out of line'];
/** Words that make a DM post tense (with DANGER): reveals and deaths. */
const REVEAL = ['secret', 'betrayed', 'betrayal', 'lied', 'revealed', 'discovered', 'dead', 'death', 'dies', 'scream', 'screams', 'explosion', 'flames', 'traitor'];

export interface UrgeReason { text: string; pts: number }

export interface NpcUrgeState {
  urge: number;
  /** When the urge was last settled (decay applied up to here). */
  at: number;
  /** Last unprompted line, or when the NPC entered the stage. */
  lastSpokeAt: number;
  /** What has been feeding the urge, strongest kept first (cap 4). */
  reasons: UrgeReason[];
}

export function freshUrge(now: number): NpcUrgeState {
  return { urge: 0, at: now, lastSpokeAt: now, reasons: [] };
}

/** Apply the time-decay up to now. Call before reading or adding. */
export function settleUrge(s: NpcUrgeState, now: number): NpcUrgeState {
  const dt = Math.max(0, now - s.at);
  if (dt === 0) return s;
  const urge = s.urge * Math.pow(URGE_RULES.keepPerMin, dt / 60_000);
  return { ...s, urge: urge < 0.05 ? 0 : urge, at: now };
}

export function addReasons(s: NpcUrgeState, reasons: UrgeReason[], now: number): NpcUrgeState {
  if (!reasons.length) return settleUrge(s, now);
  const settled = settleUrge(s, now);
  const pts = reasons.reduce((sum, r) => sum + r.pts, 0);
  const merged = [...settled.reasons, ...reasons].sort((a, b) => b.pts - a.pts).slice(0, 4);
  return { ...settled, urge: settled.urge + pts, reasons: merged };
}

/** The NPC spoke (or was hushed): urge gone, cooldown started. */
export function resetUrge(s: NpcUrgeState, now: number): NpcUrgeState {
  return { urge: 0, at: now, lastSpokeAt: now, reasons: [] };
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${escapeRe(word)}([^\\p{L}]|$)`, 'iu').test(text);
}
function firstWord(text: string, words: readonly string[]): string | null {
  for (const w of words) if (hasWord(text, w)) return w;
  return null;
}

export interface ScoreLineInput {
  text: string;
  /** Who said it. NPC lines score at half weight (overheard, not addressed). */
  speaker: 'rider' | 'npc';
  /** The speaking NPC's roster key and name, when speaker is 'npc'. */
  speakerKey?: string;
  speakerName?: string;
  npc: { key: string; name: string; aliases: string[] };
  temperament?: Temperament;
  era: CanonEra;
  /** The line was aimed at this NPC (it answers normally): no urge from it. */
  addressed?: boolean;
}

/** Score one heard line for one NPC. Each reason carries its (weighted) points. */
export function scoreLine(input: ScoreLineInput): UrgeReason[] {
  const { text, npc, era } = input;
  const t = input.temperament ?? NEUTRAL_TEMPERAMENT;
  const line = (text || '').trim();
  if (!line || input.addressed || input.speakerKey === npc.key) return [];
  const w = (k: keyof NonNullable<Temperament['reacts']>) => t.reacts?.[k] ?? 1;
  // Overheard NPC lines land softer than the rider speaking.
  const sp = input.speaker === 'npc' ? 0.5 : 1;
  const out: UrgeReason[] = [];
  const add = (pts: number, text: string) => { if (pts > 0) out.push({ pts: pts * sp, text }); };

  const names = [npc.name, ...npc.aliases].filter(n => n.trim().length >= 3);
  const named = names.some(n => hasWord(line, n));
  if (named) {
    add(URGE_POINTS.name, 'your name came up');
    const ins = firstWord(line, INSULT);
    if (ins) add(URGE_POINTS.insult * w('insult'), `you were called "${ins}" to your face`);
    const pr = firstWord(line, PRAISE);
    if (pr) add(URGE_POINTS.praise * w('praise'), 'you were praised');
  } else if (input.speaker === 'rider') {
    // Passed by again. The caller adds spotlightBonus on top after long silences.
    add(URGE_POINTS.ignored, 'the talk keeps passing you by');
  }

  const dg = firstWord(line, DANGER);
  if (dg) add(URGE_POINTS.danger * w('danger'), `there is talk of ${dg === 'venin' ? 'the venin' : 'danger'}`);
  const au = firstWord(line, AUTHORITY);
  if (au && (t.reacts?.authority ?? 1) !== 1) add(URGE_POINTS.authority * w('authority'), 'rules and rank are in question');

  for (const topic of t.topics ?? []) {
    if (!eraReached(topic.era, era)) continue;
    const hit = firstWord(line, topic.words);
    if (!hit) continue;
    if (topic.secret) add(URGE_POINTS.secret * w('secret'), 'the talk is circling something you keep to yourself');
    else add(URGE_POINTS.topic, `"${hit}" came up — that matters to you`);
    break; // one topic hit per line is enough
  }

  const feelingsByName = new Map<string, { feeling: string; pts: number }>();
  for (const p of t.people ?? []) {
    if (p.era && !eraReached(p.era, era)) continue;
    if (!hasWord(line, p.name)) continue;
    const grudge = p.feeling === 'hates' || p.feeling === 'rival' || p.feeling === 'blames';
    const pts = grudge ? URGE_POINTS.personGrudge : URGE_POINTS.person;
    const have = feelingsByName.get(p.name.toLowerCase());
    if (!have || pts > have.pts) feelingsByName.set(p.name.toLowerCase(), { feeling: p.feeling, pts });
  }
  for (const [name, hit] of feelingsByName) {
    const pretty = name.charAt(0).toUpperCase() + name.slice(1);
    add(hit.pts, `${pretty} was named, and what you feel about ${pretty} runs deep`);
  }

  const speakerName = input.speakerName;
  if (input.speaker === 'npc' && speakerName) {
    const rivalry = (t.people ?? []).some(p => (!p.era || eraReached(p.era, era))
      && (p.feeling === 'rival' || p.feeling === 'hates')
      && hasWord(speakerName, p.name));
    if (rivalry) add(URGE_POINTS.rivalSpeaks, `${input.speakerName} is doing the talking`);
  }

  if (t.peacemaker && !named && firstWord(line, INSULT)) {
    add(URGE_POINTS.argument, 'an argument is brewing and somebody should cool it');
  }

  return out;
}

/** The spotlight bonus: a rider line that passed this NPC by, doubled after long silence. */
export function spotlightBonus(s: NpcUrgeState, now: number): number {
  return now - s.lastSpokeAt > URGE_RULES.spotlightAfterMs ? URGE_POINTS.ignored : 0;
}

/** Silence points for idle, open-table time (temperament-weighted). */
export function silenceReasons(t: Temperament | undefined, idleMs: number): UrgeReason[] {
  const steps = Math.floor(idleMs / URGE_RULES.silenceStepMs);
  if (steps <= 0) return [];
  const weight = (t ?? NEUTRAL_TEMPERAMENT).reacts?.silence ?? 1;
  const pts = steps * URGE_POINTS.silenceStep * weight;
  return pts > 0 ? [{ pts, text: 'the silence is stretching' }] : [];
}

/** The urge an NPC needs before speaking, or null when it never speaks unprompted. */
export function effectiveThreshold(t: Temperament | undefined, talk: Talkativeness, scale = 1): number | null {
  if (talk === 'spoken-to') return null;
  const style = (t ?? NEUTRAL_TEMPERAMENT).style;
  return URGE_RULES.threshold * STYLE_FACTOR[style] * TALK_FACTOR[talk] * scale;
}

/** Where this NPC stands right now: ready to speak, showing a tell, or quiet. */
export function urgeStanding(s: NpcUrgeState, t: Temperament | undefined, talk: Talkativeness, now: number, scale = 1): 'speak' | 'tell' | null {
  const limit = effectiveThreshold(t, talk, scale);
  if (limit === null) return null;
  const settled = settleUrge(s, now);
  if (settled.urge >= limit) {
    return now - s.lastSpokeAt < URGE_RULES.cooldownMs ? 'tell' : 'speak';
  }
  return settled.urge >= limit * URGE_RULES.tellRatio ? 'tell' : null;
}

export interface WakeCandidate { key: string; state: NpcUrgeState; temperament?: Temperament; talk: Talkativeness; /** Learned taste × rank × table energy; missing = 1. */ scale?: number }

/** Who actually speaks: everyone ready, most-over-threshold first, capped. */
export function pickWakes(candidates: WakeCandidate[], now: number, max: number): string[] {
  return candidates
    .map(c => {
      const limit = effectiveThreshold(c.temperament, c.talk, c.scale ?? 1);
      if (limit === null || urgeStanding(c.state, c.temperament, c.talk, now, c.scale ?? 1) !== 'speak') return null;
      return { key: c.key, over: settleUrge(c.state, now).urge / limit };
    })
    .filter((x): x is { key: string; over: number } => !!x)
    .sort((a, b) => b.over - a.over)
    .slice(0, Math.max(0, max))
    .map(x => x.key);
}

/** The instruction block an unprompted line is written from: the reason and the way it comes out. */
export function whyBlock(npcName: string, riderName: string, s: NpcUrgeState, intent: UrgeIntent): string {
  const rider = riderName.trim() || 'the rider';
  const why = s.reasons.slice(0, 2).map(r => r.text).join(', and ') || 'something in the conversation pulls a reaction out of you';
  const how = intent === 'action'
    ? `Lead with the physical beat — a look, a move, a hand on a hilt — and keep any words to one short line.`
    : intent === 'whisper'
      ? `You speak quietly, only to ${rider}: open the dialogue line with *(quietly, to ${rider})*.`
      : `Say what you have to say, in your own voice.`;
  return `## WHY YOU SPEAK (unprompted)\nNobody addressed you, but you speak up on your own because ${why}. React to the conversation above as yourself — a thought of your own, not an answer to a question nobody asked you. ${how} Never ask for rolls, never start a fight, and never speak for ${rider}.`;
}

// ── Tier 2 (2026-11-17): learned taste, rank, ignored questions, table energy ──

/** True when the text names any of these (whole word, 3+ letters). */
export function mentionsAny(text: string, names: string[]): boolean {
  return names.some(n => n.trim().length >= 3 && hasWord(text, n));
}

/** The next learned-taste factor for an NPC: liked = the rider sealed their unprompted line; not liked = deleted it or hushed them. */
export function learnTaste(factor: number | undefined, liked: boolean): number {
  const next = (factor ?? 1) * (liked ? URGE_TUNING.likedStep : URGE_TUNING.dislikedStep);
  return Math.min(URGE_TUNING.learnedMax, Math.max(URGE_TUNING.learnedMin, Math.round(next * 1000) / 1000));
}

export type NpcRank = 'cadet' | 'officer' | 'command';
const RANK_ORDER: Record<NpcRank, number> = { cadet: 0, officer: 1, command: 2 };

/**
 * Rank from a role line ("Commanding General of Basgiath", "Lieutenant at Montserrat") and a titled name.
 * Cadet leaders (wingleader, section or squad leader) are still cadets: only commissioned
 * officers and command make cadets hold their tongue.
 */
export function rankFromRole(role: string | undefined, name?: string): NpcRank {
  const r = (role || '').toLowerCase();
  const n = (name || '').toLowerCase();
  // A title in the name ("Professor Emetterio", "Prince Halden") counts; "Prince Halden's guard" as a role does not make a prince.
  if (/\b(general|commandant|colonel|major|king|queen|duke|duchess|professor|curator)\b/.test(r)
    || /^(general|commandant|colonel|major|king|queen|prince|princess|duke|duchess|professor)\b/.test(n)) return 'command';
  if (/\b(lieutenant|captain)\b/.test(r) || /^(lieutenant|captain)\b/.test(n)) return 'officer';
  return 'cadet';
}

/** The threshold scale for an NPC of this rank while these other ranks are on stage. */
export function rankScale(own: NpcRank, othersOnStage: NpcRank[]): number {
  return othersOnStage.some(o => RANK_ORDER[o] > RANK_ORDER[own]) ? URGE_TUNING.outrankedScale : 1;
}

/** Does this NPC line put a question to the rider? */
export function asksQuestion(text: string): boolean {
  return /\?/.test(text || '');
}

/** The push from an unanswered question, given how many rider lines have passed it by. */
export function ignoredQuestionReasons(missedLines: number): UrgeReason[] {
  if (missedLines < URGE_TUNING.questionGraceLines) return [];
  const pts = missedLines === URGE_TUNING.questionGraceLines ? URGE_TUNING.questionFirstPush : URGE_TUNING.questionNextPush;
  return [{ pts, text: 'you asked a question and it was ignored' }];
}

export type TableEnergy = 'tense' | 'calm' | 'normal';

/** How charged a DM post is, by its words (no AI call). */
export function tableEnergy(dmText: string): TableEnergy {
  const text = (dmText || '').trim();
  if (!text) return 'normal';
  const hits = [...DANGER, ...REVEAL].filter(w => hasWord(text, w)).length;
  return hits >= URGE_TUNING.tenseWords ? 'tense' : hits === 0 ? 'calm' : 'normal';
}

/** The threshold scale from the latest DM post's energy, given how long ago it arrived. */
export function energyScale(energy: TableEnergy, sinceMs: number): number {
  if (energy === 'tense') return sinceMs < URGE_TUNING.tenseForMs ? URGE_TUNING.tenseScale : 1;
  return energy === 'calm' ? URGE_TUNING.calmScale : 1;
}

// ── Tier 3 (2026-11-17): memories as triggers, and the AI judge ──

export const URGE_TIER3 = {
  /** A rider line that touches something this NPC remembers about them. */
  memoryPts: 4,
  /** The same memory does not trigger again for this long. */
  memoryRestMs: 600_000,
  /** The judge is asked only when the word lists gave nobody this much, and the line has this many words. */
  judgeBelowPts: 3,
  judgeMinWords: 4,
  /** Outside a huddle, at least this long between judge calls. */
  judgeGapMs: 15_000,
  /** Judge strength 1, 2, 3 → this share of the read's points. */
  judgeStrength: [0.5, 0.75, 1],
} as const;

const STOP_WORDS = new Set(['about', 'after', 'again', 'against', 'always', 'another', 'around', 'because', 'before', 'being', 'between', 'could', 'during', 'every', 'first', 'having', 'might', 'never', 'other', 'rider', 'riders', 'should', 'since', 'something', 'still', 'their', 'there', 'these', 'thing', 'things', 'think', 'those', 'through', 'under', 'until', 'where', 'which', 'while', 'would', 'asked', 'said', 'told', 'looked', 'watched', 'stood', 'stayed', 'wanted', 'without', 'dragon', 'dragons', 'cadet', 'cadets', 'squad']);

function distinctiveWords(text: string, skip: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const w of (text || '').toLowerCase().split(/[^\p{L}]+/u)) {
    if (w.length >= 5 && !STOP_WORDS.has(w) && !skip.has(w)) out.add(w);
  }
  return out;
}

/**
 * The stored memory a line touches, by shared distinctive words (5+ letters, not common ones,
 * not anybody's name): two shared words, or one long one (8+ letters). No AI call.
 */
export function memoryMatch(text: string, memories: string[], names: string[]): { index: number; memory: string } | null {
  const skip = new Set(names.flatMap(n => n.toLowerCase().split(/[^\p{L}]+/u)).filter(Boolean));
  const said = distinctiveWords(text, skip);
  if (!said.size) return null;
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < memories.length; index++) {
    const shared = Array.from(distinctiveWords(memories[index], skip)).filter(w => said.has(w));
    const score = shared.length >= 2 ? shared.length + 1 : shared.some(w => w.length >= 8) ? 1 : 0;
    // The newest memory wins a tie.
    if (score > 0 && score >= bestScore) { bestIndex = index; bestScore = score; }
  }
  return bestIndex >= 0 ? { index: bestIndex, memory: memories[bestIndex] } : null;
}

export function memoryReason(memory: string): UrgeReason {
  return { pts: URGE_TIER3.memoryPts, text: `this touches something you remember: "${memory.trim().slice(0, 200)}" (bring it up if it fits)` };
}

/**
 * Should the AI judge read this rider line? Only a real sentence, aimed at somebody (it names
 * an NPC on stage, or says "you"), that the word lists made little of.
 */
export function needsJudge(text: string, bestListPts: number, namesOnStage: string[]): boolean {
  const line = (text || '').trim();
  const words = line.split(/\s+/).filter(Boolean).length;
  if (words < URGE_TIER3.judgeMinWords || bestListPts >= URGE_TIER3.judgeBelowPts) return false;
  return /(^|[^\p{L}])(you|your|yours|you're|youre)([^\p{L}]|$)/iu.test(line) || mentionsAny(line, namesOnStage);
}

export type JudgeRead = 'none' | 'insult' | 'mockery' | 'threat' | 'praise' | 'flirt' | 'secret_probe' | 'support' | 'challenge';
export type JudgeTone = 'neutral' | 'heated' | 'calm' | 'joking';
export interface JudgedItem { key: string; read: JudgeRead; strength: 1 | 2 | 3; memory: number }
export interface JudgedLine { tone: JudgeTone; sidesWith: string; items: JudgedItem[] }

const JUDGE_READ_POINTS: Record<Exclude<JudgeRead, 'none'>, { pts: number; weight?: UrgeCategory; text: string }> = {
  insult: { pts: URGE_POINTS.insult, weight: 'insult', text: 'that was an insult, however it was dressed' },
  mockery: { pts: 3, weight: 'insult', text: 'you are being mocked' },
  threat: { pts: URGE_POINTS.danger + 1, weight: 'danger', text: 'that sounded like a threat' },
  praise: { pts: URGE_POINTS.praise, weight: 'praise', text: 'that was meant as real praise' },
  flirt: { pts: 3, text: 'that was flirting, and it was aimed at you' },
  secret_probe: { pts: URGE_POINTS.secret, weight: 'secret', text: 'they are probing at something you keep to yourself' },
  support: { pts: 2, text: 'they are taking your side' },
  challenge: { pts: 3, text: 'that was a challenge' },
};

/** Urge points from the judge's read of a line for one NPC (weighted by temperament and strength). */
export function judgeReasons(item: JudgedItem, t: Temperament | undefined, memories: string[]): UrgeReason[] {
  const out: UrgeReason[] = [];
  if (item.read !== 'none') {
    const rule = JUDGE_READ_POINTS[item.read];
    const weight = rule.weight ? ((t ?? NEUTRAL_TEMPERAMENT).reacts?.[rule.weight] ?? 1) : 1;
    const pts = rule.pts * weight * URGE_TIER3.judgeStrength[item.strength - 1];
    if (pts > 0) out.push({ pts, text: rule.text });
  }
  const memory = item.memory >= 1 ? memories[item.memory - 1] : undefined;
  if (memory) out.push(memoryReason(memory));
  return out;
}
