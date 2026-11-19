// The progression web's max HP bonus, as the sheet needs it.
// The rules server owns the number (empyrean-rules, web.ts). The solo Empyrean screen saves the
// server's latest answer here, per character, and the character sheet adds it to max HP in
// Empyrean mode only. Other modes never read it, so a character played in D&D keeps its own max HP.

import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

export const WEB_MAX_HP_KEY = 'empyrean-web-max-hp';
export const WEB_BONUS_EVENT = 'odyssey-empyrean-web-bonus';
/** No web can give more than this; anything larger is treated as damaged data. */
export const WEB_MAX_HP_TOP = 200;

const clean = (value: unknown): number => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(WEB_MAX_HP_TOP, n) : 0;
};

/** The saved bonus for the active character (0 when none). */
export function readWebMaxHp(): number {
  try { return clean(getScopedItem(WEB_MAX_HP_KEY)); } catch { return 0; }
}

/** Save the server's bonus for the active character. Returns true when the number changed. */
export function writeWebMaxHp(value: unknown): boolean {
  const next = clean(value);
  try {
    if (readWebMaxHp() === next) return false;
    setScopedItem(WEB_MAX_HP_KEY, String(next));
    window.dispatchEvent(new CustomEvent(WEB_BONUS_EVENT));
    return true;
  } catch { return false; }
}

/** What the sheet adds to max HP: the bonus in Empyrean mode, nothing anywhere else. */
export const webMaxHpFor = (mode: string | null | undefined, bonus: number): number => (mode === 'empyrean' ? clean(bonus) : 0);
