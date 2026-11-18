// Solo Empyrean: how a live NPC's line is delivered. Pure rules, no React, no network.
//
// The old rule forced every line into the same two-line shape. Here the NPC is given facts
// about themselves and the moment (voice, mood, audience, their own private note from last
// time) and writes the turn the way that person would.
// - SHAPE: left to itself a model writes every turn to the same length and layout (it fills the
//   ceiling and copies its own earlier lines). So the APP picks each turn's shape (how many words,
//   where the one movement goes) by weighted chance from the moment, never the same band three
//   times running; says it as a hard instruction; and trims a turn that badly overshoots.
// - PRIVATE MIND: after its turn the NPC writes a hidden note (what it wants, what it kept back,
//   where its body is, any truth it is hiding). Only that NPC ever reads it again.
// - ACTIONS: a rare hidden marker for something that changes the scene (leaving, stepping
//   between people, squaring up, handing something over).
// Nothing here is saved to the database: notes live on the phone per campaign.

import type { NpcVoice } from '@/lib/empyreanCanon/castNpcs/voice';

export const DELIVERY_RULES = {
  /** The most words of speech in one turn. */
  maxWords: 90,
  /** Each field of the private note is cut to this. */
  noteChars: 140,
  /** A note older than this is dropped (a different day, a different scene). */
  noteMaxAgeMs: 6 * 3_600_000,
  /** Lines looked at when checking for sameness. */
  historyLines: 3,
  /** The token budget for a turn with its note. */
  maxTokens: 460,
} as const;

// ── The private mind ──

export interface MindNote { want: string; unsaid: string; body: string; truth: string; at: number }
export type NpcAction = { kind: 'leave' } | { kind: 'between' } | { kind: 'square-up' } | { kind: 'give'; what: string } | { kind: 'travel'; place: string };

const MIND_RE = /⟪MIND\b([^⟫]*)⟫/;
const ACT_RE = /⟪ACT\b([^⟫]*)⟫/;
const cut = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const isNothing = (s: string) => /^(nothing|none|n\/a|no|-|—)?\.?$/i.test(s.trim());

/** Split a reply into what is shown, the private note, and an action. Cut-off or malformed markers are dropped, never shown. */
export function readTurn(reply: string, now: number): { text: string; note: MindNote | null; action: NpcAction | null } {
  let text = reply || '';
  let note: MindNote | null = null;
  let action: NpcAction | null = null;
  const m = MIND_RE.exec(text);
  if (m) {
    const fields: Record<string, string> = {};
    for (const part of m[1].split('|')) {
      const i = part.indexOf(':');
      if (i > 0) fields[part.slice(0, i).trim().toLowerCase()] = cut(part.slice(i + 1), DELIVERY_RULES.noteChars);
    }
    const truth = fields.truth && !isNothing(fields.truth) ? fields.truth : '';
    if (fields.want || fields.unsaid || fields.body || truth) note = { want: fields.want ?? '', unsaid: isNothing(fields.unsaid ?? '') ? '' : fields.unsaid ?? '', body: fields.body ?? '', truth, at: now };
  }
  const a = ACT_RE.exec(text);
  if (a) {
    const body = cut(a[1], 120);
    const lower = body.toLowerCase();
    if (lower.startsWith('leave')) action = { kind: 'leave' };
    else if (lower.startsWith('between')) action = { kind: 'between' };
    else if (lower.startsWith('square')) action = { kind: 'square-up' };
    else if (lower.startsWith('give')) { const what = cut(body.replace(/^give\s*:?/i, ''), 80); if (what) action = { kind: 'give', what }; }
    else if (lower.startsWith('travel')) { const place = cut(body.replace(/^travel\s*:?/i, ''), 80); if (place) action = { kind: 'travel', place }; }
  }
  // Take out every marker of ours, closed or cut off by the length limit.
  text = text.replace(/⟪MIND\b[^⟫]*⟫/g, '').replace(/⟪ACT\b[^⟫]*⟫/g, '').replace(/⟪(?:MIND|ACT)\b[^⟫]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text, note, action };
}

/** Keep only notes still worth reading. */
export function readNotes(raw: unknown, now: number): Record<string, MindNote> {
  const out: Record<string, MindNote> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, Partial<MindNote> | null>)) {
    if (!v || typeof v.at !== 'number' || now - v.at > DELIVERY_RULES.noteMaxAgeMs) continue;
    const s = (x: unknown) => (typeof x === 'string' ? cut(x, DELIVERY_RULES.noteChars) : '');
    out[k] = { want: s(v.want), unsaid: s(v.unsaid), body: s(v.body), truth: s(v.truth), at: v.at };
  }
  return out;
}

// ── Measuring what came out ──

export type BeatPlace = 'none' | 'before' | 'after' | 'mid' | 'only';
export interface LineShape { key: string; words: number; beat: BeatPlace; parts: string[] }

const BODY_PARTS = ['eyes', 'eye', 'gaze', 'jaw', 'arms', 'shoulders', 'shoulder', 'hands', 'hand', 'fingers', 'brow', 'eyebrow', 'smirk', 'grin', 'lips', 'mouth', 'chin', 'head', 'fists', 'fist', 'breath'];
const PART_GROUP: Record<string, string> = { eye: 'eyes', gaze: 'eyes', shoulder: 'shoulders', hand: 'hands', fingers: 'hands', eyebrow: 'brow', grin: 'mouth', smirk: 'mouth', lips: 'mouth', fist: 'fists' };

/** The shape of a line as shown: how many spoken words, where the movement sits, which parts of the body it used. */
export function measureLine(key: string, shown: string): LineShape {
  const body = (shown || '').replace(/^\s*(?:🤫\s*)?\*\*[^*\n]{1,80}:\*\*\s*/, '').replace(/⟪[^⟫]*⟫[\s\S]*?⟪\/[A-Z]+⟫/g, '').trim();
  const beats = Array.from(body.matchAll(/\*([^*\n]+)\*/g));
  const speech = body.replace(/\*[^*\n]+\*/g, ' ').replace(/\(You sense:[^)]*\)/gi, ' ');
  const words = (speech.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || []).length;
  let beat: BeatPlace = 'none';
  if (beats.length) {
    const first = beats[0].index ?? 0;
    const last = beats[beats.length - 1];
    const lastEnd = (last.index ?? 0) + last[0].length;
    const before = body.slice(0, first).replace(/[\s"“”.,…—-]/g, '') === '';
    const after = body.slice(lastEnd).replace(/[\s"“”.,…—-]/g, '') === '';
    beat = words === 0 ? 'only' : before && !after ? 'before' : after && !before ? 'after' : before && after ? 'only' : 'mid';
    if (beat === 'only' && words > 0) beat = 'mid';
  }
  const beatText = beats.map(b => b[1].toLowerCase()).join(' ');
  const parts = Array.from(new Set(BODY_PARTS.filter(p => new RegExp(`\\b${p}\\b`).test(beatText)).map(p => PART_GROUP[p] ?? p)));
  return { key, words, beat, parts };
}

const PLACE_TEXT: Record<BeatPlace, string> = { none: 'with no movement at all', before: 'with the movement before the words', after: 'with the movement after the words', mid: 'with the movement in the middle', only: 'as a movement with no words' };

/**
 * What to tell this NPC when the table is getting samey. Looks at their own recent lines and the
 * table's: the same length band, the movement always in the same place, the same part of the body.
 * Empty when there is nothing to correct.
 */
export function samenessNote(key: string, history: LineShape[]): string {
  const n = DELIVERY_RULES.historyLines;
  const mine = history.filter(h => h.key === key).slice(-n);
  const table = history.slice(-n);
  const notes: string[] = [];
  const band = (w: number) => (w === 0 ? 0 : w <= 6 ? 1 : w <= 18 ? 2 : w <= 40 ? 3 : 4);
  const BAND_TEXT = ['wordless', 'only a few words', 'one sentence', 'a couple of sentences', 'long'];
  for (const [who, lines] of [['Your last', mine], ['The last', table]] as const) {
    if (lines.length < n) continue;
    if (lines.every(l => band(l.words) === band(lines[0].words))) {
      notes.push(`${who} ${n} lines${who === 'The last' ? ' at the table' : ''} were all ${BAND_TEXT[band(lines[0].words)]}. If the moment allows, make this one clearly ${band(lines[0].words) >= 3 ? 'shorter' : 'different in length'}.`);
      break;
    }
  }
  for (const [who, lines] of [['Your last', mine], ['The last', table]] as const) {
    if (lines.length < n) continue;
    if (lines.every(l => l.beat === lines[0].beat)) {
      notes.push(`${who} ${n} lines${who === 'The last' ? ' at the table' : ''} were each written ${PLACE_TEXT[lines[0].beat]}. Do it another way this time.`);
      break;
    }
  }
  const used = new Map<string, number>();
  for (const l of mine) for (const p of l.parts) used.set(p, (used.get(p) ?? 0) + 1);
  const worn = Array.from(used.entries()).filter(([, c]) => c >= 2).map(([p]) => p);
  if (worn.length) notes.push(`You keep using your ${worn.join(' and your ')}. Use another part of you, the room, or nothing.`);
  return notes.join(' ');
}

// ── The shape of a turn: chosen by the app, not by the model ──

export type LengthBand = 'silent' | 'few' | 'one' | 'couple' | 'long';
export interface TurnShape { band: LengthBand; minWords: number; maxWords: number; beat: BeatPlace }

/** Spoken words per band. The top band ends at the old ceiling. */
export const SHAPE_BANDS: Record<LengthBand, { min: number; max: number }> = {
  silent: { min: 0, max: 0 },
  few: { min: 1, max: 6 },
  one: { min: 7, max: 18 },
  couple: { min: 19, max: 40 },
  long: { min: 41, max: DELIVERY_RULES.maxWords },
};

const BAND_ORDER: LengthBand[] = ['silent', 'few', 'one', 'couple', 'long'];
/** How often each band comes up before the moment is weighed in (out of 100). */
const BAND_BASE: Record<LengthBand, number> = { silent: 8, few: 26, one: 32, couple: 22, long: 12 };
const BEAT_BASE: Record<Exclude<BeatPlace, 'only'>, number> = { none: 32, before: 20, after: 24, mid: 24 };

export function bandOf(words: number): LengthBand {
  return words <= 0 ? 'silent' : words <= 6 ? 'few' : words <= 18 ? 'one' : words <= 40 ? 'couple' : 'long';
}

export interface ShapeInput {
  key: string;
  /** Recent lines at the table as measured, oldest first. */
  history: LineShape[];
  style: 'quiet' | 'normal' | 'loud';
  /** The urge meter's level over their own bar (0 calm, 1 at the point of speaking, more = past it). */
  stir: number;
  directQuestion: boolean;
  closing: boolean;
  whisper: boolean;
  /** Words in the rider's line this answers (0 when it answers nobody). */
  riderWords: number;
  /** The turn has to carry something (a check result, a sense line, a memory): never wordless, rarely tiny. */
  needsRoom: boolean;
  /** Random numbers in [0, 1): Math.random in the app, fixed values in tests. */
  roll: () => number;
}

function pick<T extends string>(weights: Record<T, number>, order: T[], roll: number, fallback: T): T {
  const total = order.reduce((sum, k) => sum + Math.max(0, weights[k]), 0);
  if (total <= 0) return fallback;
  let at = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const k of order) {
    at -= Math.max(0, weights[k]);
    if (at < 0) return k;
  }
  return fallback;
}

/**
 * Choose this turn's shape. Weighted chance, bent by the moment (who they are, how stirred they
 * are, what was asked), and steered away from what this NPC and the table just did.
 */
export function planTurn(i: ShapeInput): TurnShape {
  const w: Record<LengthBand, number> = { ...BAND_BASE };
  const mul = (band: LengthBand, by: number) => { w[band] *= by; };
  if (i.style === 'quiet') { mul('silent', 1.5); mul('few', 1.6); mul('couple', 0.7); mul('long', 0.4); }
  if (i.style === 'loud') { mul('silent', 0.4); mul('few', 0.7); mul('couple', 1.3); mul('long', 1.8); }
  // Worked up: people snap, or it pours out. The measured middle goes.
  if (i.stir >= 0.9) { mul('few', 1.3); mul('one', 0.8); mul('long', 1.6); }
  if (i.riderWords > 0 && i.riderWords <= 4) { mul('few', 1.5); mul('long', 0.5); }
  if (i.riderWords >= 40) { mul('couple', 1.3); mul('long', 1.3); }
  if (i.whisper) { mul('few', 1.5); mul('couple', 0.5); w.long = 0; }
  if (i.closing) { mul('silent', 1.5); mul('few', 2); mul('couple', 0.3); w.long = 0; }
  if (i.directQuestion) { w.silent = 0; mul('few', 0.8); }
  if (i.needsRoom) { w.silent = 0; mul('few', 0.5); }
  // Not what they just did, and never the same band three times running.
  const mine = i.history.filter(h => h.key === i.key);
  const last = mine[mine.length - 1];
  const prev = mine[mine.length - 2];
  if (last) mul(bandOf(last.words), 0.25);
  if (last && prev && bandOf(last.words) === bandOf(prev.words)) w[bandOf(last.words)] = 0;
  const table = i.history[i.history.length - 1];
  if (table && table.key !== i.key) mul(bandOf(table.words), 0.6);
  const band = pick(w, BAND_ORDER, i.roll(), 'one');

  let beat: BeatPlace = 'only';
  if (band !== 'silent') {
    const b: Record<Exclude<BeatPlace, 'only'>, number> = { ...BEAT_BASE };
    if (band === 'few') { b.none *= 2; b.mid = 0; }
    if (last && last.beat !== 'only') b[last.beat] *= 0.2;
    if (last && prev && last.beat === prev.beat && last.beat !== 'only') b[last.beat] = 0;
    if (table && table.key !== i.key && table.beat !== 'only') b[table.beat] *= 0.6;
    beat = pick(b, ['none', 'before', 'after', 'mid'], i.roll(), 'none');
  }
  return { band, minWords: SHAPE_BANDS[band].min, maxWords: SHAPE_BANDS[band].max, beat };
}

const BAND_ASK: Record<LengthBand, string> = {
  silent: 'no spoken words at all. Answer with one movement, look or silence, written in *italics*',
  few: 'between 1 and 6 spoken words. A fragment is fine',
  one: 'one sentence of 7 to 18 spoken words',
  couple: 'two or three sentences, 19 to 40 spoken words in all',
  long: `this is the turn where they talk: 41 to ${DELIVERY_RULES.maxWords} spoken words`,
};

const BEAT_ASK: Record<BeatPlace, string> = {
  none: 'No movement and no body language this turn: words only, nothing in italics.',
  before: 'Exactly one short movement in *italics* (10 words or fewer), before the words. No other italics.',
  after: 'Exactly one short movement in *italics* (10 words or fewer), after the words. No other italics.',
  mid: 'Exactly one short movement in *italics* (10 words or fewer), in the middle of the words. No other italics.',
  only: 'The movement is the whole turn.',
};

/** The shape as the NPC is told it. */
export function shapeAsk(shape: TurnShape): string {
  return `THIS TURN'S SHAPE (chosen for you so that no two turns sound alike; follow it exactly): ${BAND_ASK[shape.band]}. ${BEAT_ASK[shape.beat]} Count the spoken words before you answer.`;
}

/** Only the worn-out body parts (length and layout are now chosen by the app, not corrected after the fact). */
export function partsNote(key: string, history: LineShape[]): string {
  const used = new Map<string, number>();
  for (const l of history.filter(h => h.key === key).slice(-DELIVERY_RULES.historyLines)) for (const p of l.parts) used.set(p, (used.get(p) ?? 0) + 1);
  const worn = Array.from(used.entries()).filter(([, c]) => c >= 2).map(([p]) => p);
  return worn.length ? `You keep using your ${worn.join(' and your ')}. Use another part of you, the room, or nothing.` : '';
}

/** The speaker's own bold name at the start of a turn (the table already shows who is speaking). */
export function stripSpeaker(text: string): string {
  return (text || '').replace(/^\s*\*\*[^*\n]{1,80}:\*\*\s*/, '').trim();
}

const spokenWords = (s: string) => (s.replace(/\*[^*\n]+\*/g, ' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || []).length;

/** Where the turn proper ends and its extras begin (the sense line, roll and join controls). */
const EXTRAS_RE = /\n?[ \t]*(?:\*?\(You sense:|⟪|\[ROLL:|\[JOIN:)/;

/**
 * Hold a turn to the shape it was asked for. A turn inside the shape, or over by a little, is left
 * alone. One that badly overshoots is cut at the end of a sentence; the first sentence always stays,
 * and the sense line and any roll or join control after the turn are kept as they are.
 */
export function fitToShape(text: string, shape: TurnShape | null | undefined): string {
  if (!shape || !text) return text;
  const at = text.search(EXTRAS_RE);
  const main = at >= 0 ? text.slice(0, at) : text;
  const extras = at >= 0 ? text.slice(at).trim() : '';
  const limit = Math.max(shape.maxWords, 6);
  if (spokenWords(main) <= Math.round(limit * 1.5) + 2) return text;
  const kept: string[] = [];
  let count = 0;
  let full = false;
  for (const piece of main.match(/\*[^*\n]+\*|[^*]+/g) || []) {
    if (full) break;
    if (piece.startsWith('*')) { kept.push(piece); continue; }
    for (const sentence of piece.match(/[^.!?…]+[.!?…]+["”'’)]*\s*|[^.!?…]+$/g) || [piece]) {
      const n = spokenWords(sentence);
      if (count > 0 && count + n > Math.round(limit * 1.15)) { full = true; break; }
      kept.push(sentence);
      count += n;
    }
  }
  let out = kept.join('').replace(/[ \t]+\n/g, '\n').trim();
  if (!out || count === 0) return text;
  // A cut can land inside a quotation: close it.
  if (((out.match(/"/g) || []).length % 2) === 1) out += '"';
  if ((out.match(/“/g) || []).length > (out.match(/”/g) || []).length) out += '”';
  return extras ? `${out}\n${extras}` : out;
}

/** Saved line shapes, read safely (the newest 12). */
export function readShapes(raw: unknown): LineShape[] {
  if (!Array.isArray(raw)) return [];
  const places: BeatPlace[] = ['none', 'before', 'after', 'mid', 'only'];
  const out: LineShape[] = [];
  for (const r of raw.slice(-12)) {
    if (!r || typeof r.key !== 'string' || typeof r.words !== 'number' || !Number.isFinite(r.words)) continue;
    out.push({
      key: r.key.slice(0, 80),
      words: Math.max(0, Math.round(r.words)),
      beat: places.includes(r.beat) ? (r.beat as BeatPlace) : 'none',
      parts: Array.isArray(r.parts) ? r.parts.filter((p: unknown): p is string => typeof p === 'string').slice(0, 8) : [],
    });
  }
  return out;
}

// ── What the NPC is told ──

export interface MoodInput {
  /** The urge meter's level over their own bar (0 = calm, 1 = at the point of speaking, more = past it). */
  urgeRatio: number;
  /** Huddle heat 0 to 5, when in one. */
  heat?: number | null;
  /** Saved attitude toward the rider, -3 to 3. */
  attitude: number;
  style: 'quiet' | 'normal' | 'loud';
  /** Someone of higher rank is within earshot. */
  outranked: boolean;
}

/** Three plain facts about how they are right now: agitation, warmth, composure. */
export function moodFacts(m: MoodInput, riderName: string): string {
  const rider = riderName.trim() || 'the rider';
  const stir = Math.max(m.urgeRatio, (m.heat ?? 0) / 4);
  const agitation = stir >= 1.4 ? 'badly rattled' : stir >= 0.9 ? 'worked up' : stir >= 0.4 ? 'alert, something is on your mind' : 'calm';
  const warmth = m.attitude >= 2 ? `warm toward ${rider}` : m.attitude === 1 ? `well disposed toward ${rider}` : m.attitude === 0 ? `undecided about ${rider}` : m.attitude === -1 ? `cool toward ${rider}` : `hostile toward ${rider}`;
  const hold = (m.style === 'quiet' ? 1 : m.style === 'loud' ? -1 : 0) + (m.outranked ? 1 : 0) - (stir >= 1.4 ? 1 : 0);
  const composure = hold >= 2 ? 'holding everything in' : hold === 1 ? 'keeping yourself in check' : hold === 0 ? 'not hiding much' : 'close to letting it all out';
  return `${agitation}; ${warmth}; ${composure}`;
}

export interface DeliveryInput {
  name: string;
  riderName: string;
  voice: NpcVoice;
  mood: string;
  /** Their own note from their last line, if any. */
  note: MindNote | null;
  /** What the app measured (from samenessNote). */
  sameness: string;
  /** The rider put a direct question to this NPC: they must give words. */
  directQuestion: boolean;
  /** How many words the rider's line had (people mirror those they like). */
  riderWords: number;
  whisper: boolean;
  outranked: boolean;
  /** Knocked out, wounded and so on, in plain words; empty when fine. */
  condition: string;
  /** The last line of a conversation: a parting shot. */
  closing: boolean;
  /** Which scene-changing actions are open to them right now. */
  actions: { leave: boolean; between: boolean; squareUp: boolean; give: boolean; /** Places they may propose going to with the rider; empty or missing = no travel offers. */ travel?: string[] };
  /** An Insight check on this NPC succeeded: add the sense line. */
  insight: boolean;
  /** This turn's shape, chosen by the app (planTurn). Without it the NPC chooses its own length and layout. */
  shape?: TurnShape;
}

/** The instruction block that replaces the fixed two-line rule. */
export function deliveryBlock(d: DeliveryInput): string {
  const rider = d.riderName.trim() || 'the rider';
  const n = d.note;
  const noteLines = n && (n.want || n.unsaid || n.body || n.truth)
    ? [
      'Your own private note from your last line (nobody else knows any of it):',
      n.want ? `- You want: ${n.want}` : '',
      n.unsaid ? `- You held back: ${n.unsaid}` : '',
      n.body ? `- Your body: ${n.body}` : '',
      n.truth ? `- The truth you are keeping: ${n.truth}` : '',
      'Carry on from there: the same want unless it is won, lost or overtaken; the same body unless you move it.',
    ].filter(Boolean)
    : [`You have no private note yet. Decide what you want out of this conversation with ${rider} (something this person would really want), and go after it.`];
  const acts = [
    d.actions.leave ? '⟪ACT leave⟫ you walk out and are gone from the scene' : '',
    d.actions.between ? '⟪ACT between⟫ you step between the people arguing' : '',
    d.actions.squareUp ? `⟪ACT square-up⟫ you offer ${rider} a bout on the mat, here and now` : '',
    d.actions.give ? `⟪ACT give: what it is⟫ you hand ${rider} something` : '',
    d.actions.travel && d.actions.travel.length ? `⟪ACT travel: place name⟫ you want ${rider} to come with you there, now (only one of: ${d.actions.travel.slice(0, 16).join('; ')})` : '',
  ].filter(Boolean);
  return [
    `## HOW ${d.name.toUpperCase()} SPEAKS AND MOVES (this replaces any fixed format or length given elsewhere)`,
    `Voice: ${d.voice.rhythm}; ${d.voice.register}. Feeling shows in ${d.voice.shows}. When hiding something: ${d.voice.tell}.`,
    `Right now you are ${d.mood}.${d.outranked ? ' Someone who outranks you can hear this: it stiffens you.' : ''}${d.condition ? ` You are ${d.condition}: it shows in how you speak and move.` : ''}${d.whisper ? ` This is for ${rider}'s ears only: low, close, brief.` : ''}`,
    ...noteLines,
    '',
    'WRITE YOUR TURN THE WAY THIS PERSON WOULD, RIGHT NOW:',
    `- Begin with **${d.name}:** exactly.`,
    ...(d.shape ? [
      `- ${shapeAsk(d.shape)}`,
      '- When there is a movement: carry on from where your body already is and use what is in the room. Skip stock gestures (crossed arms, a raised eyebrow, a clenched jaw, a smirk, narrowed eyes) unless nothing truer fits.',
      `- Earlier lines in this story may all have one length and one layout. That sameness was a fault of the app, not ${d.name}'s way of speaking: keep the character, never the shape of their past lines.`,
    ] : [
      `- Length is whatever is true to the moment: one word, a look with no words at all, a sentence, or several. Never pad and never trim to a pattern. At most ${DELIVERY_RULES.maxWords} words of speech.${d.riderWords > 0 ? ` ${rider} just used about ${d.riderWords} words; people tend to match those they like and push against those they do not.` : ''}`,
      '- Movement is optional. When there is one, write it in *italics* where it happens (before the words, in the middle of them, or after), carry on from where your body already is, and use what is in the room. Skip stock gestures (crossed arms, a raised eyebrow, a clenched jaw, a smirk, narrowed eyes) unless nothing truer fits.',
    ]),
    '- You do not have to answer what was asked. You can answer with a question, deflect, change the subject, cut in, trail off, or say less than you know. When what you say and what you feel are not the same, let the body give it away.',
    '- You may lie or shade the truth if this person would. If you do, the truth goes in your note.',
    d.directQuestion ? `- ${rider} put a direct question to you: give them words (they need not be the whole truth), not only a look.` : '',
    d.closing ? '- This is your last line of this conversation: make it a parting shot, a shrug or an exit, and keep it short.' : '',
    d.sameness ? `- ${d.sameness}` : '',
    `- Only ${d.name} speaks or acts. No narration of anyone else, no scene description, no game terms.`,
    d.insight ? `- After your turn, on its own line, add: *(You sense: one short phrase of what ${d.name} truly feels or is hiding)* drawn from your private note.` : '',
    '',
    'THEN, on a final line of its own, write your new private note in exactly this form (it is hidden from everyone):',
    '⟪MIND want: … | unsaid: … | body: … | truth: … ⟫',
    'want = what you want out of this conversation now. unsaid = what you felt or thought and kept back. body = where you are and what you are doing or holding. truth = what you are hiding or lied about, or "nothing". Up to 15 words each.',
    acts.length ? `ACTIONS (rare: only when this person truly would, and never to dodge a direct question). To do one, add its marker on a line before the note: ${acts.join('; ')}. Write the moment itself in your turn.` : '',
  ].filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== '')).join('\n');
}

/** A line that matters gets the story's own model; small talk stays on the cheap one. */
export function isKeyLine(input: { reasons: string[]; heat?: number | null; beat?: string | null; memory?: boolean }): boolean {
  if (input.memory) return true;
  if ((input.heat ?? 0) >= 4) return true;
  if (input.beat === 'turn-to-rider' || input.beat === 'break') return true;
  return input.reasons.some(r => /remember|keep to yourself|probing|left you with something to say|threat/i.test(r));
}
