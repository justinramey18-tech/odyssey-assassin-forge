// Solo Empyrean: how a live NPC's line is delivered. Pure rules, no React, no network.
//
// The old rule forced every line into the same two-line shape. Here the NPC is given facts
// about themselves and the moment (voice, mood, audience, their own private note from last
// time) and writes the turn the way that person would. The app does not pick the shape; it
// MEASURES what came out and, when the table is getting samey, says so on the next request.
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
    `- Length is whatever is true to the moment: one word, a look with no words at all, a sentence, or several. Never pad and never trim to a pattern. At most ${DELIVERY_RULES.maxWords} words of speech.${d.riderWords > 0 ? ` ${rider} just used about ${d.riderWords} words; people tend to match those they like and push against those they do not.` : ''}`,
    '- Movement is optional. When there is one, write it in *italics* where it happens (before the words, in the middle of them, or after), carry on from where your body already is, and use what is in the room. Skip stock gestures (crossed arms, a raised eyebrow, a clenched jaw, a smirk, narrowed eyes) unless nothing truer fits.',
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
