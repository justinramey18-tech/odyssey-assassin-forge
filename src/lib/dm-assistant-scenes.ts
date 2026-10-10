// Human DM Assistant: rehearsed scenes (one or more NPCs talking with the party)
// turned into draft text. Every line the host kept goes in word for word and in
// order: "Add as-is" does it with no AI call, "Weave in" asks the assistant to
// add only light narration between the lines.
// Pure functions only (no network, no React) so it can be unit tested.

import { npcLineToStory } from '@/lib/dm-assistant';

/** One line of a rehearsed scene, in the order it was said. */
export interface SceneLine {
  /** The NPC who said it, or the character the host named ("Kaelen: …"). Empty when unnamed. */
  speaker: string;
  /** True for a line the assistant said as an NPC. */
  npc: boolean;
  text: string;
}

/** "Grukk", "Grukk and Mira", "Grukk, Mira and Tobb". */
export function castLabel(cast: string[]): string {
  const names = cast.filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Kaelen: where is the pup?" → speaker Kaelen. A name is 1 to 3 capitalised words. */
export function splitSpeaker(text: string): { name: string; words: string } {
  const m = /^\s*([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,2})\s*:\s*([\s\S]+)$/.exec(text);
  if (!m || m[1].length > 30) return { name: '', words: text.trim() };
  return { name: m[1], words: m[2].trim() };
}

/** A note to the assistant rather than something said in the scene, e.g. "(make him nervous)" or "OOC: …". */
export function isOutOfCharacter(text: string): boolean {
  const t = text.trim();
  return !t || /^\(.*\)$/s.test(t) || /^\[.*\]$/s.test(t) || /^ooc\b/i.test(t);
}

/** One line of the scene as story text: named speakers get voice tags, *beats* become narration. */
export function sceneLineToStory(line: SceneLine): string {
  if (line.npc) return npcLineToStory(line.speaker, line.text);
  if (isOutOfCharacter(line.text)) return '';
  const { name, words } = splitSpeaker(line.text);
  return name ? npcLineToStory(name, words) : line.text.trim();
}

/** The whole scene as draft paragraphs, one line per paragraph, in order. */
export function sceneToStory(lines: SceneLine[]): string {
  return lines.map(sceneLineToStory).filter(Boolean).join('\n\n');
}

/** The script the assistant weaves in: "Grukk: …", "Kaelen: …", "Party: …". */
function sceneScript(lines: SceneLine[]): string {
  return lines
    .filter(l => l.npc || !isOutOfCharacter(l.text))
    .map(l => {
      if (l.npc) return `${l.speaker}: ${l.text.trim()}`;
      const { name, words } = splitSpeaker(l.text);
      return name ? `${name}: ${words}` : `Party: ${l.text.trim()}`;
    })
    .join('\n');
}

/** The ask that weaves a rehearsed scene into the draft, keeping every line. */
export function buildSceneWeavePrompt(cast: string[], lines: SceneLine[], afterParagraph: number | null): string {
  const place = afterParagraph !== null
    ? `Put the whole scene in ONE block: INSERT AFTER ¶${afterParagraph} (it can be several paragraphs).`
    : 'Put the whole scene in ONE INSERT AFTER block where it fits best (it can be several paragraphs), or write the full post with it if there is no draft yet.';
  return [
    `Weave this rehearsed scene with ${castLabel(cast) || 'the NPC'} into the draft as natural dialogue.`,
    'Every line below must appear in the draft word for word and in this order. Do not shorten, summarize, merge, reorder or drop any line. Only add short narration between lines (who moves, how they say it).',
    'Spoken words go inside voice tags with the speaker shown before the colon: [VOICE:Name]"words"[/VOICE]. Lines marked "Party:" have no named speaker; keep them as written. *Action beats in asterisks* become plain narration.',
    place,
    'If paragraphs already in the draft are now out of order, fix the order with MOVE instead of retyping them. Never retype paragraphs you are not changing.',
    '',
    'SCENE:',
    sceneScript(lines),
  ].join('\n');
}
