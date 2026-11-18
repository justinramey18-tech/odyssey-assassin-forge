// Solo Empyrean: how the AI DM and the live NPC system work together. Pure, for tests.
//
// - DM → table: the DM ends each post with hidden LIVE directions (who is on stage, the mood of
//   the room, a cue for an NPC to speak, two NPCs about to have it out). The Live Table reads them.
// - Table → DM: a hand-off carries a short LIVE TABLE STATE note (who is there, whispers, unfinished
//   arguments, whose side the rider took, questions passed by) and asks for a full-length scene.
// - The story feed: a hand-off is drawn as the table's own lines, in order, with portraits.
// Nothing here is saved to the database; the rider never sees the directions or the note.

/** Every hidden direction the DM can write. */
const LIVE_TAG_RE = /<!--LIVE:[^>]*?-->/g;

/** The story with the DM's hidden directions taken out. */
export function stripLiveTags(text: string): string {
  return (text || '').replace(LIVE_TAG_RE, '');
}

export type RoomMood = 'tense' | 'calm' | 'normal';
export interface DmCue { name: string; reason: string }
export interface DmHuddle { a: string; b: string; about: string }
export interface DmDirections {
  /** Names the DM listed as present; null when the post has no STAGE direction (fall back to names in the story). */
  stage: string[] | null;
  room: RoomMood | null;
  cues: DmCue[];
  huddle: DmHuddle | null;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** Read the hidden directions out of a DM post. Malformed ones are ignored. */
export function parseDirections(text: string): DmDirections {
  const out: DmDirections = { stage: null, room: null, cues: [], huddle: null };
  for (const m of (text || '').matchAll(/<!--LIVE:([A-Z]+)\s*([^>]*?)-->/g)) {
    const kind = m[1];
    const body = clean(m[2] || '', 400);
    if (kind === 'STAGE') {
      out.stage = /^(none|nobody|no one|empty)?$/i.test(body) ? [] : body.split(/[;,]/).map(n => clean(n, 80)).filter(Boolean).slice(0, 8);
    } else if (kind === 'ROOM') {
      const mood = body.toLowerCase();
      if (mood === 'tense' || mood === 'calm' || mood === 'normal') out.room = mood;
    } else if (kind === 'CUE' && out.cues.length < 2) {
      const [name, ...rest] = body.split('|');
      const reason = clean(rest.join('|'), 200);
      if (clean(name || '', 80) && reason) out.cues.push({ name: clean(name, 80), reason });
    } else if (kind === 'HUDDLE' && !out.huddle) {
      const [pair, ...rest] = body.split('|');
      const [a, b] = (pair || '').split('+').map(n => clean(n, 80));
      if (a && b && a.toLowerCase() !== b.toLowerCase()) out.huddle = { a, b, about: clean(rest.join('|'), 160) || 'what just happened' };
    }
  }
  return out;
}

/** Enough of a post to tell it from the next one (so its directions run once). */
export function directionsSig(text: string): string {
  const t = text || '';
  return `${t.length}:${t.slice(0, 40)}:${t.slice(-40)}`;
}

/** The standing guide, added to the solo DM's instructions on every post. */
export function liveNpcDmGuide(riderName: string): string {
  const rider = riderName.trim() || 'the rider';
  return [
    '## LIVE NPCS (HOW YOU AND THE LIVE TABLE WORK TOGETHER)',
    `${rider} talks with the people in the scene at a Live Table. The NPCs who are present speak there in their own voices, one line at a time, voiced by the app: they can speak up without being asked, whisper to ${rider}, and argue among themselves. You are the director and the world; they are the actors. Work with them:`,
    '- SET THE SCENE AND LEAVE ROOM. Narrate what the NPCs do, how they look, and what happens in the world around them. Give an NPC who is present at most one short spoken line in a post, and none when a look or a gesture does the work. Never play out a whole conversation with NPCs who are present: that happens at the table.',
    '- END ON AN OPENING. Close each post on a moment that invites a reply at the table: someone waiting for an answer, a look that needs explaining, two people about to clash. Do not end on a list of options.',
    `- WHAT WAS SAID AT THE TABLE WAS SAID. Lines handed to you from the table already happened, word for word. Never repeat, rewrite or contradict them; carry on from the last one. A line marked 🤫 was whispered to ${rider} alone: nobody else heard it, and nobody else may act as if they did.`,
    '- CONSEQUENCES. When a hand-off comes with a LIVE TABLE STATE note, use it: an unfinished argument festers, a side taken is remembered, a question that was passed by comes back. Never quote or mention the note.',
    '',
    `DIRECTIONS (hidden from ${rider}). Put them on their own lines at the very END of every post, after the story:`,
    `<!--LIVE:STAGE Full Name; Full Name--> REQUIRED on every post. Exactly the named NPCs who are physically present and able to speak with ${rider} right now. People who are only mentioned, remembered, far away, asleep or dead are NOT listed. Write <!--LIVE:STAGE none--> when ${rider} is alone.`,
    '<!--LIVE:ROOM tense--> or <!--LIVE:ROOM calm-->. Optional. tense when danger, a threat or a shock hangs in the air; calm for quiet, safe moments.',
    '<!--LIVE:CUE Full Name | what they want to say or do--> Optional, at most two. Use it when your post leaves a present NPC with something they would plainly say next: they will say it at the table themselves, so do not write the line for them.',
    `<!--LIVE:HUDDLE Full Name + Full Name | what it is about--> Optional, at most one, and only when two NPCs on stage are plainly about to have it out with each other. They will, at the table, and ${rider} can join in.`,
    'Use CUE and HUDDLE sparingly: most posts need only STAGE. Never mention these directions in the story.',
  ].join('\n');
}

export interface TableStateInput {
  riderName: string;
  /** NPCs on stage, with what is on their mind when the urge meter knows, and (from their private note) what they are after and hiding. */
  onStage: Array<{ name: string; wants?: string | null; aim?: string | null; hiding?: string | null }>;
  /** Things NPCs did at the table that change the scene (walked out, squared up, handed something over). */
  actions?: string[];
  /** NPCs who set out with the rider and are travelling with them. */
  companions?: string[];
  /** A sealed line in this hand-off was a whisper. */
  whispered: boolean;
  /** Pairs on stage with unfinished business. */
  pairs: Array<{ a: string; b: string; tension: number; lastAbout?: string | null }>;
  /** The conversation among NPCs that just happened at the table, if any. */
  lastHuddle?: { names: string[]; about: string; heat: number; end: 'dropped' | 'broke' | 'enough' | 'interrupted'; ally?: string | null; riderSpoke: boolean } | null;
  /** NPCs whose question the rider passed by. */
  ignored: string[];
}

const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(''));

/** The note the DM gets with a hand-off: what the table knows that the sealed lines do not say. Empty when there is nothing to tell. */
export function tableStateForDm(input: TableStateInput): string {
  const rider = input.riderName.trim() || 'the rider';
  const lines: string[] = [];
  if (input.onStage.length) {
    lines.push(`At the table: ${input.onStage.map(n => {
      const bits = [
        n.wants ? `holding something back: ${clean(n.wants, 120)}` : '',
        n.aim ? `is after: ${clean(n.aim, 120)}` : '',
        n.hiding ? `is hiding from ${rider}: ${clean(n.hiding, 120)}` : '',
      ].filter(Boolean);
      return bits.length ? `${n.name} (${bits.join('; ')})` : n.name;
    }).join('; ')}.`);
  }
  for (const act of (input.actions ?? []).slice(0, 4)) lines.push(clean(act, 160));
  if (input.companions && input.companions.length) lines.push(`${listNames(input.companions)} set out with ${rider} and ${input.companions.length > 1 ? 'are' : 'is'} travelling with them: present wherever ${rider} is, until the story parts them.`);
  if (input.whispered) lines.push(`A line marked 🤫 was whispered to ${rider} alone. The others did not hear it.`);
  const h = input.lastHuddle;
  if (h && h.names.length >= 2) {
    const how = h.end === 'broke' ? 'It broke off at its hottest.'
      : h.end === 'enough' ? `${rider} cut it short.`
        : h.heat >= 3 ? 'It ended heated and unfinished.'
          : h.heat <= 1 ? 'It cooled down by the end.' : 'It was left where it stood.';
    lines.push(`${listNames(h.names)} just had it out about ${clean(h.about, 120)}. ${how}${h.ally ? ` ${rider} took ${h.ally}'s side.` : h.riderSpoke ? '' : ` ${rider} stayed out of it.`}`);
  }
  for (const p of input.pairs.slice(0, 3)) {
    if (p.tension < 1) continue;
    lines.push(`Between ${p.a} and ${p.b}: ${p.tension >= 3 ? 'close to breaking' : p.tension === 2 ? 'bad and getting worse' : 'unfinished business'}${p.lastAbout ? ` (last over ${clean(p.lastAbout, 80)})` : ''}.`);
  }
  if (input.ignored.length) lines.push(`${listNames(input.ignored)} asked ${rider} a question and got no answer.`);
  if (!lines.length) return '';
  return ['## LIVE TABLE STATE (from the app; never quote or mention this note)', ...lines.map(l => `- ${l}`), 'Let this shape what happens next where it fits. Do not force all of it into one post.'].join('\n');
}

/** How long a reply to a Live Table hand-off should be. */
export const HANDOFF_WORDS = { min: 600, max: 900 } as const;

/** The format rule for a solo Live Table hand-off: a full scene, plus the table's note. Replaces the length preset for that one reply. */
export function soloHandoffFormat(riderName: string, tableState: string): string {
  const rider = riderName.trim() || 'The rider';
  return [
    '\n\n## RESPONSE FORMAT (LIVE TABLE HAND-OFF)',
    `${rider} has just handed you what was said and done at the Live Table. Answer with a full scene: ${HANDOFF_WORDS.min} to ${HANDOFF_WORDS.max} words, in several paragraphs. Do not rush. Let what was said land, show what it changes, move the world and the people in it, then close on an opening. This length outranks any shorter length setting and any instruction to be fast or brief. An out-of-character instruction from the player about length still wins.`,
    tableState ? `\n${tableState}` : '',
  ].filter(Boolean).join('\n');
}

// ── The story feed: a hand-off drawn as the table's own lines ──

export interface SceneLine { name: string; npc: boolean; whisper: boolean; text: string }
export interface HandoffScene { lines: SceneLine[]; tableTalk: string[]; notes: string[] }

const ENTRY_RE = /^\[([^\]\n]{1,80})\]: ?(.*)$/;
const TABLE_TALK_HEADING = 'TABLE TALK (out of character)';

/**
 * Read a sent hand-off back into its lines, in order: "[Name]: words" and "[Name (NPC)]: words".
 * Null when the text is not a hand-off (an older typed prompt, say), so the caller shows it as before.
 */
export function parseHandoffScene(content: string): HandoffScene | null {
  const rows = (content || '').replace(/\r/g, '').split('\n');
  const lines: SceneLine[] = [];
  const tableTalk: string[] = [];
  const notes: string[] = [];
  let inTalk = false;
  let started = false;
  for (const raw of rows) {
    const row = raw.trimEnd();
    if (!row.trim()) continue;
    if (row.trim() === TABLE_TALK_HEADING) { inTalk = true; started = true; continue; }
    // App notes the DM gets with the lines (a channelled signet, say) are not dialogue.
    if (/^\[[A-Z][A-Z ]{3,}\b[^\]]*\]$/.test(row.trim())) { notes.push(row.trim().slice(1, -1)); continue; }
    if (inTalk) { tableTalk.push(row.trim()); continue; }
    const m = ENTRY_RE.exec(row);
    if (m) {
      started = true;
      const npc = / \(NPC\)$/.test(m[1]);
      const name = m[1].replace(/ \(NPC\)$/, '').trim();
      let text = m[2].trim();
      const whisper = text.startsWith('🤫');
      if (whisper) text = text.replace(/^🤫\s*/, '');
      // An NPC's line carries its own "**Name:**" label; the card shows the name once.
      if (npc) text = text.replace(/^\*\*[^*\n]{1,80}:\*\*\s*/, '');
      lines.push({ name, npc, whisper, text });
    } else if (started && lines.length) {
      lines[lines.length - 1].text += `\n${row}`;
    } else {
      return null;
    }
  }
  return lines.length || tableTalk.length ? { lines, tableTalk, notes } : null;
}
