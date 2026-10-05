import { SpellDefinition } from './types';
import { customSpellRegistry } from './spells';
import { parseRollTable } from './parseRollTable';

export const ROW_GUIDE_MAX_CHARS = 6000;

export type RowGuidedSpell = SpellDefinition & { rowGuides?: Record<string, string> };

/**
 * Finds a player-created spell by id first, then by name (case-insensitive, trimmed).
 * When several spells share a name, the copy that actually has row guides wins,
 * then the most recently edited one — otherwise an older guideless duplicate
 * would shadow the newer one and the player's notes would never show.
 */
export function findCustomSpell(idOrName: string): RowGuidedSpell | undefined {
  const key = idOrName.trim();
  if (!key) return undefined;
  const byId = customSpellRegistry[key];
  if (byId) return byId;
  const lowered = key.toLowerCase();
  const matches = Object.values(customSpellRegistry).filter(
    spell => spell.name.trim().toLowerCase() === lowered,
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const updatedAtOf = (spell: RowGuidedSpell) => (spell as { updatedAt?: number }).updatedAt ?? 0;
  const hasGuide = (spell: RowGuidedSpell) =>
    Object.entries(spell.rowGuides ?? {}).some(
      ([row, text]) =>
        Number(row) >= 1 &&
        Number(row) <= 20 &&
        typeof text === 'string' &&
        text.trim() !== '',
    );
  const pool = matches.some(hasGuide) ? matches.filter(hasGuide) : matches;
  return pool.reduce(
    (best, spell) => (updatedAtOf(spell) > updatedAtOf(best) ? spell : best),
    pool[0],
  );
}

/**
 * The spell's row guides, cleaned: only keys "1" to "20" with non-empty
 * trimmed values, each capped at ROW_GUIDE_MAX_CHARS. Empty object when none.
 */
export function getRowGuides(idOrName: string): Record<string, string> {
  const spell = findCustomSpell(idOrName);
  if (!spell || !spell.rowGuides) return {};
  const guides: Record<string, string> = {};
  for (let roll = 1; roll <= 20; roll++) {
    const raw = spell.rowGuides[String(roll)];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    guides[String(roll)] = trimmed.slice(0, ROW_GUIDE_MAX_CHARS);
  }
  return guides;
}

/**
 * The guide for one rolled row, or null when that row has no guide.
 */
export function getRowGuide(idOrName: string, roll: number): string | null {
  return getRowGuides(idOrName)[String(roll)] ?? null;
}

/**
 * Builds the text the DM sees for one cast of a spell that has a d20 table:
 * the rules paragraph (intro) plus only the rolled row — never the other rows.
 * Returns null when the spell's rules text has no table.
 */
export function buildRolledRowText(
  description: string,
  roll: number,
  guide?: string | null,
): { intro: string; rowText: string } | null {
  const parsed = parseRollTable(description);
  if (!parsed.table) return null;
  const { table } = parsed;

  let row = table.rows.find(r => r.roll === roll);
  if (!row) {
    const below = table.rows.filter(r => r.roll < roll);
    row = below.length > 0 ? below[below.length - 1] : table.rows[0];
  }
  if (!row) return null;

  let rowText = `${table.title}, natural d20 ${roll}: ${row.text}`;
  for (const tag of row.tags) {
    rowText += ` [${tag.label}]`;
  }

  const trimmedGuide = guide?.trim();
  if (trimmedGuide) {
    rowText += `\n\nROW ${roll} GUIDE (a GM guide written for exactly this result. Follow it for this cast, on top of your other guides):\n${trimmedGuide}`;
  }

  return { intro: parsed.intro, rowText };
}
