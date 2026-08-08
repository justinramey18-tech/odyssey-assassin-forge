/**
 * World-state canon guard.
 *
 * Established world-state entries ("The One Ring is destroyed", "Lord Varn is
 * dead") are permanent facts. This module does two jobs:
 *
 *  1. Builds a hard "canon lock" instruction block for the DM's system prompt,
 *     so contradictions are discouraged before they are ever written.
 *  2. Reads a finished DM response and flags sentences that appear to reverse
 *     one of those facts, so the app can warn and ask the DM to correct itself.
 *
 * Detection is deliberately conservative: a sentence must name the subject of
 * an established outcome AND assert the opposite state of that outcome before
 * it is flagged. False positives are worse than a missed catch here.
 */

import type { WorldStateEntry } from './quests';

export interface CanonViolation {
  entry: WorldStateEntry;
  /** The sentence from the DM response that appears to contradict the fact. */
  sentence: string;
  /** Plain-language description of the clash. */
  reason: string;
}

/** Outcome families we can reason about, with the words that reverse them. */
const OUTCOME_RULES: Array<{
  id: string;
  established: RegExp;
  reversed: RegExp;
  reason: (subject: string) => string;
}> = [
  {
    id: 'destroyed',
    established: /\b(destroyed|shattered|unmade|razed|burned down|burnt down|reduced to ash|obliterated|demolished)\b/i,
    reversed: /\b(intact|undamaged|unharmed|still stands|stands tall|rebuilt|restored|whole again|as it always was|untouched)\b/i,
    reason: s => `${s} was destroyed for good, but the response describes it as intact or restored.`,
  },
  {
    id: 'dead',
    established: /\b(is dead|died|slain|killed|executed|perished|fell in battle|beheaded|murdered)\b/i,
    reversed: /\b(is alive|still alive|still lives|survived|breathing|recovers|is well|greets you|walks in|returns unharmed)\b/i,
    reason: s => `${s} is established as dead, but the response has them alive.`,
  },
  {
    id: 'sealed',
    established: /\b(sealed|locked away|closed forever|barred|warded shut|entombed)\b/i,
    reversed: /\b(wide open|swings open|is open|unsealed|unlocked|breached freely)\b/i,
    reason: s => `${s} was sealed permanently, but the response describes it as open.`,
  },
  {
    id: 'lost',
    established: /\b(lost|stolen|taken|surrendered|handed over|gone missing)\b/i,
    reversed: /\b(still in your possession|still have it|back in your pack|never left your|remains in your hands)\b/i,
    reason: s => `${s} was lost, but the response says it is still held.`,
  },
  {
    id: 'freed',
    established: /\b(freed|released|escaped|liberated|broke free)\b/i,
    reversed: /\b(still imprisoned|still in chains|still caged|remains captive|locked in the cell)\b/i,
    reason: s => `${s} was freed, but the response keeps them captive.`,
  },
  {
    id: 'captured',
    established: /\b(captured|imprisoned|enslaved|taken prisoner|chained|caged)\b/i,
    reversed: /\b(walks free|roams free|is free|at liberty|never captured)\b/i,
    reason: s => `${s} is held captive, but the response has them free.`,
  },
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'is', 'was', 'were', 'are', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'from', 'has', 'have', 'had', 'been', 'that', 'this', 'it', 'its', 'their',
  'his', 'her', 'they', 'he', 'she', 'completed', 'failed', 'quest', 'party', 'now', 'forever',
  'destroyed', 'dead', 'died', 'killed', 'slain', 'sealed', 'lost', 'freed', 'captured',
]);

/** Meaningful subject words from an entry title (names, places, artifacts). */
export function subjectTerms(title: string): string[] {
  const words = title
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);
  const terms = words.filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
  // Prefer capitalised names when present — those are the strongest anchors.
  const proper = terms.filter(w => /^[A-Z]/.test(w));
  return (proper.length ? proper : terms).slice(0, 4);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 12);
}

/**
 * Read a DM response and flag sentences that reverse an established outcome.
 * Returns at most 3 violations, strongest impact first.
 */
export function findCanonViolations(
  response: string,
  entries: WorldStateEntry[],
): CanonViolation[] {
  if (!response?.trim() || !entries?.length) return [];
  const sentences = splitSentences(response);
  if (sentences.length === 0) return [];

  const violations: CanonViolation[] = [];

  for (const entry of entries) {
    const factText = `${entry.title} ${entry.consequence ?? ''}`;
    const rules = OUTCOME_RULES.filter(r => r.established.test(factText));
    if (rules.length === 0) continue;

    const terms = subjectTerms(entry.title);
    if (terms.length === 0) continue;

    for (const sentence of sentences) {
      const mentionsSubject = terms.some(t => new RegExp(`\\b${escapeRegExp(t)}`, 'i').test(sentence));
      if (!mentionsSubject) continue;
      const broken = rules.find(r => r.reversed.test(sentence));
      if (!broken) continue;
      violations.push({
        entry,
        sentence: sentence.slice(0, 220),
        reason: broken.reason(terms[0]),
      });
      break; // one flag per established fact is enough
    }
  }

  const weight = { seismic: 0, major: 1, minor: 2 } as const;
  return violations
    .sort((a, b) => weight[a.entry.impact] - weight[b.entry.impact])
    .slice(0, 3);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Hard instruction block appended to the DM system prompt. */
export function buildCanonLockBlock(entries: WorldStateEntry[]): string {
  if (!entries?.length) return '';
  const lines = entries.slice(-8).map(e => `- ${e.title}${e.consequence ? ` — ${e.consequence}` : ''} [${e.impact}]`);
  return [
    'WORLD STATE — ESTABLISHED AND IRREVERSIBLE (CANON LOCK):',
    ...lines,
    '',
    'These outcomes already happened and cannot be undone, reversed, walked back, dreamed away, retconned or "revealed" as a mistake.',
    'Do not write a scene in which any of them is untrue. If a player acts as though one of them never happened, narrate the world correcting them — do not change the fact.',
    'A new outcome may build on these facts, but never contradict them.',
  ].join('\n');
}

/** The correction request sent back to the DM when a contradiction slips through. */
export function buildCanonCorrectionPrompt(violations: CanonViolation[]): string {
  const items = violations.map(v => `- "${v.sentence}" — ${v.reason} Established fact: ${v.entry.title}.`);
  return [
    '[CANON CORRECTION — OUT OF CHARACTER]',
    'Your last response contradicted established, irreversible world state:',
    ...items,
    '',
    'Rewrite that last beat so it respects those facts exactly. Keep the same scene, pacing and tone, change only what breaks canon, and do not mention this correction in the story.',
  ].join('\n');
}

/** Short user-facing summary for the warning banner/toast. */
export function violationSummary(violations: CanonViolation[]): string {
  return violations.map(v => v.reason).join(' ');
}
