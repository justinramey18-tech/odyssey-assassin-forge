// Builds the text a quest scan should actually read.
//
// parseWhispers() strips ACTION / TACTICS / WHISPER blocks out of the DM's reply
// and stores only the leftover narrative on message.content, with the blocks kept
// separately on message.whispers. A scan that reads content alone therefore cannot
// see anything the DM dropped into the whisper tray. This stitches the whispers
// back on as plain, labelled prose the extractor can parse.

import type { Whisper } from '@/components/oracle/types';

export interface ScannableMessage {
  content?: string;
  whispers?: Whisper[];
}

const WHISPER_LABELS: Record<Whisper['type'], string> = {
  action: 'Action prompt',
  tactics: 'Tactical note',
  whisper: 'Whispered aside',
};

/**
 * Narrative plus every whisper on the message, formatted for the quest extractor.
 * Returns an empty string when there is nothing to read.
 */
export function buildQuestScanText(message: ScannableMessage | null | undefined): string {
  if (!message) return '';

  const narrative = (message.content || '').trim();
  const whispers = (message.whispers || []).filter(w => (w?.content || '').trim());

  if (!whispers.length) return narrative;

  const lines = whispers.map(w => {
    const label = WHISPER_LABELS[w.type] || 'Whispered aside';
    const target = (w.target || '').trim();
    const heading = target ? `${label} to ${target}` : label;
    return `[${heading}] ${w.content.trim()}`;
  });

  const block = [
    'The DM also passed the following privately, outside the main narration.',
    'Treat these as part of the same scene - side quests and jobs are often offered here:',
    ...lines,
  ].join('\n');

  return narrative ? `${narrative}\n\n${block}` : block;
}

/** True when the message has narrative text, whispers, or both. */
export function hasQuestScanText(message: ScannableMessage | null | undefined): boolean {
  return buildQuestScanText(message).trim().length > 0;
}
