// npc-memory: turns a scene that was handed to the DM into lasting NPC memory and
// attitude changes. Pure helpers: no network, no database, so they can be unit tested.

/** At most this many new notes per NPC per hand-off. */
export const MAX_NEW_NOTES = 3;
/** AI notes kept per NPC; older AI notes drop off. Notes the host wrote are never dropped. */
export const MAX_AI_NOTES = 40;
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
}

export interface MemoryUpdate {
  notes: string[];
  changes: Array<{ name: string; change: -1 | 1; reason: string }>;
}

const WORDS: Record<number, string> = { [-2]: 'Hostile', [-1]: 'Wary', 0: 'Neutral', 1: 'Friendly', 2: 'Loyal' };

export function buildMemoryPrompt(input: MemoryInput): { system: string; user: string } {
  const name = input.npcName.trim();
  const system = [
    `You keep the memory of ${name}, a non-player character in a tabletop fantasy roleplaying campaign.`,
    `Read the scene and write down what ${name} should remember next time, and whether ${name}'s attitude toward any player character changed.`,
    'Answer with ONLY a JSON object, no other text:',
    '{"notes": ["…"], "attitudes": [{"character": "Name", "change": 1, "reason": "…"}]}',
    'RULES',
    `- notes: 0 to ${MAX_NEW_NOTES} short facts in the third person, each under 200 characters, about what happened or was said that ${name} would remember: promises, debts, threats, lies caught, secrets ${name} revealed, favors, names learned, how someone treated ${name}. Name the characters involved. Skip small talk and anything already in WHAT ${name.toUpperCase()} ALREADY REMEMBERS.`,
    `- attitudes: only characters whose standing with ${name} clearly changed in THIS scene. change is 1 (warmer) or -1 (colder), never more. Leave the list empty if nothing changed. Use the character names exactly as listed.`,
    `- Only what actually happened in the scene. Never invent events. Roll results that say "failure" mean the attempt did not work.`,
  ].join('\n');

  const parts: string[] = [];
  if (input.guide.trim()) parts.push(`WHO ${name.toUpperCase()} IS\n${input.guide.trim().slice(0, 1500)}`);
  parts.push(input.memory.length
    ? `WHAT ${name.toUpperCase()} ALREADY REMEMBERS\n${input.memory.map(m => `- ${m}`).join('\n')}`
    : `WHAT ${name.toUpperCase()} ALREADY REMEMBERS\n(nothing yet)`);
  parts.push(`THE PARTY AND HOW ${name.toUpperCase()} FEELS ABOUT THEM NOW\n${input.attitudes.map(a => `- ${a.name}: ${WORDS[a.score] || 'Neutral'}`).join('\n') || '(no one seated)'}`);
  parts.push(`THE SCENE (oldest first)\n${input.transcript.join('\n') || '(empty)'}`);
  return { system, user: parts.join('\n\n') };
}

/** Read the model's JSON, keeping only what the rules allow. */
export function parseMemoryUpdate(raw: string, characterNames: string[], existing: string[]): MemoryUpdate {
  const empty: MemoryUpdate = { notes: [], changes: [] };
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
  const seen = new Set(existing.map(n => n.trim().toLowerCase()));
  const notes: string[] = [];
  for (const n of Array.isArray(data?.notes) ? data.notes : []) {
    if (typeof n !== 'string') continue;
    const note = n.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_CHARS);
    if (!note || seen.has(note.toLowerCase())) continue;
    seen.add(note.toLowerCase());
    notes.push(note);
    if (notes.length >= MAX_NEW_NOTES) break;
  }

  const byName = new Map(characterNames.map(n => [n.trim().toLowerCase(), n.trim()]));
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
  return { notes, changes };
}

/** A new attitude score: one step at most, always between -2 and 2. */
export function shiftAttitude(score: number, change: number): number {
  const step = change > 0 ? 1 : change < 0 ? -1 : 0;
  return Math.max(-2, Math.min(2, Math.round(score || 0) + step));
}
