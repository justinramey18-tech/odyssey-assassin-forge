type TablePoster = (text: string) => Promise<boolean> | boolean;

let poster: TablePoster | null = null;

/** The active DM screen registers here. Last mount wins. Returns an unsubscribe. */
export function registerTablePoster(fn: TablePoster): () => void {
  poster = fn;
  return () => { if (poster === fn) poster = null; };
}

export function hasTablePoster(): boolean { return poster !== null; }

/** Send text to the current DM screen. Resolves false if no DM screen is open or the post failed. */
export async function postToTable(text: string): Promise<boolean> {
  if (!poster) return false;
  try { return !!(await poster(text)); } catch (e) { console.error('[tablePostBus] post failed', e); return false; }
}
