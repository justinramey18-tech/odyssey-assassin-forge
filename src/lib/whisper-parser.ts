// ── Whisper Parser ─────────────────────────────────────────────────────────────
// Extracts mechanical content (dice rolls, tactics, per-player whispers) from
// AI DM responses, leaving clean narrative prose.

import type { Whisper } from '@/components/oracle/types';
export type { Whisper };

export interface ParsedMessage {
  narrative: string;     // clean prose with all delimiters stripped
  whispers: Whisper[];
}

// ── Delimiter regex ────────────────────────────────────────────────────────────
// Matches <!--ACTION-->...<!--/ACTION-->, <!--TACTICS-->...<!--/TACTICS-->,
// and <!--WHISPER:Name-->...<!--/WHISPER:Name-->
const DELIMITER_RE =
  /<!--(ACTION|TACTICS|WHISPER:([^>]+?))-->([\s\S]*?)<!--\/\1-->/g;

// ── Fallback heuristic ─────────────────────────────────────────────────────────
// Catches untagged mechanical lines the AI forgot to wrap.
// Patterns: "Roll a ...", "Make a ... check/save", "DC ##", standalone dice like "d20+5"
const MECHANICAL_LINE_RE =
  /^[\s>*-]*(Roll\s+(a\s+)?|Make\s+(a\s+)?|DC\s*\d|d\d+\s*[+\-]|\(\s*DC\s*\d)/i;

/**
 * Parse an AI DM response string, extracting whispers and returning clean narrative.
 *
 * 1. First pass: extract all delimiter-tagged blocks.
 * 2. Second pass: scan remaining lines for untagged mechanical patterns (fallback).
 * 3. Return clean narrative + whisper array.
 */
export function parseWhispers(raw: string): ParsedMessage {
  const whispers: Whisper[] = [];

  // ── Pass 1: extract delimited blocks ──
  let narrative = raw.replace(DELIMITER_RE, (_match, tag: string, whisperTarget: string | undefined, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return '';

    if (tag === 'ACTION') {
      whispers.push({ type: 'action', content: trimmed });
    } else if (tag === 'TACTICS') {
      whispers.push({ type: 'tactics', content: trimmed });
    } else if (tag.startsWith('WHISPER:') && whisperTarget) {
      whispers.push({ type: 'whisper', target: whisperTarget.trim(), content: trimmed });
    }

    return ''; // remove from narrative
  });

  // ── Pass 2: fallback heuristic on remaining text ──
  // Only run if no delimiters were found (AI ignored formatting instructions)
  if (whispers.length === 0) {
    const lines = narrative.split('\n');
    const narrativeLines: string[] = [];

    for (const line of lines) {
      if (MECHANICAL_LINE_RE.test(line)) {
        const cleaned = line.replace(/^[\s>*-]+/, '').trim();
        if (cleaned) {
          whispers.push({ type: 'action', content: cleaned });
        }
      } else {
        narrativeLines.push(line);
      }
    }

    if (whispers.length > 0) {
      narrative = narrativeLines.join('\n');
    }
  }

  // Clean up: collapse excessive blank lines left by removed blocks
  narrative = narrative.replace(/\n{3,}/g, '\n\n').trim();

  return { narrative, whispers };
}

/**
 * Serialize clean narrative + whisper array back into a single content string
 * with HTML-comment delimiters. This is the inverse of `parseWhispers`.
 *
 * Output format:
 *   [narrative]
 *   <!--ACTION-->content<!--/ACTION-->
 *   <!--TACTICS-->content<!--/TACTICS-->
 *   <!--WHISPER:Name-->content<!--/WHISPER:Name-->
 */
export function serializeWhispers(narrative: string, whispers: Whisper[]): string {
  if (!whispers.length) return narrative.trim();

  const blocks = whispers
    .filter(w => w.content.trim())
    .map(w => {
      if (w.type === 'action') {
        return `<!--ACTION-->${w.content.trim()}<!--/ACTION-->`;
      }
      if (w.type === 'tactics') {
        return `<!--TACTICS-->${w.content.trim()}<!--/TACTICS-->`;
      }
      // whisper with target
      const target = w.target?.trim() || 'Unknown';
      return `<!--WHISPER:${target}-->${w.content.trim()}<!--/WHISPER:${target}-->`;
    });

  if (!blocks.length) return narrative.trim();

  return `${narrative.trim()}\n\n${blocks.join('\n')}`;
}
