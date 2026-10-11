// npc-memory: turns a scene that was handed to the DM into lasting NPC memory and
// attitude changes. Pure helpers: no network, no database, so they can be unit tested.
// v3 adds: unfinished business (threads), facts the NPC said about itself, names it
// learned, and feelings that fade without contact.

/** At most this many new notes per NPC per hand-off. */
export const MAX_NEW_NOTES = 3;
/** AI event notes kept per NPC; older AI notes drop off. Notes the host wrote are never dropped. */
export const MAX_AI_NOTES = 40;
/** Open threads and self facts kept per NPC (AI-written; the host's own are never dropped). */
export const MAX_THREADS = 15;
export const MAX_SELF_FACTS = 20;
export const NOTE_MAX_CHARS = 300;

export interface MemoryInput {
  npcName: string;
  /** The start of the host's guide, so the summary stays in character. */
  guide: string;
  /** The scene, oldest first: "Kaelen: …", "Grukk (you): …". */
  transcript: string[];
  /** What the NPC already remembers, oldest first. */
  memory: string[];
  /** Seated characters and how the NPC feels about each (-2 … 2). */
  attitudes: Array<{ name: string; score: number }>;
  /** v3: open questions and promises, oldest first (numbered in the prompt). */
  threads?: string[];
  /** v3: what the NPC has already said about itself. */
  selfFacts?: string[];
  /** v3: characters whose names the NPC already knows. */
  knownNames?: string[];
}

export interface MemoryUpdate {
  notes: string[];
  changes: Array<{ name: string; change: -1 | 1; reason: string }>;
  /** v3 */
  threadsOpened: string[];
  /** v3: 0-based positions in MemoryInput.threads that were settled. */
  threadsClosed: number[];
  selfFacts: string[];
  namesLearned: string[];
}

const WORDS: Record<number, string> = { [-2]: 'Hostile', [-1]: 'Wary', 0: 'Neutral', 1: 'Friendly', 2: 'Loyal' };

export function buildMemoryPrompt(input: MemoryInput): { system: string; user: string } {
  const name = input.npcName.trim();
  const system = [
    `You keep the memory of ${name}, a non-player character in a tabletop fantasy roleplaying campaign.`,
    `Read the scene and write down what ${name} should remember next time, and whether ${name}'s attitude toward any player character changed.`,
    'Answer with ONLY a JSON object, no other text:',
    '{"notes": ["…"], "threads_opened": ["…"], "threads_closed": [1], "self_facts": ["…"], "names_learned": ["Name"], "attitudes": [{"character": "Name", "change": 1, "reason": "…"}]}',
    'RULES',
    `- notes: 0 to ${MAX_NEW_NOTES} short facts in the third person, each under 200 characters, about what happened or was said that ${name} would remember: promises, debts, threats, lies caught, secrets ${name} revealed, favors, how someone treated ${name}. Name the characters involved. Skip small talk and anything already in WHAT ${name.toUpperCase()} ALREADY REMEMBERS.`,
    `- threads_opened: 0 to 2 pieces of unfinished business from this scene: a question ${name} asked that nobody answered, or a promise made to or by ${name} that is not kept yet. Short, third person. Skip any already in UNFINISHED BUSINESS.`,
    `- threads_closed: the numbers of UNFINISHED BUSINESS items that were answered, kept or settled in this scene. Empty if none.`,
    `- self_facts: 0 to 2 things ${name} said about ${name}'s own life in this scene (pay, family, past, tastes, fears) that ${name} must stay consistent with later. Skip any already in WHAT ${name.toUpperCase()} HAS SAID ABOUT ITSELF.`,
    `- names_learned: player characters who told ${name} their name, or were clearly called by name in front of ${name}, in this scene. Use the names exactly as listed in THE PARTY. Skip names ${name} already knows.`,
    `- attitudes: only characters whose standing with ${name} clearly changed in THIS scene. change is 1 (warmer) or -1 (colder), never more. Leave the list empty if nothing changed. Use the character names exactly as listed.`,
    `- Only what actually happened in the scene. Never invent events. Roll results that say "failure" mean the attempt did not work.`,
  ].join('\n');

  const known = new Set((input.knownNames || []).map(n => n.trim().toLowerCase()));
  const parts: string[] = [];
  if (input.guide.trim()) parts.push(`WHO ${name.toUpperCase()} IS\n${input.guide.trim().slice(0, 1500)}`);
  parts.push(input.memory.length
    ? `WHAT ${name.toUpperCase()} ALREADY REMEMBERS\n${input.memory.map(m => `- ${m}`).join('\n')}`
    : `WHAT ${name.toUpperCase()} ALREADY REMEMBERS\n(nothing yet)`);
  const threads = input.threads || [];
  parts.push(threads.length
    ? `UNFINISHED BUSINESS\n${threads.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : 'UNFINISHED BUSINESS\n(none)');
  const self = input.selfFacts || [];
  if (self.length) parts.push(`WHAT ${name.toUpperCase()} HAS SAID ABOUT ITSELF\n${self.map(t => `- ${t}`).join('\n')}`);
  parts.push(`THE PARTY AND HOW ${name.toUpperCase()} FEELS ABOUT THEM NOW\n${input.attitudes.map(a => `- ${a.name}: ${WORDS[a.score] || 'Neutral'}${known.has(a.name.trim().toLowerCase()) ? ' (knows this name)' : ''}`).join('\n') || '(no one seated)'}`);
  parts.push(`THE SCENE (oldest first)\n${input.transcript.join('\n') || '(empty)'}`);
  return { system, user: parts.join('\n\n') };
}

/** Short, trimmed, de-duplicated strings from a JSON list. */
function cleanList(raw: unknown, max: number, seen: Set<string>): string[] {
  const out: string[] = [];
  for (const n of Array.isArray(raw) ? raw : []) {
    if (typeof n !== 'string') continue;
    const note = n.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_CHARS);
    if (!note || seen.has(note.toLowerCase())) continue;
    seen.add(note.toLowerCase());
    out.push(note);
    if (out.length >= max) break;
  }
  return out;
}

/** Read the model's JSON, keeping only what the rules allow. */
export function parseMemoryUpdate(
  raw: string,
  characterNames: string[],
  existing: string[],
  opts: { threads?: string[]; selfFacts?: string[]; knownNames?: string[] } = {},
): MemoryUpdate {
  const empty: MemoryUpdate = { notes: [], changes: [], threadsOpened: [], threadsClosed: [], selfFacts: [], namesLearned: [] };
  const text = (raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return empty;
  let data: any;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return empty;
  }
  const notes = cleanList(data?.notes, MAX_NEW_NOTES, new Set(existing.map(n => n.trim().toLowerCase())));
  const threads = opts.threads || [];
  const threadsOpened = cleanList(data?.threads_opened, 2, new Set(threads.map(n => n.trim().toLowerCase())));
  const selfFacts = cleanList(data?.self_facts, 2, new Set((opts.selfFacts || []).map(n => n.trim().toLowerCase())));

  const threadsClosed: number[] = [];
  for (const v of Array.isArray(data?.threads_closed) ? data.threads_closed : []) {
    const i = Math.round(Number(v)) - 1;
    if (Number.isFinite(i) && i >= 0 && i < threads.length && !threadsClosed.includes(i)) threadsClosed.push(i);
  }

  const byName = new Map(characterNames.map(n => [n.trim().toLowerCase(), n.trim()]));
  const known = new Set((opts.knownNames || []).map(n => n.trim().toLowerCase()));
  const namesLearned: string[] = [];
  for (const v of Array.isArray(data?.names_learned) ? data.names_learned : []) {
    const name = byName.get(String(v || '').trim().toLowerCase());
    if (name && !known.has(name.toLowerCase()) && !namesLearned.includes(name)) namesLearned.push(name);
  }

  const changes: MemoryUpdate['changes'] = [];
  const done = new Set<string>();
  for (const a of Array.isArray(data?.attitudes) ? data.attitudes : []) {
    const name = byName.get(String(a?.character || '').trim().toLowerCase());
    const change = Number(a?.change);
    if (!name || done.has(name) || !Number.isFinite(change) || change === 0) continue;
    done.add(name);
    changes.push({
      name,
      change: change > 0 ? 1 : -1,
      reason: typeof a?.reason === 'string' ? a.reason.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_CHARS) : '',
    });
  }
  return { notes, changes, threadsOpened, threadsClosed, selfFacts, namesLearned };
}

/** A new attitude score: one step at most, always between -2 and 2. */
export function shiftAttitude(score: number, change: number): number {
  const step = change > 0 ? 1 : change < 0 ? -1 : 0;
  return Math.max(-2, Math.min(2, Math.round(score || 0) + step));
}

/**
 * Feelings fade toward Neutral without contact: one step a week ("normal"), one step every
 * 3 days ("forgiving"), and for "grudge" anger never fades (warmth still does).
 * The same rule lives in npc-reply/prompt.ts; keep them in step.
 */
export function fadeAttitude(score: number, lastSeenIso: string | null | undefined, style: string | null | undefined, now: number): number {
  const s = Math.max(-2, Math.min(2, Math.round(score || 0)));
  const t = lastSeenIso ? Date.parse(lastSeenIso) : NaN;
  if (s === 0 || !Number.isFinite(t)) return s;
  const days = Math.max(0, Math.floor((now - t) / 86_400_000));
  const every = style === 'forgiving' ? 3 : 7;
  if (style === 'grudge' && s < 0) return s;
  const steps = Math.floor(days / every);
  if (steps <= 0) return s;
  return s > 0 ? Math.max(0, s - steps) : Math.min(0, s + steps);
}
