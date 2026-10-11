// Story scenes (DECISIONS D-22, 2026-10-11). On Send to DM, and on the Human DM
// Assistant's Apply, the table's sealed in-character lines are retold as one short,
// readable scene. It is written FIRST and saved to the story at once, so the table reads
// it while the DM writes; then the DM gets the scene as its input and carries on from
// its last line. The scene is the story's record of the round: the raw player and NPC
// lines are not saved to the story (they stay in the Live Table). Older rounds, where
// the raw rows were saved before the scene, still hide those rows in the feed.
// The AI writes the scene. The app checks that every spoken line made it in word for
// word, and falls back to a plain script (no AI) when any line is missing.
// Pure functions only (no network, no React) so they can be unit tested.

/** sender_name of a scene row in party_dm_messages. It is never 'DM', so auto-sync never reads it. */
export const STORY_SCENE_SENDER = 'Scene';

/** The scene writer: cheap and uncensored, with Gemini as the backup. */
export const SCENE_MODEL = 'venice/qwen-3-6-plus';

export const SCENE_BACKUP_MODEL = 'google/gemini-2.5-flash';

export const SCENE_MAX_TOKENS = 4000;

/** How much of the end of the latest DM post the writer reads to know where everyone is. */
export const SCENE_SETTING_CHARS = 1500;

/** One sealed in-character line, in the order it was said. */
export interface StorySceneLine {
  /** The character's or NPC's name as shown at the table. */
  name: string;
  npc: boolean;
  /** The line as typed (player) or spoken (NPC). Roll requests are already plain words. */
  text: string;
  /** Who this line answers, when it was a reply. */
  replyTo?: string | null;
}

interface StoryRow {
  id: string;
  role: string;
  sender_name?: string | null;
  content?: string | null;
  team?: string | null;
  is_afk_marker?: boolean | null;
}

export function isStorySceneRow(m: { role: string; sender_name?: string | null }): boolean {
  return m.role === 'assistant' && m.sender_name === STORY_SCENE_SENDER;
}

/** A row written by a hand-off: a player's lines, an NPC's line or an AFK marker. */
export function isHandoffRow(m: StoryRow): boolean {
  if (m.is_afk_marker) return true;
  const name = (m.sender_name || '').trim();
  const content = (m.content || '').trimStart();
  if (!name) return false;
  if (m.role === 'user') return !(m.team || '').startsWith('whisper:') && content.startsWith(`[${name}]`);
  if (m.role === 'assistant') return name !== 'DM' && name !== STORY_SCENE_SENDER && content.startsWith(`**${name}:**`);
  return false;
}

/** Ids of the rows each scene retells: the run of hand-off rows right before it. */
export function rowsCoveredByScenes(rows: StoryRow[]): Set<string> {
  const covered = new Set<string>();
  rows.forEach((m, i) => {
    if (!isStorySceneRow(m)) return;
    for (let j = i - 1; j >= 0 && isHandoffRow(rows[j]); j--) covered.add(rows[j].id);
  });
  return covered;
}

/** Lowercase words, apostrophes kept ("don't"), punctuation and markup dropped. */
export function wordsOf(text: string): string[] {
  return (text || '').toLowerCase().replace(/[’‘`´]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || [];
}

const QUOTED_RE = /"([^"]+)"|“([^”]+)”/g;
const NPC_ASIDE_RE = /\*([^*]*)\*|\(([^)]*)\)/g;

const unquote = (s: string) => s.trim().replace(/^["“”]+|["“”]+$/g, '').trim();

/**
 * The spoken words of a line. For an NPC: everything outside *beats* and (notes).
 * For a player: only the words in "quotes" (unquoted text is what they do).
 */
export function spokenParts(line: StorySceneLine): string[] {
  const text = (line.text || '').trim();
  if (!text) return [];
  if (line.npc) {
    return text.split(/\*[^*]*\*|\([^)]*\)/).map(unquote).filter(s => wordsOf(s).length > 0);
  }
  const out: string[] = [];
  for (const m of text.matchAll(QUOTED_RE)) {
    const s = (m[1] ?? m[2] ?? '').trim();
    if (wordsOf(s).length > 0) out.push(s);
  }
  return out;
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(s => wordsOf(s).length > 0);
}

/** The scene as one run of words, voice tags removed. */
function sceneWordRun(scene: string): string {
  return ` ${wordsOf((scene || '').replace(/\[\/?VOICE(?::[^\]]*)?\]/gi, ' ')).join(' ')} `;
}

/**
 * Spoken sentences the scene changed or left out, as "Name: sentence".
 * Case, punctuation and markup may differ; the words and their order may not.
 */
export function missingSpokenLines(scene: string, lines: StorySceneLine[]): string[] {
  const run = sceneWordRun(scene);
  const missing: string[] = [];
  for (const line of lines) {
    for (const part of spokenParts(line)) {
      for (const sentence of sentencesOf(part)) {
        if (!run.includes(` ${wordsOf(sentence).join(' ')} `)) missing.push(`${line.name}: ${sentence}`);
      }
    }
  }
  return missing;
}

function voiced(name: string, words: string): string {
  const w = unquote(words.replace(/\s*\n+\s*/g, ' '));
  return w ? `[VOICE:${name}]"${w}"[/VOICE]` : '';
}

const italic = (s: string) => {
  const t = s.replace(/\*/g, '').replace(/\s*\n+\s*/g, ' ').trim();
  return t ? `*${t}*` : '';
};

function scriptLine(line: StorySceneLine): string {
  const text = (line.text || '').trim();
  if (!text) return '';
  const name = (line.name || '').trim() || (line.npc ? 'NPC' : 'Player');
  const parts: string[] = [];
  let last = 0;
  if (line.npc) {
    for (const m of text.matchAll(NPC_ASIDE_RE)) {
      parts.push(voiced(name, text.slice(last, m.index)));
      parts.push(italic(m[1] ?? m[2] ?? ''));
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(voiced(name, text.slice(last)));
  } else {
    for (const m of text.matchAll(QUOTED_RE)) {
      parts.push(italic(text.slice(last, m.index)));
      parts.push(voiced(name, m[1] ?? m[2] ?? ''));
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(italic(text.slice(last)));
  }
  const body = parts.filter(Boolean).join(' ');
  return body ? `**${name}:** ${body}` : '';
}

/** The scene with no AI: every line in order, one paragraph each, spoken words voice-tagged. */
export function sceneScript(lines: StorySceneLine[]): string {
  return lines.map(scriptLine).filter(Boolean).join('\n\n');
}

/** The end of the latest DM post, as plain story text, so the writer knows the setting. */
export function sceneSetting(rows: StoryRow[]): string {
  const last = [...rows].reverse().find(m => m.role === 'assistant' && m.sender_name === 'DM' && (m.content || '').trim());
  if (!last) return '';
  const text = (last.content || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\/?VOICE(?::[^\]]*)?\]/gi, '')
    .replace(/\[TABLE(?:\s*TALK)?\][\s\S]*?\[\/TABLE(?:\s*TALK)?\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > SCENE_SETTING_CHARS ? `…${text.slice(-SCENE_SETTING_CHARS)}` : text;
}

/** The exchange as the writer reads it: one numbered line each, in order. */
function exchangeList(lines: StorySceneLine[]): string {
  return lines.map((l, i) => {
    const who = [l.npc ? 'NPC' : '', l.replyTo ? `to ${l.replyTo}` : ''].filter(Boolean).join(', ');
    return `${i + 1}. ${l.name}${who ? ` (${who})` : ''}: ${l.text.trim()}`;
  }).join('\n');
}

/** The instruction sheet and the request for one scene. */
export function buildScenePrompt(lines: StorySceneLine[], setting: string): { system: string; user: string } {
  const system = [
    'You write the "what just happened" scene for the shared story of a tabletop fantasy roleplaying game. The players and some NPCs just talked and acted in the table chat. Turn that exchange into ONE short, readable scene for the story feed, like a passage in a novel.',
    'RULES',
    '- Keep the exchange in the order given. Every line in THE EXCHANGE appears in the scene.',
    '- Spoken words stay word for word: never change, shorten, censor, merge or drop them. For an NPC, the spoken words are everything outside *asterisks* and (brackets). For a player, the spoken words are the parts in "quotes".',
    '- Put each spoken line in its own paragraph, exactly like this: **Name:** [VOICE:Name]"the words"[/VOICE] with the name as given. Keep each spoken line in one piece: narration may go between lines, never inside one.',
    '- Words in *asterisks*, notes in (brackets) and a player\'s unquoted text are what the character does. Retell them as short narration in the present tense and the third person, using names.',
    '- Only what is in the exchange. Never invent events, outcomes, damage, new dialogue or decisions, and never resolve an attack, a spell or a roll the exchange leaves open. A roll result that is given may be stated as given. The DM narrates what happens next, so stop right after the last line.',
    '- Narration between lines: one short sentence at most, often none. No introduction, no recap of earlier events, no closing line, no headings, no notes.',
    '- Match the table\'s tone and language, profanity included. Do not soften anything.',
    '- Answer with the scene only.',
  ].join('\n');
  const user = [
    setting.trim() ? `WHERE THE STORY IS (end of the DM's latest post)\n${setting.trim()}` : '',
    `THE EXCHANGE (in order)\n${exchangeList(lines)}`,
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/**
 * What the DM is told when its post follows a scene. ai-dm adds the same rule on
 * Send to DM (buildLiveTableBlock, liveTable.hasScene); the app adds this copy when
 * a post is regenerated. Keep the two in step.
 */
export const SCENE_SHOWN_RULE = 'SCENE HAND-OFF: this round arrives as THE SCENE, a written account of what the players and any NPCs just said and did. The whole table has already read it, word for word, just above your post. Never retell, quote, paraphrase or summarize it, and never repeat a line from it. Start right after its last line and push the story forward: what their words and actions lead to, the effects of spells, rolls and actions, the environment, NPC agency, intrigue and new hooks, then a clear prompt for what the party does next. NPC lines in the scene were already spoken: keep each NPC consistent with them and never have them say it again; an NPC\'s offer, promise or warning is not an outcome, you decide what actually happens. A roll result in the scene stands as given. Player characters who did not speak or act in the scene do nothing new: never give them words, actions or choices.';

/** The heading the DM reads the scene under (its input on Send to DM, and in its history). */
export const SCENE_INPUT_HEADING = 'THE SCENE (already shown to the whole table, just above your post)';

/** The out-of-character part of a Live Table hand-off ("TABLE TALK (out of character):" and its lines), or ''. */
export function tableTalkPart(handoff: string): string {
  const at = (handoff || '').indexOf('TABLE TALK (out of character):');
  return at === -1 ? '' : handoff.slice(at).trim();
}

/** What the DM is sent on a Send to DM with a scene: the scene, then any table talk. */
export function sceneHandoffText(scene: string, tableTalk: string): string {
  return [`${SCENE_INPUT_HEADING}:\n${scene.trim()}`, tableTalk.trim()].filter(Boolean).join('\n\n');
}

/**
 * The story as the DM's history. A scene becomes a user turn under SCENE_INPUT_HEADING,
 * since it is what the table did. A scene from an older round, whose raw player and
 * NPC rows were saved right before it, is left out (those rows already tell it).
 */
export function storyHistory<T extends StoryRow & { content: string }>(rows: T[]): Array<{ role: string; content: string }> {
  const covered = rowsCoveredByScenes(rows);
  const out: Array<{ role: string; content: string }> = [];
  rows.forEach((m, i) => {
    if (!isStorySceneRow(m)) {
      out.push({ role: m.role, content: m.content });
      return;
    }
    const coversOldRows = i > 0 && covered.has(rows[i - 1].id);
    if (!coversOldRows) out.push({ role: 'user', content: `${SCENE_INPUT_HEADING}:\n${m.content}` });
  });
  return out;
}

/** True when the row at `index` comes right after a scene (AFK markers skipped). */
export function followsStoryScene(rows: StoryRow[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    if (rows[j].is_afk_marker) continue;
    return isStorySceneRow(rows[j]);
  }
  return false;
}

/** The follow-up when the first scene changed or dropped spoken words. */
export function sceneRetryNote(missing: string[]): string {
  return [
    'Your scene changed or left out these spoken words. Write the whole scene again, with every one of them word for word and in one piece:',
    ...missing.slice(0, 12).map(m => `- ${m}`),
  ].join('\n');
}

/** The model's answer as story text: thinking, comments, fences and headings removed. */
export function cleanSceneText(raw: string): string {
  return (raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .replace(/^\s*(?:#+\s*)?(?:the\s+)?scene\s*:?\s*\n/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
