// Solo Empyrean urge meter (D-40): the app decides WHEN an on-stage NPC speaks unprompted;
// the AI only writes the words. Pure logic, no React — the solo Live Table hook drives it.
//
// How it works: every line at the table (and silence) adds points to each on-stage NPC's urge,
// weighted by their temperament (temperament.ts). Urge fades 20% a minute. Near the line a "…"
// tell shows; crossing it makes the NPC speak, with the reason handed to the AI. Speaking resets
// the urge and starts a cooldown. The hook enforces the caps (2 wakes per rider line, 1 reaction
// to an unprompted line, never a chain) and the brakes (DM writing, scene, fight, table closed).
import { eraReached, type CanonEra } from '@/lib/empyreanCanon/castNpcs/types';
import { NEUTRAL_TEMPERAMENT, type Temperament, type UrgeIntent } from '@/lib/empyreanCanon/castNpcs/temperament';

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

// Whole-word trigger lists (case-insensitive). Short and tunable on purpose.
const INSULT = ['coward', 'idiot', 'fool', 'useless', 'weak', 'weakling', 'pathetic', 'liar', 'traitor', 'worthless', 'stupid', 'moron', 'scum', 'bastard'];
const PRAISE = ['brave', 'bravest', 'brilliant', 'amazing', 'impressive', 'incredible', 'hero', 'proud', 'thank'];
const DANGER = ['blade', 'blades', 'dagger', 'daggers', 'knife', 'sword', 'swords', 'blood', 'bleeding', 'wounded', 'hurt', 'dying', 'kill', 'killed', 'attack', 'attacked', 'threat', 'ambush', 'poison', 'poisoned', 'venin', 'wyvern', 'weapon', 'weapons'];
const AUTHORITY = ['order', 'orders', 'ordered', 'command', 'commands', 'rank', 'codex', 'rule', 'rules', 'regulation', 'curfew', 'report', 'discipline', 'permission', 'forbidden'];

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
export function effectiveThreshold(t: Temperament | undefined, talk: Talkativeness): number | null {
  if (talk === 'spoken-to') return null;
  const style = (t ?? NEUTRAL_TEMPERAMENT).style;
  return URGE_RULES.threshold * STYLE_FACTOR[style] * TALK_FACTOR[talk];
}

/** Where this NPC stands right now: ready to speak, showing a tell, or quiet. */
export function urgeStanding(s: NpcUrgeState, t: Temperament | undefined, talk: Talkativeness, now: number): 'speak' | 'tell' | null {
  const limit = effectiveThreshold(t, talk);
  if (limit === null) return null;
  const settled = settleUrge(s, now);
  if (settled.urge >= limit) {
    return now - s.lastSpokeAt < URGE_RULES.cooldownMs ? 'tell' : 'speak';
  }
  return settled.urge >= limit * URGE_RULES.tellRatio ? 'tell' : null;
}

export interface WakeCandidate { key: string; state: NpcUrgeState; temperament?: Temperament; talk: Talkativeness }

/** Who actually speaks: everyone ready, most-over-threshold first, capped. */
export function pickWakes(candidates: WakeCandidate[], now: number, max: number): string[] {
  return candidates
    .map(c => {
      const limit = effectiveThreshold(c.temperament, c.talk);
      if (limit === null || urgeStanding(c.state, c.temperament, c.talk, now) !== 'speak') return null;
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
