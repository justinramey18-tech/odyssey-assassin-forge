// Phone-side cache of the party's recent chat messages.
// Purpose: when the app opens straight into the live table, the last messages the
// player saw appear instantly while fresh ones load from the server behind them.
//
// Scope: keyed by PARTY id, not by character — the conversation belongs to the
// party, and switching characters must not hide it. Deliberately NOT in
// SCOPED_KEYS. Cache is capped and best-effort: the server stays the source of
// truth and its fetch always wins once it arrives.

const CACHE_PREFIX = 'odyssey-party-chat-cache::';
const MAX_CACHED_MESSAGES = 60;
// Keep the cache small enough for phone storage: very long single messages
// (full narrations) are trimmed rather than dropped, so the feed still reads.
const MAX_MESSAGE_CHARS = 4000;

export interface CachedPartyMessage {
  id: string;
  role: string;
  content: string;
  sender_name?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  team?: string | null;
}

function cacheKey(partyId: string): string {
  return `${CACHE_PREFIX}${partyId}`;
}

/** The party's last cached messages, oldest-first, or [] when none/invalid. */
export function readPartyChatCache(partyId: string): CachedPartyMessage[] {
  try {
    const raw = localStorage.getItem(cacheKey(partyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is CachedPartyMessage =>
        !!m && typeof m === 'object' && typeof m.id === 'string' && typeof m.content === 'string',
    );
  } catch {
    return [];
  }
}

/** Remember the party's most recent messages (newest tail, capped). */
export function writePartyChatCache(partyId: string, messages: CachedPartyMessage[]): void {
  try {
    const tail = messages.slice(-MAX_CACHED_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      content:
        m.content.length > MAX_MESSAGE_CHARS
          ? `${m.content.slice(0, MAX_MESSAGE_CHARS)}…`
          : m.content,
      sender_name: m.sender_name ?? null,
      user_id: m.user_id ?? null,
      created_at: m.created_at ?? null,
      team: m.team ?? null,
    }));
    localStorage.setItem(cacheKey(partyId), JSON.stringify(tail));
  } catch {
    // Storage full or unavailable — the chat simply loads from the server instead.
  }
}

/** Forget a party's cached chat (e.g. when leaving the party). */
export function clearPartyChatCache(partyId: string): void {
  try {
    localStorage.removeItem(cacheKey(partyId));
  } catch {
    // ignore
  }
}
