// Remembers that the player left a DM character sheet to visit an app tab, and
// WHICH DM they left from. A floating button reads this to send them back to the
// same sheet tab in the same campaign.
// Deliberately in-memory rather than localStorage: a page reload should not
// resurrect a stale return prompt from a previous session.

export const SHEET_RETURN_EVENT = 'odyssey-sheet-return-change';

export type SheetReturnOrigin = 'solo' | 'party';

export interface SheetReturn {
  /** Which tab of the character sheet the player was on: vitals, stats, abilities, items, story */
  sheetTab: string;
  /** Which app tab they jumped to. Informational only. */
  appTab: string;
  /** Which DM screen the sheet was open in. Determines where the return button goes. */
  origin: SheetReturnOrigin;
}

let pending: SheetReturn | null = null;

export function getSheetReturn(): SheetReturn | null {
  return pending;
}

export function setSheetReturn(sheetTab: string, appTab: string, origin: SheetReturnOrigin = 'solo'): void {
  pending = { sheetTab, appTab, origin };
  window.dispatchEvent(new CustomEvent(SHEET_RETURN_EVENT));
}

export function clearSheetReturn(): void {
  if (!pending) return;
  pending = null;
  window.dispatchEvent(new CustomEvent(SHEET_RETURN_EVENT));
}

export function subscribeSheetReturn(listener: () => void): () => void {
  window.addEventListener(SHEET_RETURN_EVENT, listener);
  return () => window.removeEventListener(SHEET_RETURN_EVENT, listener);
}
