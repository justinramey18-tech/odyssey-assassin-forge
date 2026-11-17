// Solo Empyrean huddles: NPCs on stage talk among themselves and the rider stands in it as a
// third voice. Pure rules, no React, no network; the solo Live Table hook runs them.
//
// - A SPARK starts one: friction between two NPCs, a topic both care about, or a disagreement
//   about the rider. Sparks build pressure per pair; a huddle opens when a pair crosses the line.
// - Inside: the urge meter picks who speaks next. HEAT (0 to 5) and each NPC's STANCE move with
//   what is said, and with whose side the rider takes. STEAM runs down a line at a time and the
//   rider's lines add to it, so it lasts as long as the rider is in it.
// - Across huddles (kept on the phone per campaign): TENSION per pair, the last things they
//   argued about (no reruns), and the rider's APPETITE and PACE.
// Nothing here writes saved data: memories and attitude still change only through Send to DM.
import { eraReached, type CanonEra } from '@/lib/empyreanCanon/castNpcs/types';
import { NEUTRAL_TEMPERAMENT, type Temperament } from '@/lib/empyreanCanon/castNpcs/temperament';

export const HUDDLE_RULES = {
  /** A pair opens a huddle at this much pressure (× the pair's taste, ÷ the rider's appetite). */
  pressureToOpen: 6,
  /** Pressure fades: this much is kept per minute. */
  pressureKeepPerMin: 0.7,
  /** Pressure from one heard line. */
  frictionSpeaks: 3,
  frictionNamed: 2,
  sharedTopic: 6,
  aboutRider: 4,
  /** Each point of carried tension adds this much pressure when a spark lands. */
  tensionBoost: 1,
  /** At least this long between huddles (÷ appetite). */
  gapMs: 180_000,
  /** NPC lines a fresh huddle has in it, before the rider adds any. */
  startSteam: 4,
  riderSteam: 2,
  maxSteam: 6,
  /** Never more NPC lines than this. */
  maxNpcLines: 12,
  maxMembers: 3,
  /** NPC lines in a row without the rider before one of them turns to the rider. */
  turnToRiderAfter: 3,
  /** A room that calls for short, low huddles (an officer near, a tense scene): steam × this. */
  hushedSteam: 0.6,
  /** A tense scene also makes huddles harder to start: pressure needed × this. */
  tensePressure: 1.5,
  maxHeat: 5,
  maxTension: 3,
  /** The pause before the next NPC line: half the rider's usual reply time, within these. */
  pauseMinMs: 4_000,
  pauseMaxMs: 12_000,
  defaultPaceMs: 14_000,
  /** While the rider is typing (a key within typingIdleMs), the next line waits, up to this long. */
  typingHoldMs: 20_000,
  typingIdleMs: 6_000,
  /** After the rider speaks, the answer comes quickly. */
  afterRiderMs: 1_500,
  appetiteMin: 0.6,
  appetiteMax: 1.5,
} as const;

export type SparkKind = 'friction' | 'topic' | 'about-rider';
export type Stance = 'pressing' | 'defending' | 'mocking' | 'calming' | 'dodging';
export type HuddleBeat = 'open' | 'build' | 'answer-rider' | 'turn-to-rider' | 'close' | 'break';
export type HuddleEnd = 'dropped' | 'broke' | 'enough' | 'interrupted';

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface HuddleNpc { key: string; name: string; temperament?: Temperament; /** Saved attitude toward the rider, -3 to 3 (read only). */ attitude: number }

// ── What the phone keeps between huddles ──

export interface PairRecord { tension: number; taste: number; topics: string[]; lastAt: number }
export interface HuddleTaste { appetite: number; paceMs: number; pairs: Record<string, PairRecord> }
export const freshTaste = (): HuddleTaste => ({ appetite: 1, paceMs: HUDDLE_RULES.defaultPaceMs, pairs: {} });
const freshPair = (): PairRecord => ({ tension: 0, taste: 1, topics: [], lastAt: 0 });
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Read what was saved, dropping anything malformed. */
export function readTaste(raw: unknown): HuddleTaste {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<HuddleTaste>;
  const pairs: Record<string, PairRecord> = {};
  for (const [k, v] of Object.entries(d.pairs && typeof d.pairs === 'object' ? d.pairs : {})) {
    if (!v || typeof v !== 'object') continue;
    pairs[k] = {
      tension: clamp(Number(v.tension) || 0, 0, HUDDLE_RULES.maxTension),
      taste: clamp(Number(v.taste) || 1, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax),
      topics: Array.isArray(v.topics) ? v.topics.filter((t): t is string => typeof t === 'string').slice(-3) : [],
      lastAt: Number(v.lastAt) || 0,
    };
  }
  return {
    appetite: clamp(Number(d.appetite) || 1, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax),
    paceMs: clamp(Number(d.paceMs) || HUDDLE_RULES.defaultPaceMs, 2_000, 60_000),
    pairs,
  };
}

// ── Sparks: pressure per pair ──

export interface PairPressure { pts: number; at: number; kind: SparkKind; about: string }

function feelingToward(t: Temperament | undefined, otherName: string, era: CanonEra): string | null {
  const first = otherName.trim().split(/\s+/);
  for (const p of (t ?? NEUTRAL_TEMPERAMENT).people ?? []) {
    if (p.era && !eraReached(p.era, era)) continue;
    if (first.some(w => w.toLowerCase() === p.name.toLowerCase())) return p.feeling;
  }
  return null;
}
const HOSTILE = new Set(['hates', 'rival', 'blames', 'wary']);

/** Bad blood between two NPCs, either way round. */
export function hasFriction(a: HuddleNpc, b: HuddleNpc, era: CanonEra): boolean {
  return HOSTILE.has(feelingToward(a.temperament, b.name, era) ?? '') || HOSTILE.has(feelingToward(b.temperament, a.name, era) ?? '');
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}])${escapeRe(word)}([^\\p{L}]|$)`, 'iu').test(text);
const firstName = (name: string) => name.trim().split(/\s+/).filter(w => !/^(general|colonel|professor|captain|lieutenant|major|king|queen|prince|princess)$/i.test(w))[0] || name;

/** The open (non-secret) topic word of theirs that a line hits, if any. */
export function topicHit(text: string, t: Temperament | undefined, era: CanonEra): string | null {
  for (const topic of (t ?? NEUTRAL_TEMPERAMENT).topics ?? []) {
    if (topic.secret || !eraReached(topic.era, era)) continue;
    for (const w of topic.words) if (hasWord(text, w)) return w;
  }
  return null;
}

export interface SparkInput {
  text: string;
  speaker: 'rider' | 'npc';
  speakerKey?: string;
  /** NPCs on stage who may speak on their own. */
  stage: HuddleNpc[];
  era: CanonEra;
  now: number;
}

/**
 * One heard line adds pressure to the pairs it stirs. Returns the new pressures (old ones faded).
 * - friction: one of a pair with bad blood speaks, or the rider names one of them;
 * - topic: the line hits a topic both care about;
 * - about the rider: an NPC who likes the rider speaks while one who dislikes them is listening.
 */
export function addPressure(prev: Record<string, PairPressure>, input: SparkInput, taste: HuddleTaste): Record<string, PairPressure> {
  const out: Record<string, PairPressure> = {};
  for (const [k, p] of Object.entries(prev)) {
    const pts = p.pts * Math.pow(HUDDLE_RULES.pressureKeepPerMin, Math.max(0, input.now - p.at) / 60_000);
    if (pts >= 0.25) out[k] = { ...p, pts, at: input.now };
  }
  const line = (input.text || '').trim();
  if (!line) return out;
  const bump = (a: HuddleNpc, b: HuddleNpc, pts: number, kind: SparkKind, about: string) => {
    const k = pairKey(a.key, b.key);
    const had = out[k];
    const carried = had ? 0 : (taste.pairs[k]?.tension ?? 0) * HUDDLE_RULES.tensionBoost;
    out[k] = { pts: (had?.pts ?? 0) + pts + carried, at: input.now, kind: had && had.pts > pts ? had.kind : kind, about: had && had.pts > pts ? had.about : about };
  };
  for (let i = 0; i < input.stage.length; i++) {
    for (let j = i + 1; j < input.stage.length; j++) {
      const a = input.stage[i];
      const b = input.stage[j];
      const aNamed = hasWord(line, firstName(a.name));
      const bNamed = hasWord(line, firstName(b.name));
      if (hasFriction(a, b, input.era)) {
        if (input.speaker === 'npc' && (input.speakerKey === a.key || input.speakerKey === b.key)) bump(a, b, HUDDLE_RULES.frictionSpeaks, 'friction', 'the bad blood between you');
        else if (input.speaker === 'rider' && (aNamed || bNamed)) bump(a, b, HUDDLE_RULES.frictionNamed, 'friction', 'the bad blood between you');
      }
      const ta = topicHit(line, a.temperament, input.era);
      const tb = topicHit(line, b.temperament, input.era);
      if (ta && tb) bump(a, b, HUDDLE_RULES.sharedTopic, 'topic', `"${ta}"`);
      if (input.speaker === 'npc') {
        const speaker = input.speakerKey === a.key ? a : input.speakerKey === b.key ? b : null;
        const other = speaker === a ? b : a;
        if (speaker && speaker.attitude >= 1 && other.attitude <= -1) bump(a, b, HUDDLE_RULES.aboutRider, 'about-rider', 'the rider, and whether they have earned any trust');
      }
    }
  }
  return out;
}

export interface Spark { pair: [string, string]; kind: SparkKind; about: string }

/** The pair whose pressure has crossed the line, strongest first; null when nobody has, or it is too soon. */
export function readySpark(pressure: Record<string, PairPressure>, taste: HuddleTaste, opts: { now: number; lastHuddleAt: number; tense: boolean }): Spark | null {
  if (opts.now - opts.lastHuddleAt < HUDDLE_RULES.gapMs / taste.appetite) return null;
  let best: { key: string; over: number } | null = null;
  for (const [k, p] of Object.entries(pressure)) {
    const need = HUDDLE_RULES.pressureToOpen * (1 / (taste.pairs[k]?.taste ?? 1)) * (1 / taste.appetite) * (opts.tense ? HUDDLE_RULES.tensePressure : 1);
    const over = p.pts / need;
    if (over >= 1 && (!best || over > best.over)) best = { key: k, over };
  }
  if (!best) return null;
  const [a, b] = best.key.split('|');
  const p = pressure[best.key];
  return { pair: [a, b], kind: p.kind, about: p.about };
}

// ── A running huddle ──

export interface Huddle {
  id: string;
  pair: [string, string];
  members: string[];
  kind: SparkKind;
  about: string;
  heat: number;
  steam: number;
  npcLines: number;
  riderLines: number;
  /** NPC lines in a row since the rider last spoke. */
  sinceRider: number;
  lastSpeaker: string | null;
  /** The last line was the rider's. */
  riderSpokeLast: boolean;
  stances: Record<string, Stance>;
  /** The member the rider last sided with. */
  ally: string | null;
  turnedToRider: boolean;
  /** Members the rider just named: they answer first. */
  named: string[];
  startedAt: number;
}

/** Where an NPC starts: from what they feel about the other, the spark, and the rider. */
export function initialStance(self: HuddleNpc, other: HuddleNpc, kind: SparkKind, era: CanonEra, opener: boolean): Stance {
  const t = self.temperament ?? NEUTRAL_TEMPERAMENT;
  if (t.peacemaker) return 'calming';
  const feeling = feelingToward(t, other.name, era);
  if (feeling === 'hates' || feeling === 'blames') return 'pressing';
  if (feeling === 'rival') return opener ? 'mocking' : 'pressing';
  if (feeling === 'wary') return opener ? 'pressing' : 'dodging';
  if (kind === 'about-rider') return self.attitude >= 1 ? 'defending' : 'pressing';
  if (t.style === 'quiet') return opener ? 'pressing' : 'dodging';
  return opener ? 'pressing' : 'defending';
}

export function openHuddle(spark: Spark, a: HuddleNpc, b: HuddleNpc, taste: HuddleTaste, opts: { era: CanonEra; now: number; hushed: boolean; id: string }): Huddle {
  const rec = taste.pairs[pairKey(a.key, b.key)];
  const tension = rec?.tension ?? 0;
  const steam = HUDDLE_RULES.startSteam * taste.appetite * (opts.hushed ? HUDDLE_RULES.hushedSteam : 1);
  // The one with the grudge opens.
  const aOpens = HOSTILE.has(feelingToward(a.temperament, b.name, opts.era) ?? '') || !HOSTILE.has(feelingToward(b.temperament, a.name, opts.era) ?? '');
  const first = aOpens ? a : b;
  const second = aOpens ? b : a;
  return {
    id: opts.id,
    pair: [first.key, second.key],
    members: [first.key, second.key],
    kind: spark.kind,
    about: spark.about,
    heat: clamp(1 + (spark.kind === 'friction' ? 1 : 0) + (tension >= 2 ? 1 : 0), 0, HUDDLE_RULES.maxHeat - 1),
    steam: Math.max(2, Math.round(steam)),
    npcLines: 0, riderLines: 0, sinceRider: 0,
    lastSpeaker: null, riderSpokeLast: false,
    stances: {
      [first.key]: initialStance(first, second, spark.kind, opts.era, true),
      [second.key]: initialStance(second, first, spark.kind, opts.era, false),
    },
    ally: null, turnedToRider: false, named: [], startedAt: opts.now,
  };
}

const HOT_WORDS = ['coward', 'liar', 'traitor', 'pathetic', 'worthless', 'useless', 'idiot', 'fool', 'shut up', 'how dare', 'say that again', 'never'];
const COOL_WORDS = ['enough', 'fine', 'forget it', 'sorry', 'you are right', "you're right", 'fair', 'peace', 'let it go', 'drop it'];
const anyWord = (text: string, words: string[]) => words.some(w => hasWord(text, w));

/** A member's line landed: steam runs down, heat follows the words and the speaker's stance. */
export function afterNpcLine(h: Huddle, key: string, text: string): Huddle {
  const stance = h.stances[key];
  let heat = h.heat;
  if (anyWord(text, HOT_WORDS) || /!/.test(text)) heat += 1;
  if (stance === 'calming' || anyWord(text, COOL_WORDS)) heat -= 1;
  return {
    ...h,
    heat: clamp(heat, 0, HUDDLE_RULES.maxHeat),
    steam: h.steam - 1,
    npcLines: h.npcLines + 1,
    sinceRider: h.sinceRider + 1,
    lastSpeaker: key,
    riderSpokeLast: false,
    named: h.named.filter(k => k !== key),
  };
}

export interface RiderCut { named: string[]; sidesWith?: string | null; tone?: 'neutral' | 'heated' | 'calm' | 'joking' }

/** The rider cut in: more steam, and whoever they named answers first. */
export function afterRiderLine(h: Huddle, cut: RiderCut): Huddle {
  const named = cut.named.filter(k => h.members.includes(k));
  return applyRead({
    ...h,
    steam: Math.min(HUDDLE_RULES.maxSteam, h.steam + HUDDLE_RULES.riderSteam),
    riderLines: h.riderLines + 1,
    sinceRider: 0,
    riderSpokeLast: true,
    named,
  }, cut);
}

/** The judge's read of the rider's line (it can arrive a moment later): side and tone move stances and heat. */
export function applyRead(h: Huddle, cut: Pick<RiderCut, 'sidesWith' | 'tone'>): Huddle {
  let heat = h.heat;
  if (cut.tone === 'heated') heat += 1;
  if (cut.tone === 'calm' || cut.tone === 'joking') heat -= 1;
  const stances = { ...h.stances };
  let ally = h.ally;
  const side = cut.sidesWith && h.members.includes(cut.sidesWith) ? cut.sidesWith : null;
  if (side) {
    ally = side;
    // Backed, they press; the others dig in, or go on the defensive if they were already pressing.
    stances[side] = stances[side] === 'calming' ? 'calming' : 'pressing';
    for (const k of h.members) {
      if (k === side) continue;
      stances[k] = stances[k] === 'pressing' ? 'defending' : stances[k] === 'calming' ? 'calming' : 'mocking';
    }
  }
  return { ...h, heat: clamp(heat, 0, HUDDLE_RULES.maxHeat), stances, ally };
}

/** Someone else on stage steps in (the talk hit them hard enough). */
export function joinHuddle(h: Huddle, npc: HuddleNpc): Huddle {
  if (h.members.includes(npc.key) || h.members.length >= HUDDLE_RULES.maxMembers) return h;
  const stance: Stance = (npc.temperament ?? NEUTRAL_TEMPERAMENT).peacemaker ? 'calming' : npc.attitude >= 1 && h.kind === 'about-rider' ? 'defending' : 'pressing';
  return { ...h, members: [...h.members, npc.key], stances: { ...h.stances, [npc.key]: stance }, named: [npc.key, ...h.named], steam: Math.min(HUDDLE_RULES.maxSteam, h.steam + 1) };
}

/** A member is no longer on stage. Null when the huddle cannot go on. */
export function leaveHuddle(h: Huddle, key: string): Huddle | null {
  const members = h.members.filter(k => k !== key);
  if (members.length < 2) return null;
  return { ...h, members, named: h.named.filter(k => k !== key), ally: h.ally === key ? null : h.ally };
}

/** Who speaks next: someone the rider named, else whoever most wants to, never the same voice twice running. */
export function nextSpeaker(h: Huddle, urge: Record<string, number>): string {
  const named = h.named.find(k => h.members.includes(k));
  if (named) return named;
  if (h.npcLines === 0) return h.pair[0];
  const pool = h.members.filter(k => k !== h.lastSpeaker);
  const from = pool.length ? pool : h.members;
  return from.reduce((best, k) => ((urge[k] ?? 0) > (urge[best] ?? 0) ? k : best), from[0]);
}

/** What kind of line comes next. */
export function nextBeat(h: Huddle): HuddleBeat {
  if (h.npcLines === 0) return 'open';
  if (h.heat >= HUDDLE_RULES.maxHeat) return 'break';
  if (h.steam <= 1 || h.npcLines >= HUDDLE_RULES.maxNpcLines - 1) return 'close';
  if (h.riderSpokeLast) return 'answer-rider';
  if (h.sinceRider >= HUDDLE_RULES.turnToRiderAfter && !h.turnedToRider) return 'turn-to-rider';
  return 'build';
}

/** The pause before the next NPC line. */
export function pauseMs(taste: HuddleTaste, afterRider: boolean): number {
  if (afterRider) return HUDDLE_RULES.afterRiderMs;
  return clamp(Math.round(taste.paceMs / 2), HUDDLE_RULES.pauseMinMs, HUDDLE_RULES.pauseMaxMs);
}

const STANCE_TEXT: Record<Stance, string> = {
  pressing: 'pressing: you are on the attack and want an answer',
  defending: 'defending: you are holding your ground',
  mocking: 'mocking: you are needling them and enjoying it',
  calming: 'calming: you want this cooled down before it gets worse',
  dodging: 'dodging: you would rather not have this conversation here',
};
const HEAT_TEXT = ['cold and clipped', 'cool', 'tense', 'sharp', 'raised voices, a step closer', 'about to break'];
const TURN_TEXT: Record<Stance, string> = {
  pressing: 'tell them to back you up',
  defending: 'remind them they were there, and ask them to say so',
  mocking: 'needle them for standing there saying nothing',
  calming: 'ask them to help you settle it',
  dodging: 'use them as your way out of this',
};

export interface HuddleBlockInput {
  h: Huddle;
  self: HuddleNpc;
  others: string[];
  riderName: string;
  beat: HuddleBeat;
  /** Who said the quoted line this NPC answers. */
  lastName: string | null;
  /** A higher rank is within earshot. */
  lowVoice: boolean;
  /** What this pair already argued about (no reruns). */
  doneBefore: string[];
  /** Tension carried from last time. */
  tension: number;
  /** Something this NPC remembers about the rider that fits the talk. */
  memory?: string | null;
}

/** The instruction block for one huddle line. */
export function huddleBlock(input: HuddleBlockInput): string {
  const { h, self, beat } = input;
  const rider = input.riderName.trim() || 'the rider';
  const others = input.others.join(' and ');
  const stance = h.stances[self.key] ?? 'defending';
  const allyLine = h.ally === self.key
    ? `${rider} has taken your side. You know it, and it makes you bolder.`
    : h.ally && h.members.includes(h.ally)
      ? `${rider} has taken the other side against you. You noticed, and you may say so.`
      : '';
  const step: Record<HuddleBeat, string> = {
    open: `Start it: say your first line to ${others}, about ${h.about}.`,
    build: `Answer what ${input.lastName || others} just said (in quotes), and push it one step further.`,
    'answer-rider': `${rider} just cut in (the quoted line is theirs). Answer ${rider} in a sentence, then turn it back on ${others}: do not let the conversation end.`,
    'turn-to-rider': `${rider} has stood there saying nothing. Turn to them now and ${TURN_TEXT[stance]}.`,
    close: 'Let it drop now: a parting shot, a shrug, a look, or walking away. This is the last line of it.',
    break: stance === 'calming'
      ? 'This has gone as far as words can. Step between them and end it. This is the last line of it.'
      : 'This has gone as far as words can. Break it: a challenge to the mat, or turn your back and leave. This is the last line of it.',
  };
  return [
    `## HUDDLE\nYou and ${others} are talking among yourselves about ${h.about}. ${rider} is standing with you, hears all of it, and can cut in at any time.`,
    `Your stance right now is ${STANCE_TEXT[stance]}.`,
    `The heat is ${h.heat} of ${HUDDLE_RULES.maxHeat}: ${HEAT_TEXT[clamp(h.heat, 0, 5)]}.`,
    allyLine,
    input.tension >= 1 ? `You two have left this unfinished before${input.tension >= 2 ? ', more than once, and it shows' : ''}.` : '',
    input.doneBefore.length ? `You have already been over: ${input.doneBefore.join('; ')}. Do not repeat that ground; move on or go further.` : '',
    input.lowVoice ? 'Someone of higher rank is within earshot: keep your voice down and your words short.' : '',
    input.memory ? `You remember this about ${rider}: "${input.memory.trim().slice(0, 200)}". Use it if it fits.` : '',
    `THIS LINE: ${step[beat]}`,
    `One to three sentences, in your own voice. Speak only as ${self.name}. Never speak or act for ${rider} or for ${others}, never ask for rolls, and do not settle the matter for everyone.`,
  ].filter(Boolean).join('\n');
}

// ── When it ends: what carries over ──

export interface HuddleOutcome { end: HuddleEnd; h: Huddle; sealed?: boolean }

/** A huddle ended: tension for the pair, no-rerun topics, and the rider's appetite and pair taste. */
export function settleHuddle(taste: HuddleTaste, out: HuddleOutcome, now: number): HuddleTaste {
  const { h, end } = out;
  const k = pairKey(h.pair[0], h.pair[1]);
  const rec = { ...(taste.pairs[k] ?? freshPair()) };
  // Broke or ended hot: unfinished business. Ended cool: it is settled for now.
  const delta = end === 'broke' ? 2 : h.heat >= 3 ? 1 : h.heat <= 1 ? -1 : 0;
  rec.tension = clamp(rec.tension + (end === 'interrupted' && h.npcLines < 2 ? 0 : delta), 0, HUDDLE_RULES.maxTension);
  if (h.npcLines >= 2) rec.topics = [...rec.topics.filter(t => t !== h.about), h.about].slice(-3);
  rec.lastAt = now;
  let appetite = taste.appetite;
  if (end === 'enough') { appetite *= 0.85; rec.taste *= 0.85; }
  else if (end !== 'interrupted') {
    if (h.riderLines > 0) { appetite *= 1.05; rec.taste *= 1.05; }
    else { appetite *= 0.95; }
  }
  rec.taste = round3(clamp(rec.taste, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax));
  return { ...taste, appetite: round3(clamp(appetite, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax)), pairs: { ...taste.pairs, [k]: rec } };
}

/** The rider sealed the conversation for the DM: they liked it. */
export function likedHuddle(taste: HuddleTaste, pair: [string, string]): HuddleTaste {
  const k = pairKey(pair[0], pair[1]);
  const rec = { ...(taste.pairs[k] ?? freshPair()) };
  rec.taste = round3(clamp(rec.taste * 1.05, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax));
  return { ...taste, appetite: round3(clamp(taste.appetite * 1.05, HUDDLE_RULES.appetiteMin, HUDDLE_RULES.appetiteMax)), pairs: { ...taste.pairs, [k]: rec } };
}

/** The rider's usual time to answer, smoothed, from one more reply. */
export function learnPace(taste: HuddleTaste, replyMs: number): HuddleTaste {
  if (!(replyMs > 0) || replyMs > 120_000) return taste;
  return { ...taste, paceMs: Math.round(taste.paceMs * 0.7 + replyMs * 0.3) };
}
