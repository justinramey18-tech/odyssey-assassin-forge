// Solo Empyrean live clock: the DM's hidden TIME tag. The clock runs on its own while the rider
// plays; when a reply covers more than the moment, the DM ends it with <!--TIME:+45m-->,
// <!--TIME:+2h--> or <!--TIME:+1h30m-->. The phone reads the tag from the finished reply, hides it,
// and sends the minutes to the rules server, which decides (4 hours at most, once per turn).

/** The most one reply can ask for. The server enforces the same ceiling. */
export const STORY_TIME_MAX_MINUTES = 240;

const TAG = /<!--\s*TIME\s*:\s*\+?\s*([^>]*?)\s*-->/gi;

/** Minutes in a tag's text: "45m", "2h", "1h30m", "1h 30m", "90", "45 minutes", "2 hours". 0 when it can't be read. */
function minutesIn(text: string): number {
  const t = text.toLowerCase().trim();
  if (!t) return 0;
  if (/^\d+(?:\.\d+)?$/.test(t)) return Math.round(Number(t));
  const days = t.match(/(\d+(?:\.\d+)?)\s*d/);
  const hours = t.match(/(\d+(?:\.\d+)?)\s*h/);
  const mins = t.match(/(\d+(?:\.\d+)?)\s*m/);
  if (!days && !hours && !mins) return 0;
  return Math.round((days ? Number(days[1]) * 1440 : 0) + (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0));
}

/** The minutes the DM's reply asks for (its last TIME tag), kept between 1 and the ceiling; null when there is no usable tag. */
export function readTimeTag(content: string): number | null {
  let last: string | null = null;
  for (const m of String(content ?? '').matchAll(TAG)) last = m[1];
  if (last === null) return null;
  const minutes = minutesIn(last);
  return minutes >= 1 ? Math.min(minutes, STORY_TIME_MAX_MINUTES) : null;
}

/** Remove TIME tags from text shown on screen (a tag still being typed at the very end too). */
export function stripTimeTags(content: string): string {
  return String(content ?? '')
    .replace(/<!--\s*TIME\s*:[^>]*?-->/gi, '')
    .replace(/<!--\s*TIME(?:\s*:[^>]*)?$/i, '');
}
