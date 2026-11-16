// Solo Empyrean Live NPCs (D-38): the built-in canon cast and the helpers that use it.
// The cast is the lore Bible's Canon Cast guide turned into characters. What an NPC knows and
// shows depends on the campaign's era, so nobody reveals what happens in a later book (INV-N1).
import { CAST_A } from './castA';
import { CAST_B } from './castB';
import { eraReached, type CanonEra, type CanonNpc } from './types';

export * from './types';

export const CANON_CAST: CanonNpc[] = [...CAST_A, ...CAST_B];
const BY_KEY = new Map(CANON_CAST.map(n => [n.key, n]));

export function canonNpc(key: string): CanonNpc | undefined {
  return BY_KEY.get(key);
}

/** Present in this era (alive and there), whether openly or in secret. */
export function presentIn(npc: CanonNpc, era: CanonEra): boolean {
  return !!npc.roles[era];
}

/** Shown in the roster's Known list: present and not hidden in this era. */
export function listedIn(npc: CanonNpc, era: CanonEra): boolean {
  return presentIn(npc, era) && !(npc.hiddenIn ?? []).includes(era);
}

/** What is true of this NPC by this era: their role, open facts and secrets. */
export function npcAtEra(npc: CanonNpc, era: CanonEra): { role: string; facts: string[]; secrets: string[] } {
  return {
    role: npc.roles[era] ?? '',
    facts: npc.facts.filter(x => eraReached(x.era, era)).map(x => x.text),
    secrets: npc.secrets.filter(x => eraReached(x.era, era)).map(x => x.text),
  };
}

/** A roster NPC as the phone keeps it: a canon character, or one the player built. */
export interface RosterMind {
  name: string;
  role: string;
  look: string;
  personality: string;
  voice: string;
  wants: string;
  facts: string[];
  secrets: string[];
}

export function canonMind(npc: CanonNpc, era: CanonEra): RosterMind {
  const at = npcAtEra(npc, era);
  return { name: npc.name, role: at.role, look: npc.look, personality: npc.personality, voice: npc.voice, wants: npc.wants, facts: at.facts, secrets: at.secrets };
}

export const ATTITUDE_WORDS: Record<number, string> = {
  [-3]: 'hostile', [-2]: 'cold', [-1]: 'wary', 0: 'neutral', 1: 'friendly', 2: 'warm', 3: 'devoted',
};

export function clampAttitude(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(-3, Math.min(3, v)) : 0;
}

/**
 * The block added to the DM's NPC voicing instructions when the player talks to a roster NPC.
 * Secrets are given to the model to shape the answer, never to be said outright.
 */
export function npcVoiceContext(mind: RosterMind, riderName: string, attitude: number, memories: string[], eraLabel: string): string {
  const lines = [
    `## LIVE NPC: ${mind.name}`,
    `Setting: ${eraLabel}. ${mind.name} knows only what is true by then; never mention later events.`,
    mind.role ? `Role: ${mind.role}.` : '',
    `Look: ${mind.look}`,
    `Personality: ${mind.personality}`,
    `Voice: ${mind.voice}`,
    `Wants: ${mind.wants}`,
    mind.facts.length ? `Known about them:\n- ${mind.facts.join('\n- ')}` : '',
    mind.secrets.length ? `Secrets (they never state these outright; let them shape tone, evasions and choices):\n- ${mind.secrets.join('\n- ')}` : '',
    `Attitude toward ${riderName}: ${ATTITUDE_WORDS[clampAttitude(attitude)]} (${clampAttitude(attitude)} on a scale from -3 to +3). Let it color warmth, trust and patience.`,
    memories.length ? `What ${mind.name} remembers about ${riderName}:\n- ${memories.slice(-12).join('\n- ')}` : `${mind.name} has no memories of ${riderName} yet.`,
  ];
  return lines.filter(Boolean).join('\n');
}

export interface NameEntry { key: string; names: string[] }

/** Canon names for this era, for matching story text and @mentions. */
export function canonNameEntries(era: CanonEra): NameEntry[] {
  return CANON_CAST.filter(n => presentIn(n, era)).map(n => ({ key: n.key, names: [n.name, ...n.aliases] }));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which NPCs a piece of story names. Whole words, case-sensitive (names are capitalized), and a
 * longer name wins over a shorter one inside it ("Colonel Aetos" is not Dain Aetos).
 */
export function matchNames(text: string, entries: NameEntry[]): string[] {
  const hits: Array<{ start: number; end: number; key: string }> = [];
  for (const e of entries) {
    for (const name of e.names) {
      if (!name || name.length < 3) continue;
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'gu');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) hits.push({ start: m.index, end: m.index + name.length, key: e.key });
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken: Array<[number, number]> = [];
  const found: string[] = [];
  for (const h of hits) {
    if (taken.some(([s, e]) => h.start < e && s < h.end)) continue;
    taken.push([h.start, h.end]);
    if (!found.includes(h.key)) found.push(h.key);
  }
  return found;
}

/**
 * "@Dain Aetos, report." → the NPC and the line. Case-insensitive, longest name first, so full
 * names with spaces work. Null when the text after @ names nobody on the roster.
 */
export function parseMention(text: string, entries: NameEntry[]): { key: string; line: string } | null {
  const m = /^\s*@(.+)$/s.exec(text);
  if (!m) return null;
  const rest = m[1];
  let best: { key: string; len: number } | null = null;
  for (const e of entries) {
    for (const name of e.names) {
      if (!name) continue;
      const head = rest.slice(0, name.length);
      const after = rest.charAt(name.length);
      if (head.toLowerCase() === name.toLowerCase() && !/[\p{L}\p{N}]/u.test(after) && (!best || name.length > best.len)) {
        best = { key: e.key, len: name.length };
      }
    }
  }
  if (!best) return null;
  const line = rest.slice(best.len).replace(/^[\s,:;.!-]+/, '').trim();
  return line ? { key: best.key, line } : null;
}
